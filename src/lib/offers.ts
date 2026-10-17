import { createHmac } from 'node:crypto'

import { prisma } from '#/db'
import { env } from '#/env'
import { COURSE_SLUG } from '#/lib/catalog'
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
