import { notFound } from '@tanstack/react-router'

import { prisma } from '#/db'
import type { Offer } from '#/lib/offers'
import { buildToolPage } from '#/lib/tool-page'
import { TOOL_INCLUDED_COURSE_SLUG } from '#/lib/tool-tiers'

// Solo servidor: se importa únicamente dentro de los handlers (`getToolPage`,
// `getPromotionLanding`), así el compilador lo saca del bundle del navegador.
// Niveles publicados de la herramienta y si el curso incluido tiene página pública.
export async function loadToolPage(offer?: Offer) {
  const [tools, course] = await Promise.all([
    prisma.product.findMany({
      where: { kind: 'TOOL', status: 'PUBLISHED', tier: { isNot: null } },
      include: { tier: true },
    }),
    prisma.product.findUnique({ where: { slug: TOOL_INCLUDED_COURSE_SLUG } }),
  ])
  if (tools.length === 0) throw notFound()
  return buildToolPage(
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
}
