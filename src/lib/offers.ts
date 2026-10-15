import { prisma } from '#/db'
import { COURSE_SLUG } from '#/lib/catalog'
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
  main: OfferProduct
  // Adicionales de la promoción; solo hay mientras los precios especiales aplican.
  extras: OfferProduct[]
}

// Sin promoción (enlace simple) se vende el curso al precio normal. Con promoción: el curso
// principal de la promoción, y sus adicionales con precio especial si está vigente.
// `forPayment` extiende el fin 1 hora (quien ya tenía el carrito abierto); para mostrar no.
export async function resolveOffer(
  promoSlug: string | undefined,
  forPayment: boolean,
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

  const applied = promotionApplies(promotion, now, forPayment ? GRACE_MS : 0)
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
    main: asProduct(
      main.product,
      applied ? main.priceMxn : main.product.priceMxn,
    ),
    extras: applied ? rest.map((r) => asProduct(r.product, r.priceMxn)) : [],
  }
}
