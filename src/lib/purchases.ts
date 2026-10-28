import { prisma } from '#/db'
import { hasPlaceholderName } from '#/lib/account-name'
import { attributionJson } from '#/lib/attribution'
import type { Attribution } from '#/lib/attribution'
import { auth } from '#/lib/auth'
import { withLinkPurpose } from '#/lib/mailer'
import { trackPurchase } from '#/lib/purchase-tracking'
import type { TrackingContext } from '#/lib/track-core'
import { resolveOffer, resolveRenewal, resolveStandalone } from '#/lib/offers'
import { TIME_ZONE } from '#/lib/promotions'
import { getStripe } from '#/lib/stripe'

// El correo ya tiene acceso vigente al producto: comprarlo otra vez solo cobraría de más.
// Con el acceso vencido sí se puede comprar (es una renovación).
export class AlreadyOwnedError extends Error {}

const DAY_MS = 24 * 60 * 60 * 1000

async function hasActiveAccess(email: string, productId: string) {
  const count = await prisma.enrollment.count({
    where: {
      user: { email: email.trim().toLowerCase() },
      productId,
      expiresAt: { gt: new Date() },
    },
  })
  return count > 0
}

// Orden con lo que dice la oferta del momento (precios del servidor, nunca del cliente):
// el curso, los cursos adicionales de la promoción y la herramienta si se marcó la casilla.
// Guarda la promoción de origen para atribuir la compra, aunque ya no aplique su precio.
// `renew` (slug): renovación del correo que ya tuvo el producto, solo con su precio de renovación.
export async function createOrder(input: {
  email: string
  name: string
  withTool: boolean
  promo?: string
  prueba?: string
  // Herramienta sola a precio normal (desde Mis cursos); la promoción sigue vendiéndola como casilla.
  product?: string
  renew?: string
  // Atribución de la visita y si aceptó las cookies de medición (ver lib/attribution.ts).
  attribution?: Attribution | null
  marketingConsent?: boolean | null
  // IP, navegador y cookies del píxel (solo con las cookies aceptadas) para el evento Purchase.
  trackingContext?: TrackingContext | null
}) {
  const renewal = input.renew
    ? await resolveRenewal(input.renew, input.email)
    : null
  if (input.renew && !renewal) throw new Error('No se puede renovar.')
  const standalone = input.product
    ? await resolveStandalone(input.product, input.email)
    : null
  if (input.product && !standalone) throw new Error('No está a la venta.')
  const offer =
    renewal ??
    standalone ??
    (await resolveOffer(input.promo, true, input.prueba))
  if (!offer.main.published) throw new Error('El curso no está a la venta.')
  // Una renovación sí puede pagarse con el acceso vigente (en sus últimos 30 días).
  if (!renewal && (await hasActiveAccess(input.email, offer.main.productId))) {
    throw new AlreadyOwnedError()
  }
  const items = [
    offer.main,
    ...offer.extras.filter((e) => e.isCourse || input.withTool),
  ].map((p) => ({ productId: p.productId, amountMxn: p.priceMxn }))

  return prisma.order.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      amountMxn: items.reduce((sum, item) => sum + item.amountMxn, 0),
      promotionId: offer.promotion?.id,
      renewal: !!renewal,
      upgradeFromProductId: offer.upgrade?.fromProductId,
      attribution: attributionJson(input.attribution ?? null),
      marketingConsent: input.marketingConsent ?? undefined,
      trackingContext: input.trackingContext ?? undefined,
      items: { create: items },
    },
  })
}

