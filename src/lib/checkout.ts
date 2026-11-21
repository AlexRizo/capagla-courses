import { createHmac, timingSafeEqual } from 'node:crypto'

import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequestHeader,
  getRequestHeaders,
  setCookie,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { hasPlaceholderName } from '#/lib/account-name'
import {
  ATTRIBUTION_COOKIE,
  attributionSchema,
  parseAttribution,
  stripeMetadata,
} from '#/lib/attribution'
import { readSession } from '#/lib/auth'
import { CONSENT_COOKIE, parseConsent, trackingAllowed } from '#/lib/consent'
import { courseContents } from '#/lib/course-pages'
import {
  canRenew,
  checkoutTools,
  resolveOffer,
  resolveRenewal,
  resolveStandalone,
  resolveThanksTool,
  sellsToolAfterPayment,
  withoutOwnedExtras,
} from '#/lib/offers'
import { signedPlaybackUrl } from '#/lib/bunny'
import { clientIp } from '#/lib/track-core'
import type { TrackingContext } from '#/lib/track-core'
import { recordPromotionEvent } from '#/lib/promo-stats'
import { longDate } from '#/lib/promotions'
import { env } from '#/env'
import { tooManyAttempts } from '#/lib/rate-limit'
import {
  AlreadyOwnedError,
  completeOrder,
  createOrder,
  failOrder,
  settleOrder,
  signInAfterPurchase,
} from '#/lib/purchases'
import { getStripe } from '#/lib/stripe'

// Lo que se vende en el checkout. Con `?promo=` y la promoción vigente (con 1 hora de gracia),
// el curso lleva su precio especial y se suman sus adicionales: cursos incluidos y la
// herramienta como casilla. Sin promoción es solo el curso al precio normal.
// Con `?renovar=<slug>` (desde Mis cursos) es la renovación de ese producto: exige sesión y
// que la cuenta pueda renovarlo; si no, vuelve a Entrar o a Mis cursos. Sin `renovar`, una
// cuenta con el acceso vigente no entra (ver abajo).
export const getCheckoutData = createServerFn()
  .validator(
    z.object({
      promo: z.string().optional(),
      prueba: z.string().optional(),
      renovar: z.string().optional(),
      producto: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Con sesión (p. ej. desde "Quiero el curso" en Mis cursos) se compra para esa cuenta:
    // correo y nombre se muestran bloqueados y `startCheckout` los toma de la sesión.
    const session = await readSession(getRequestHeaders())
    let offer
    if (data.renovar) {
      if (!session) throw redirect({ to: '/entrar' })
      const renewal = await resolveRenewal(data.renovar, session.user.email)
      if (!renewal) throw redirect({ to: '/mis-cursos' })
      offer = renewal
    } else {
      // `?producto=` vende la herramienta sola a precio normal; sin él, la oferta de siempre
      // (el curso, o la promoción con la herramienta como casilla).
      const standalone = data.producto
        ? await resolveStandalone(data.producto, session?.user.email)
        : null
      if (data.producto && !standalone) throw notFound()
      offer =
        standalone ??
        // Con sesión, lo que ya tiene de los adicionales no se muestra ni se cobra.
        (await withoutOwnedExtras(
          await resolveOffer(data.promo, true, data.prueba),
          session?.user.email,
        ))
      // Con el acceso vigente no hay nada que comprar (el pago se rechazaría): en sus últimos
      // 30 días va a la renovación; antes, de vuelta a Mis cursos. Vencido sí puede comprar.
      const enrollment = session
        ? await prisma.enrollment.findUnique({
            where: {
              userId_productId: {
                userId: session.user.id,
                productId: offer.main.productId,
              },
            },
          })
        : null
      if (enrollment && enrollment.expiresAt > new Date()) {
        if (canRenew(enrollment.expiresAt)) {
          throw redirect({
            to: '/checkout',
            search: { renovar: offer.main.slug, desde: 'mis-cursos' },
          })
        }
        throw redirect({ to: '/mis-cursos' })
      }
    }
    if (!offer.main.published) throw notFound()
    // Llegar al pago desde la landing de una promoción es "agregar al carrito".
    if (offer.promotion) await recordPromotionEvent(offer.promotion.id, 'CART')
    const line = (p: {
      slug: string
      name: string
      normalMxn: number
      priceMxn: number
    }) => ({
      slug: p.slug,
      name: p.name,
      normalMxn: p.normalMxn,
      priceMxn: p.priceMxn,
    })
    // Una cuenta de clase gratis aún sin nombre real lo escribe aquí la primera vez.
    const nameLocked = !!session && !hasPlaceholderName(session.user)
    const account = session
      ? {
          email: session.user.email,
          name: nameLocked ? session.user.name : '',
          nameLocked,
        }
      : null
    return {
      // El producto principal puede ser cualquier producto (no solo el curso de Navidad).
      course: {
        ...line(offer.main),
        slug: offer.main.slug,
        label: offer.main.isCourse ? 'Curso' : 'Herramienta',
        image: offer.main.coverUrl,
        accessDays: offer.main.accessDays,
        recipes: (() => {
          const content = courseContents[offer.main.slug]
          return content?.layout === 'recipes' ? content.recipes.length : null
        })(),
      },
      bonuses: offer.extras.filter((e) => e.isCourse).map(line),
      // Niveles de la herramienta que trae la promoción (se elige uno o ninguno). Con el curso
      // cobrado no van aquí: se ofrecen en /gracias (ver `sellsToolAfterPayment`).
      tools: checkoutTools(offer).map(line),
      // Se guarda la tarjeta (solo para usarla con la alumna presente) para la oferta de /gracias.
      saveCard: sellsToolAfterPayment(offer),
      // Clave publicable de Stripe (es pública): la usa el navegador para los campos de pago.
      stripeKey: env.STRIPE_PUBLISH_KEY ?? null,
      account,
      renewal: !!offer.renewal,
      // Mejora de nivel: se paga la diferencia y se conserva el vencimiento.
      upgradeUntil: offer.upgrade ? longDate(offer.upgrade.keepUntil) : null,
      special: offer.applied,
      until:
        offer.applied && offer.promotion?.endsAt
          ? longDate(offer.promotion.endsAt)
          : null,
    }
  })

// Cookie con la última orden que inició este navegador (ver `getThanksOrder`). Va firmada
// con el secreto del servidor: conocer el id de una orden no basta para fabricarla.
const ORDER_COOKIE = 'capagla_orden'
const orderSignature = (orderId: string) =>
  createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`orden:${orderId}`)
    .digest('base64url')

