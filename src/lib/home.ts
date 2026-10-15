import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { courseContents } from '#/lib/course-pages'

// Tarjetas de producto de la Home: solo los publicados, en su orden, con el precio normal.
// Un producto tiene página de venta si existe su contenido en `lib/course-pages.ts`.
export const getHomeProducts = createServerFn().handler(async () => {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  })
  return products.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    priceMxn: p.priceMxn,
    coverUrl: p.coverUrl,
    isTool: p.kind === 'TOOL',
    hasPage: p.kind === 'COURSE' && p.slug in courseContents,
  }))
})
