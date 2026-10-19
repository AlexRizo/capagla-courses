import { createHmac, timingSafeEqual } from 'node:crypto'

import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequestHeaders,
  setCookie,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { hasPlaceholderName } from '#/lib/account-name'
import { readSession } from '#/lib/auth'
import { courseContents } from '#/lib/course-pages'
import { canRenew, resolveOffer, resolveRenewal } from '#/lib/offers'
import { recordPromotionEvent } from '#/lib/promo-stats'
import { longDate } from '#/lib/promotions'
import { env } from '#/env'
import {
  AlreadyOwnedError,
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
      offer = await resolveOffer(data.promo, true, data.prueba)
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
      name: string
      normalMxn: number
      priceMxn: number
    }) => ({
      name: p.name,
      normalMxn: p.normalMxn,
      priceMxn: p.priceMxn,
    })
    const tool = offer.extras.find((e) => !e.isCourse)
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
        label: offer.main.isCourse ? 'Curso' : 'Herramienta',
        image: offer.main.coverUrl,
        accessDays: offer.main.accessDays,
        recipes: courseContents[offer.main.slug]?.recipes.length ?? null,
      },
      bonuses: offer.extras.filter((e) => e.isCourse).map(line),
      tool: tool ? line(tool) : null,
      // Clave publicable de Stripe (es pública): la usa el navegador para los campos de pago.
      stripeKey: env.STRIPE_PUBLISH_KEY ?? null,
      account,
      renewal: !!offer.renewal,
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

function isOwnOrder(cookie: string | undefined, orderId: string) {
  const expected = Buffer.from(`${orderId}.${orderSignature(orderId)}`)
  const given = Buffer.from(cookie ?? '')
  return given.length === expected.length && timingSafeEqual(given, expected)
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
      promo: z.string().optional(),
      prueba: z.string().optional(),
      renovar: z.string().optional(),
      replaces: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { replaces, email, name, renovar, ...rest } = data
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
    const input = { ...rest, ...buyer, renew: renovar }
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
    // Stripe no cobra menos de $10 MXN.
    if (order.amountMxn < 10) throw new Error('El monto es menor al mínimo.')
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.amountMxn * 100,
        currency: 'mxn',
        // Solo tarjeta (Apple Pay y Google Pay también pasan por aquí).
        allowed_payment_method_types: ['card'],
        receipt_email: order.email,
        description: `Capagla · orden ${order.id}`,
        metadata: { orderId: order.id },
      },
      { idempotencyKey: `order-${order.id}` },
    )
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    })
    setCookie(ORDER_COOKIE, `${order.id}.${orderSignature(order.id)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return { orderId: order.id, clientSecret: intent.client_secret }
  })

// Orden de la página "Pago exitoso", solo para el navegador que la pagó (cookie
// `ORDER_COOKIE`): así nadie ve el correo y la compra de otra persona con solo el id.
// Si sigue pendiente se consulta a Stripe: la alumna llega a /gracias apenas paga y
// puede que el webhook aún no haya llegado. Devuelve null si no existe o no es suya.
export const getThanksOrder = createServerFn()
  .validator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    if (!isOwnOrder(getCookie(ORDER_COOKIE), data.orderId)) return null
    await settleOrder(data.orderId).catch((error: unknown) =>
      console.error('[stripe] No se pudo consultar el pago:', error),
    )
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: { include: { product: true } } },
    })
    if (order?.status !== 'PAID') return order && { ...order, signedIn: false }
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
    return { ...order, signedIn }
  })