// Pago confirmado: crea o reutiliza la cuenta, inscribe y manda el enlace de acceso.
// Lo disparan el webhook de Stripe y `settleOrder` (al volver a /gracias); pueden llegar a
// la vez, así que un candado de Postgres por orden las pone en fila. Idempotente: si la
// orden ya está pagada no hace nada.
export async function completeOrder(orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${orderId}))`
      return completeOrderLocked(orderId)
    },
    { timeout: 30_000 },
  )
}

async function completeOrderLocked(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })
  // Una orden reembolsada no se vuelve a completar (p. ej. si `payment_intent.succeeded`
  // llega después del reembolso).
  if (order.status === 'PAID' || order.status === 'REFUNDED') return order

  const ctx = await auth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(order.email)
  const user =
    existing?.user ??
    (await ctx.internalAdapter.createUser(
      { email: order.email, name: order.name, emailVerified: true },
      { method: 'purchase' },
    ))
  // Cuenta de clase gratis sin nombre real: toma el que escribió al comprar.
  if (existing && hasPlaceholderName(existing.user) && order.name) {
    await prisma.user.update({
      where: { id: existing.user.id },
      data: { name: order.name },
    })
  }

  // Los días de acceso se suman a los que le queden (renovar antes de vencer no pierde
  // días); con el acceso vencido o sin él, cuentan desde hoy.
  const current = await prisma.enrollment.findMany({
    where: {
      userId: user.id,
      productId: { in: order.items.map((i) => i.productId) },
    },
  })
  const now = Date.now()
  // Mejora de nivel: la inscripción nueva conserva el vencimiento del nivel que ya tenía (si aún
  // está vigente; si venció mientras tanto, cuenta como una compra normal).
  const kept = order.upgradeFromProductId
    ? await prisma.enrollment.findFirst({
        where: {
          userId: user.id,
          productId: order.upgradeFromProductId,
          expiresAt: { gt: new Date(now) },
        },
      })
    : null
  const newExpiry = new Map(
    order.items.map((item, i) => {
      const prev = current.find((e) => e.productId === item.productId)
      if (kept && i === 0) {
        return [
          item.productId,
          new Date(
            Math.max(kept.expiresAt.getTime(), prev?.expiresAt.getTime() ?? 0),
          ),
        ]
      }
      const from = Math.max(now, prev?.expiresAt.getTime() ?? 0)
      return [item.productId, new Date(from + item.product.accessDays * DAY_MS)]
    }),
  )

  const [paid] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: new Date(), userId: user.id },
    }),
    ...order.items.map((item) => {
      const expiresAt = newExpiry.get(item.productId)!
      return prisma.enrollment.upsert({
        where: {
          userId_productId: { userId: user.id, productId: item.productId },
        },
        create: { userId: user.id, productId: item.productId, expiresAt },
        update: { expiresAt },
      })
    }),
  ])

  // Correo de compra (o de renovación, con la nueva fecha): lo que incluye y el enlace.
  const renewedUntil = order.renewal
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: TIME_ZONE,
        dateStyle: 'long',
      }).format(newExpiry.get(order.items[0].productId))
    : undefined
  await withLinkPurpose(
    {
      kind: 'purchase',
      items: order.items.map((i) => i.product.name),
      renewedUntil,
    },
    () =>
      auth.api.signInMagicLink({
        body: { email: order.email, callbackURL: '/mis-cursos' },
        headers: new Headers(),
      }),
  )

  // Marketing: la compra confirmada sale a las plataformas (sin esperar su respuesta).
  void trackPurchase(paid.id)

  return paid
}

// Tras pagar, abre la sesión en el navegador que pagó para que "Empezar el curso" no la mande
// a Entrar. Solo si la cuenta la creó esta misma compra y el pago es reciente: con una cuenta
// que ya existía bastaría escribir el correo de otra persona y pagar para entrar a ella (el
// correo no se verifica antes de pagar); esas cuentas entran con el enlace del correo.
// Usa el mismo mecanismo del enlace de acceso (Better Auth crea la sesión y su cookie), sin
// mandar correo. `headers` son los de la petición del navegador.
const SIGN_IN_WINDOW_MS = 30 * 60 * 1000

export async function signInAfterPurchase(orderId: string, headers: Headers) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  })
  if (order?.status !== 'PAID' || !order.user || !order.paidAt) return false
  if (Date.now() - order.paidAt.getTime() > SIGN_IN_WINDOW_MS) return false
  if (order.user.createdAt < order.createdAt || order.user.role !== 'STUDENT') {
    return false
  }

  let link: string | undefined
  await withLinkPurpose(
    {
      kind: 'capture',
      onLink: (url) => {
        link = url
      },
    },
    () =>
      auth.api.signInMagicLink({
        body: { email: order.email, callbackURL: '/mis-cursos' },
        headers: new Headers(),
      }),
  )
  const token = link ? new URL(link).searchParams.get('token') : null
  if (!token) return false
  await auth.api.magicLinkVerify({ query: { token }, headers })
  return true
}

// Pago rechazado: solo marca las órdenes que siguen pendientes (una orden pagada no
// vuelve atrás). La alumna puede reintentar con el mismo PaymentIntent y entonces se
// completa igual.
export async function failOrder(orderId: string) {
  return prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'FAILED' },
  })
}

// Reembolso total: la orden pasa a REFUNDED y se quita el acceso a todo lo que incluía
// (curso, curso adicional y herramienta). Si la alumna tiene otra compra pagada del mismo
// producto (p. ej. al reembolsar una renovación), ese producto se conserva pero pierde los
// días que sumó esta orden. El progreso de sus lecciones no se borra. Un reembolso parcial
// no pasa por aquí. Idempotente.
export async function refundOrder(orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${orderId}))`
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      })
      if (!order || order.status === 'REFUNDED') return

      const revoke: string[] = []
      const shorten: { productId: string; days: number }[] = []
      if (order.userId && order.status === 'PAID') {
        for (const item of order.items) {
          const other = await prisma.orderItem.count({
            where: {
              productId: item.productId,
              order: {
                userId: order.userId,
                status: 'PAID',
                id: { not: order.id },
              },
            },
          })
          if (other === 0) revoke.push(item.productId)
          else
            shorten.push({
              productId: item.productId,
              days: item.product.accessDays,
            })
        }
      }
      const kept = await prisma.enrollment.findMany({
        where: {
          userId: order.userId ?? '',
          productId: { in: shorten.map((s) => s.productId) },
        },
      })
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        }),
        prisma.enrollment.deleteMany({
          where: { userId: order.userId ?? '', productId: { in: revoke } },
        }),
        ...kept.map((e) => {
          const days = shorten.find((s) => s.productId === e.productId)!.days
          return prisma.enrollment.update({
            where: { id: e.id },
            data: {
              expiresAt: new Date(e.expiresAt.getTime() - days * DAY_MS),
            },
          })
        }),
      ])
    },
    { timeout: 30_000 },
  )
}