// Deja en el navegador la orden que acaba de iniciar (la lee `getThanksOrder`).
function rememberOrder(orderId: string) {
  setCookie(ORDER_COOKIE, `${orderId}.${orderSignature(orderId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
}

function isOwnOrder(cookie: string | undefined, orderId: string) {
  const expected = Buffer.from(`${orderId}.${orderSignature(orderId)}`)
  const given = Buffer.from(cookie ?? '')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Si no rechazó las cookies de medición, lo que el servidor necesita para mandar la compra a las
// plataformas aunque la confirme el webhook de Stripe (sin navegador delante).
function requestTracking() {
  const allowed = trackingAllowed(parseConsent(getCookie(CONSENT_COOKIE)))
  const trackingContext: TrackingContext | null = allowed
    ? {
        ip: clientIp(getRequestHeader('x-forwarded-for')),
        userAgent: getRequestHeader('user-agent')?.slice(0, 500),
        fbp: getCookie('_fbp')?.slice(0, 200),
        fbc: getCookie('_fbc')?.slice(0, 300),
        ttp: getCookie('_ttp')?.slice(0, 200),
      }
    : null
  return { allowed, trackingContext }
}

// Crea la orden (precios del servidor) y su PaymentIntent de Stripe, y devuelve el
// `clientSecret` con el que el navegador confirma el pago. Si el correo ya tiene el curso
// vigente no se cobra: devuelve `{ error: 'already-owned' }`. `replaces` es la orden de un
// intento anterior con otros datos: se cancela su cobro para no dejarlo abierto.
// Con sesión, correo y nombre salen de la cuenta (el navegador no los manda); sin sesión
// son obligatorios. Una renovación (`renovar`) solo se paga con sesión.
export const startCheckout = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().email().optional(),
      name: z.string().trim().min(1).optional(),
      withTool: z.boolean(),
      // Nivel elegido cuando la promoción trae varios (sin él, el primero).
      toolSlug: z.string().optional(),
      promo: z.string().optional(),
      prueba: z.string().optional(),
      renovar: z.string().optional(),
      producto: z.string().optional(),
      replaces: z.string().optional(),
      // La compra trae la oferta de /gracias: se guarda la tarjeta para cobrarla con un clic.
      saveCard: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { replaces, email, name, renovar, producto, saveCard, ...rest } = data
    const session = await readSession(getRequestHeaders())
    if (renovar && !session) throw new Error('Entra para renovar tu acceso.')
    // Con sesión, el nombre del navegador solo cuenta si la cuenta aún no tiene uno real.
    const buyerName =
      session && !hasPlaceholderName(session.user) ? session.user.name : name
    const buyerEmail = session ? session.user.email : email
    if (!buyerEmail || !buyerName) {
      throw new Error('Faltan el correo y el nombre.')
    }
    const buyer = { email: buyerEmail, name: buyerName }
    // Marketing: de dónde llegó y si rechazó las cookies de medición (cookies del navegador).
    const attribution = parseAttribution(getCookie(ATTRIBUTION_COOKIE))
    const { allowed, trackingContext } = requestTracking()
    const input = {
      ...rest,
      ...buyer,
      renew: renovar,
      product: producto,
      attribution,
      marketingConsent: allowed,
      trackingContext,
    }
    const stripe = getStripe()

    if (replaces) {
      const old = await prisma.order.findUnique({ where: { id: replaces } })
      if (
        (old?.status === 'PENDING' || old?.status === 'FAILED') &&
        old.stripePaymentIntentId
      ) {
        await stripe.paymentIntents
          .cancel(old.stripePaymentIntentId)
          .catch(() => {})
        await failOrder(old.id)
      }
    }

    let order
    try {
      order = await createOrder(input)
    } catch (error) {
      // Se avisa en la página (sin cobrar) en vez de fallar.
      if (error instanceof AlreadyOwnedError) {
        return { error: 'already-owned' as const }
      }
      throw error
    }
    // Orden gratis: solo cuando una promoción regala el producto principal y no se agregó nada de
    // paga. No pasa por Stripe: se completa aquí mismo (cuenta, inscripción y correo con el acceso).
    // Una renovación o mejora de $0, o un precio normal de $0 sin promoción, siguen rechazadas.
    if (
      order.amountMxn === 0 &&
      order.promotionId &&
      !order.renewal &&
      !order.upgradeFromProductId
    ) {
      // Como la clase gratis: solo se pide un correo, así que se limita por correo e IP.
      const ip = clientIp(getRequestHeader('x-forwarded-for'))
      if (tooManyAttempts(`gratis|${order.email}|${ip}`)) {
        await failOrder(order.id)
        throw new Error('Demasiados intentos. Intenta más tarde.')
      }
      await completeOrder(order.id)
      rememberOrder(order.id)
      return { orderId: order.id, free: true as const }
    }
    // Stripe no cobra menos de $10 MXN.
    if (order.amountMxn < 10) throw new Error('El monto es menor al mínimo.')
    const promotion = order.promotionId
      ? await prisma.promotion.findUnique({
          where: { id: order.promotionId },
          select: { slug: true },
        })
      : null
    // Para la oferta de /gracias la tarjeta queda guardada en un cliente de Stripe, solo para
    // usarla con la alumna presente («on_session»: ella da el clic). El navegador manda
    // `saveCard` igual que en sus campos de pago (Apple Pay y Google Pay exigen que coincida).
    const customer = saveCard
      ? await stripe.customers.create(
          {
            email: order.email,
            name: order.name,
            metadata: { orderId: order.id },
          },
          { idempotencyKey: `customer-${order.id}` },
        )
      : null
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.amountMxn * 100,
        currency: 'mxn',
        ...(customer && {
          customer: customer.id,
          setup_future_usage: 'on_session' as const,
        }),
        // Solo tarjeta (Apple Pay y Google Pay también pasan por aquí).
        allowed_payment_method_types: ['card'],
        receipt_email: order.email,
        description: `Capagla · orden ${order.id}`,
        // Promoción, campaña y creativo que originaron la compra (se ven en Stripe).
        metadata: {
          orderId: order.id,
          ...stripeMetadata(attribution, promotion?.slug ?? null),
        },
      },
      { idempotencyKey: `order-${order.id}` },
    )
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripePaymentIntentId: intent.id,
        stripeCustomerId: customer?.id,
      },
    })
    rememberOrder(order.id)
    return { orderId: order.id, clientSecret: intent.client_secret }
  })

// La oferta de /gracias vale mientras la alumna sigue en esa página tras pagar (la cookie de la
// orden dura lo mismo).
const THANKS_OFFER_MS = 24 * 60 * 60 * 1000

type ThanksParent = {
  id: string
  email: string
  status: string
  renewal: boolean
  paidAt: Date | null
  promotionId: string | null
  stripeCustomerId: string | null
  stripePaymentIntentId: string | null
  upsellOfId: string | null
}

// La herramienta que se ofrece en /gracias para esta orden, o null. Solo una orden pagada en las
// últimas 24 h, que guardó la tarjeta y de una promoción con el curso cobrado (ver
// `resolveThanksTool`). Una orden que ya es de esta oferta no ofrece otra.
async function thanksTool(order: ThanksParent) {
  if (
    order.status !== 'PAID' ||
    order.renewal ||
    order.upsellOfId ||
    !order.promotionId ||
    !order.stripeCustomerId ||
    !order.stripePaymentIntentId ||
    !order.paidAt ||
    Date.now() - order.paidAt.getTime() > THANKS_OFFER_MS
  ) {
    return null
  }
  return resolveThanksTool(order.promotionId, order.email)
}

// La compra de la oferta de /gracias que ya se pagó (o sigue en curso) para esta orden.
const latestUpsell = (orderId: string) =>
  prisma.order.findFirst({
    where: { upsellOfId: orderId, status: { in: ['PENDING', 'PAID'] } },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } } },
  })

// Orden de la página "Pago exitoso", solo para el navegador que la pagó (cookie
// `ORDER_COOKIE`): así nadie ve el correo y la compra de otra persona con solo el id.
// Si sigue pendiente se consulta a Stripe: la alumna llega a /gracias apenas paga y
// puede que el webhook aún no haya llegado. Devuelve null si no existe o no es suya.
// Trae también la oferta de la herramienta (si aplica) y el video de gracias.
export const getThanksOrder = createServerFn()
  .validator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    if (!isOwnOrder(getCookie(ORDER_COOKIE), data.orderId)) return null
    await settleOrder(data.orderId).catch((error: unknown) =>
      console.error('[stripe] No se pudo consultar el pago:', error),
    )
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      // En el orden de las tarjetas (`Product.position`): el curso antes que la herramienta.
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { position: 'asc' } },
        },
      },
    })
    const empty = {
      signedIn: false,
      tool: null,
      toolAdded: null,
      video: null,
      stripeKey: null,
    }
    if (order?.status !== 'PAID') return order && { ...order, ...empty }
    // Quien acaba de pagar queda con la sesión abierta (ver `signInAfterPurchase`).
    const headers = getRequestHeaders()
    let signedIn = !!(await readSession(headers))
    if (!signedIn) {
      signedIn = await signInAfterPurchase(order.id, headers).catch(
        (error: unknown) => {
          console.error(
            '[sesión] No se pudo abrir la sesión tras pagar:',
            error,
          )
          return false
        },
      )
    }
    // Si ya la agregó (p. ej. al recargar la página) se muestra como agregada, no otra vez.
    const upsell = await latestUpsell(order.id)
    const added = upsell?.status === 'PAID' ? upsell : null
    const tool = added ? null : await thanksTool(order)
    const site = await prisma.siteSettings.findUnique({ where: { id: 1 } })
    return {
      ...order,
      signedIn,
      tool: tool && {
        slug: tool.slug,
        name: tool.name,
        normalMxn: tool.normalMxn,
        priceMxn: tool.priceMxn,
      },
      toolAdded: added && {
        orderId: added.id,
        name: added.items[0]?.product.name ?? '',
      },
      video: site?.thanksVideoId ? signedPlaybackUrl(site.thanksVideoId) : null,
      // Clave publicable de Stripe: por si el banco pide autenticar el segundo cobro.
      stripeKey: tool ? (env.STRIPE_PUBLISH_KEY ?? null) : null,
    }
  })

// «Agregar con un clic» en /gracias: nueva orden con la herramienta al precio de la promoción,
// cobrada con la tarjeta guardada de la compra (la alumna está presente: da el clic). Si el banco
// pide autenticarla, devuelve `clientSecret` y el navegador la muestra ahí mismo; luego llama a
// `confirmThanksTool`. La orden se completa como cualquier otra (acceso, correo y Purchase).
export const addThanksTool = createServerFn({ method: 'POST' })
  .validator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    if (!isOwnOrder(getCookie(ORDER_COOKIE), data.orderId)) {
      throw new Error('Esta oferta ya no está disponible.')
    }
    const parent = await prisma.order.findUnique({
      where: { id: data.orderId },
    })
    if (!parent) throw new Error('Esta oferta ya no está disponible.')
    const stripe = getStripe()

    // Un clic anterior (doble clic, recarga a media autenticación): se retoma, no se cobra dos veces.
    const previous = await latestUpsell(parent.id)
    if (previous?.status === 'PAID') {
      return { upsellId: previous.id, amountMxn: previous.amountMxn }
    }
    if (previous?.stripePaymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(
        previous.stripePaymentIntentId,
      )
      if (intent.status === 'requires_action' && intent.client_secret) {
        return {
          upsellId: previous.id,
          amountMxn: previous.amountMxn,
          clientSecret: intent.client_secret,
        }
      }
      if (intent.status === 'succeeded' || intent.status === 'processing') {
        await settleOrder(previous.id)
        return { upsellId: previous.id, amountMxn: previous.amountMxn }
      }
      await failOrder(previous.id)
    } else if (previous) {
      await failOrder(previous.id)
    }

    const tool = await thanksTool(parent)
    if (!tool || !parent.stripeCustomerId || !parent.stripePaymentIntentId) {
      throw new Error('Esta oferta ya no está disponible.')
    }
    const first = await stripe.paymentIntents.retrieve(
      parent.stripePaymentIntentId,
    )
    const paymentMethod =
      typeof first.payment_method === 'string'
        ? first.payment_method
        : first.payment_method?.id
    if (!paymentMethod) throw new Error('Esta oferta ya no está disponible.')

    const { trackingContext, allowed } = requestTracking()
    const order = await prisma.order.create({
      data: {
        email: parent.email,
        name: parent.name,
        amountMxn: tool.priceMxn,
        promotionId: parent.promotionId,
        upsellOfId: parent.id,
        stripeCustomerId: parent.stripeCustomerId,
        attribution: parent.attribution ?? undefined,
        marketingConsent: allowed,
        trackingContext: trackingContext ?? undefined,
        items: {
          create: [{ productId: tool.productId, amountMxn: tool.priceMxn }],
        },
      },
    })
    const promotion = parent.promotionId
      ? await prisma.promotion.findUnique({
          where: { id: parent.promotionId },
          select: { slug: true },
        })
      : null
    let intent
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: order.amountMxn * 100,
          currency: 'mxn',
          customer: parent.stripeCustomerId,
          payment_method: paymentMethod,
          allowed_payment_method_types: ['card'],
          confirm: true,
          // Si el banco pide autenticar, el navegador lo resuelve con Stripe.js (`handleNextAction`).
          use_stripe_sdk: true,
          receipt_email: order.email,
          description: `Capagla · orden ${order.id} (oferta de gracias de ${parent.id})`,
          metadata: {
            orderId: order.id,
            upsellOf: parent.id,
            ...stripeMetadata(
              attributionSchema.safeParse(parent.attribution).data ?? null,
              promotion?.slug ?? null,
            ),
          },
        },
        { idempotencyKey: `order-${order.id}` },
      )
    } catch (error) {
      // Tarjeta rechazada: la orden queda fallida y se dice por qué (sin cobrar).
      await failOrder(order.id)
      const card = error as { type?: string; message?: string }
      const message = card.type === 'StripeCardError' ? card.message : null
      console.error('[stripe] No se pudo cobrar la oferta de gracias:', error)
      return {
        error: message ?? 'No se pudo cobrar con tu tarjeta. Intenta de nuevo.',
      }
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    })
    if (intent.status === 'succeeded') {
      await settleOrder(order.id)
      return { upsellId: order.id, amountMxn: order.amountMxn }
    }
    if (intent.status === 'requires_action' && intent.client_secret) {
      return {
        upsellId: order.id,
        amountMxn: order.amountMxn,
        clientSecret: intent.client_secret,
      }
    }
    await failOrder(order.id)
    return { error: 'No se pudo cobrar con tu tarjeta. Intenta de nuevo.' }
  })

// Tras autenticar el segundo cobro en el navegador: confirma con Stripe y completa la orden.
export const confirmThanksTool = createServerFn({ method: 'POST' })
  .validator(z.object({ orderId: z.string(), upsellId: z.string() }))
  .handler(async ({ data }) => {
    if (!isOwnOrder(getCookie(ORDER_COOKIE), data.orderId))
      return { paid: false }
    const upsell = await prisma.order.findUnique({
      where: { id: data.upsellId },
    })
    if (upsell?.upsellOfId !== data.orderId) return { paid: false }
    const settled = await settleOrder(upsell.id)
    return { paid: settled?.status === 'PAID' }
  })
