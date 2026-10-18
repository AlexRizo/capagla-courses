import { createHmac } from 'node:crypto'

import { prisma } from '#/db'
import { env } from '#/env'
import { COURSE_SLUG, RENEWAL_DISCOUNT_PCT } from '#/lib/catalog'
import { isAdminRequest } from '#/lib/guards'
import { GRACE_MS, promotionApplies } from '#/lib/promotions'

type OfferProduct = {
  productId: string
  slug: string
  name: string
  isCourse: boolean
  // Un borrador no es público: no se muestra ni se vende.
  published: boolean
  coverUrl: string | null
  accessDays: number
  normalMxn: number
  priceMxn: number
}

// Qué se vende y a qué precio. Es la única fuente de precios de la landing, el checkout y la
// orden: el cliente nunca manda un precio.
export type Offer = {
  promotion: {
    id: string
    slug: string
    introTitle: string | null
    introText: string | null
    endsAt: Date | null
  } | null
  // Los precios especiales de la promoción están vigentes.
  applied: boolean
  // Clave del enlace de prueba, si se entró con uno válido (los botones de compra la llevan).
  testKey?: string
  // Renovación del acceso (ver `resolveRenewal`): precio de renovación y sin adicionales.
  renewal?: boolean
  main: OfferProduct
  // Adicionales de la promoción; solo hay mientras los precios especiales aplican.
  extras: OfferProduct[]
}

// Clave del "Enlace de prueba" de una promoción (`?prueba=`): fija por promoción y firmada con
// el secreto del servidor, así que no se adivina a partir de la URL.
export function promotionTestKey(promotionId: string) {
  return createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`prueba:${promotionId}`)
    .digest('base64url')
    .slice(0, 12)
}

const asProduct = (
  p: {
    id: string
    slug: string
    name: string
    kind: string
    status: string
    coverUrl: string | null
    accessDays: number
    priceMxn: number
  },
  priceMxn: number,
): OfferProduct => ({
  productId: p.id,
  slug: p.slug,
  name: p.name,
  isCourse: p.kind === 'COURSE',
  published: p.status === 'PUBLISHED',
  coverUrl: p.coverUrl,
  accessDays: p.accessDays,
  normalMxn: p.priceMxn,
  priceMxn,
})

// Renovación: `RENEWAL_DISCOUNT_PCT` sobre el precio normal. Se puede renovar con el acceso
// vencido o cuando faltan 30 días o menos.
const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export const renewalPrice = (normalMxn: number) =>
  Math.round((normalMxn * (100 - RENEWAL_DISCOUNT_PCT)) / 100)

export const canRenew = (expiresAt: Date, now = new Date()) =>
  expiresAt.getTime() - now.getTime() <= RENEWAL_WINDOW_MS

// Oferta de renovación de un producto para el correo que ya lo tuvo. null si no lo tuvo, si
// aún le faltan más de 30 días o si el producto ya no se vende.
export async function resolveRenewal(
  slug: string,
  email: string,
): Promise<Offer | null> {
  const product = await prisma.product.findUnique({ where: { slug } })
  if (!product || product.status !== 'PUBLISHED') return null
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      user: { email: email.trim().toLowerCase() },
      productId: product.id,
    },
  })
  if (!enrollment || !canRenew(enrollment.expiresAt)) return null
  return {
    promotion: null,
    applied: false,
    renewal: true,
    main: asProduct(product, renewalPrice(product.priceMxn)),
    extras: [],
  }
}

// Sin promoción (enlace simple) se vende el curso al precio normal. Con promoción: el curso
// principal de la promoción, y sus adicionales con precio especial si está vigente.
// `forPayment` extiende el fin 1 hora (quien ya tenía el carrito abierto); para mostrar no.
// `testKey` (enlace de prueba): con la clave correcta y sesión de admin aplica los precios
// especiales sin importar las fechas (una promoción pausada sigue sin aplicar).
export async function resolveOffer(
  promoSlug: string | undefined,
  forPayment: boolean,
  testKey?: string,
  now = new Date(),
): Promise<Offer> {
  const promotion = promoSlug
    ? await prisma.promotion.findUnique({
        where: { slug: promoSlug },
        include: {
          products: {
            orderBy: { position: 'asc' },
            include: { product: true },
          },
        },
      })
    : null

  if (!promotion) {
    const course = await prisma.product.findUniqueOrThrow({
      where: { slug: COURSE_SLUG },
    })
    return {
      promotion: null,
      applied: false,
      main: asProduct(course, course.priceMxn),
      extras: [],
    }
  }

  const testing =
    !!testKey &&
    !promotion.paused &&
    testKey === promotionTestKey(promotion.id) &&
    (await isAdminRequest())
  const applied =
    testing || promotionApplies(promotion, now, forPayment ? GRACE_MS : 0)
  const [main, ...rest] = promotion.products
  return {
    promotion: {
      id: promotion.id,
      slug: promotion.slug,
      introTitle: promotion.introTitle,
      introText: promotion.introText,
      endsAt: promotion.endsAt,
    },
    applied,
    testKey: testing ? testKey : undefined,
    main: asProduct(
      main.product,
      applied ? main.priceMxn : main.product.priceMxn,
    ),
    extras: applied ? rest.map((r) => asProduct(r.product, r.priceMxn)) : [],
  }
}