// Cobro de Stripe que corresponde a la orden: misma orden, moneda y monto cobrado.
function paymentMatchesOrder(
  intent: {
    metadata: Record<string, string>
    currency: string
    amount_received: number
  },
  order: { id: string; amountMxn: number },
) {
  return (
    intent.metadata.orderId === order.id &&
    intent.currency === 'mxn' &&
    intent.amount_received === order.amountMxn * 100
  )
}

// Completa la orden si Stripe confirma el cobro de su PaymentIntent. Vale tanto para el
// webhook (`payment_intent.succeeded`) como al volver a /gracias, por si el webhook tarda.
export async function settleOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (
    !order ||
    order.status === 'PAID' ||
    order.status === 'REFUNDED' ||
    !order.stripePaymentIntentId
  ) {
    return order
  }
  const intent = await getStripe().paymentIntents.retrieve(
    order.stripePaymentIntentId,
  )
  if (intent.status === 'succeeded' && paymentMatchesOrder(intent, order)) {
    await completeOrder(order.id)
  }
  return prisma.order.findUnique({ where: { id: orderId } })
}

// Eventos del webhook de Stripe. Solo se actúa sobre PaymentIntents de nuestras órdenes.
export async function handleStripeEvent(event: {
  type: string
  data: { object: unknown }
}) {
  if (event.type === 'charge.refunded') {
    // `refunded` es true solo cuando se reembolsó todo el cobro.
    const charge = event.data.object as {
      id: string
      payment_intent: string | null
      refunded: boolean
    }
    if (!charge.payment_intent) return
    const order = await prisma.order.findUnique({
      where: { stripePaymentIntentId: charge.payment_intent },
    })
    if (!order) return
    if (charge.refunded) await refundOrder(order.id)
    else
      console.log(
        `[stripe] Reembolso parcial en la orden ${order.id}: no se quita el acceso.`,
      )
    return
  }

  if (
    event.type !== 'payment_intent.succeeded' &&
    event.type !== 'payment_intent.payment_failed'
  ) {
    return
  }
  const intent = event.data.object as {
    id: string
    metadata: Record<string, string>
    currency: string
    amount_received: number
  }
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: intent.id },
  })
  if (!order) return

  if (event.type === 'payment_intent.succeeded') {
    if (!paymentMatchesOrder(intent, order)) {
      console.error(
        `[stripe] El cobro ${intent.id} no coincide con la orden ${order.id}; no se completa.`,
      )
      return
    }
    await completeOrder(order.id)
  } else {
    await failOrder(order.id)
  }
}
