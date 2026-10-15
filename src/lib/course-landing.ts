import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { mxn } from '#/lib/catalog'
import { courseContents } from '#/lib/course-pages'
import type { CoursePage, Offer as OfferCard } from '#/lib/course-pages'
import { isAdminRequest } from '#/lib/guards'
import { resolveOffer } from '#/lib/offers'
import type { Offer } from '#/lib/offers'
import { longDate } from '#/lib/promotions'

// Textos del recuadro de un adicional, a partir de su precio especial.
function card(extra: Offer['extras'][number], until: string | null): OfferCard {
  const when = until ? ` hasta el ${until}` : ''
  const discount =
    extra.priceMxn === 0
      ? `Gratis solo${when}.`
      : extra.normalMxn > extra.priceMxn
        ? `${Math.round((1 - extra.priceMxn / extra.normalMxn) * 100)}% de descuento${when}.`
        : `Precio especial${when}.`
  return {
    tag: extra.isCourse ? 'CURSO ADICIONAL' : 'HERRAMIENTA',
    title: extra.name,
    old: extra.normalMxn > 0 ? mxn(extra.normalMxn) : '[valor real]',
    now: extra.priceMxn === 0 ? 'Gratis' : mxn(extra.priceMxn),
    note: discount,
  }
}

// Landing lista para mostrar: el contenido del curso principal más los precios del momento.
// Sin promoción (enlace simple) es el precio normal y no hay recuadro de promoción.
export function buildCoursePage(offer: Offer): CoursePage | null {
  const content = courseContents[offer.main.slug]
  if (!content) return null

  const until = offer.promotion?.endsAt
    ? longDate(offer.promotion.endsAt)
    : null
  const special = offer.applied && offer.main.normalMxn > offer.main.priceMxn
  const intro = offer.promotion?.introText || content.intro

  return {
    ...content,
    title: offer.promotion?.introTitle || content.title,
    intro,
    introShort: offer.promotion?.introText || content.introShort,
    price: mxn(offer.main.priceMxn),
    strike: special ? mxn(offer.main.normalMxn) : '',
    strikeShort: special ? `$${offer.main.normalMxn}` : '',
    priceNote: offer.applied
      ? `pago único · precio especial${until ? ` hasta el ${until}` : ''}`
      : 'pago único',
    promo:
      offer.applied && offer.extras.length > 0
        ? {
            title: 'Llévate más con tu curso, por tiempo limitado',
            offers: offer.extras.map((e) => card(e, until)),
          }
        : null,
    promoSlug: offer.promotion?.slug,
  }
}

// /cursos/$slug: enlace simple, siempre al precio normal.
export const getCourseLanding = createServerFn()
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const course = await prisma.product.findUnique({
      where: { slug: data.slug },
    })
    if (course?.kind !== 'COURSE') throw notFound()
    // Un borrador solo lo ve la admin (para revisarlo antes de publicarlo).
    if (course.status !== 'PUBLISHED' && !(await isAdminRequest())) {
      throw notFound()
    }
    const page = buildCoursePage({
      promotion: null,
      applied: false,
      main: {
        productId: course.id,
        slug: course.slug,
        name: course.name,
        isCourse: true,
        published: course.status === 'PUBLISHED',
        coverUrl: course.coverUrl,
        accessDays: course.accessDays,
        normalMxn: course.priceMxn,
        priceMxn: course.priceMxn,
      },
      extras: [],
    })
    if (!page) throw notFound()
    return page
  })

// /<url de la promoción>: la landing del anuncio. Los precios especiales se ven solo
// dentro de las fechas; fuera de ellas (o pausada) se ven los precios normales.
export const getPromotionLanding = createServerFn()
  .validator(z.object({ promo: z.string() }))
  .handler(async ({ data }) => {
    const exists = await prisma.promotion.findUnique({
      where: { slug: data.promo },
      select: { id: true },
    })
    if (!exists) throw notFound()
    const offer = await resolveOffer(data.promo, false)
    if (!offer.main.published && !(await isAdminRequest())) throw notFound()
    const page = buildCoursePage(offer)
    if (!page) throw notFound()
    return page
  })
