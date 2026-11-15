import { notFound } from '@tanstack/react-router'

import { prisma } from '#/db'
import { signedPlaybackUrl } from '#/lib/bunny'
import type { Offer } from '#/lib/offers'
import { buildToolPage } from '#/lib/tool-page'
import { TOOL_INCLUDED_COURSE_SLUG } from '#/lib/tool-tiers'

// Solo servidor: se importa únicamente dentro de los handlers (`getToolPage`,
// `getPromotionLanding`), así el compilador lo saca del bundle del navegador.
// Niveles publicados de la herramienta y si el curso incluido tiene página pública.
export async function loadToolPage(offer?: Offer) {
  const [tools, course, site, promo] = await Promise.all([
    prisma.product.findMany({
      where: { kind: 'TOOL', status: 'PUBLISHED', tier: { isNot: null } },
      include: { tier: true },
    }),
    prisma.product.findUnique({ where: { slug: TOOL_INCLUDED_COURSE_SLUG } }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
    offer?.promotion
      ? prisma.promotion.findUnique({
          where: { id: offer.promotion.id },
          select: { introVideoId: true },
        })
      : null,
  ])
  if (tools.length === 0) throw notFound()
  // Video de la página (H15): el de la promoción; sin él, el de Admin › Herramienta.
  const videoId = promo?.introVideoId ?? site?.toolPageVideoId
  const page = buildToolPage(
    tools.map((t) => ({
      slug: t.slug,
      name: t.name,
      priceMxn: t.priceMxn,
      rank: t.tier!.rank,
      itemLimit: t.tier!.itemLimit,
    })),
    course?.status === 'PUBLISHED' ? `/cursos/${course.slug}` : null,
    offer,
  )
  return { ...page, introVideo: videoId ? signedPlaybackUrl(videoId) : null }
}
