import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { courseContents } from '#/lib/course-pages'

// Tarjetas de curso de la Home: solo los publicados, en su orden, con el precio normal.
// Un producto tiene página de venta si existe su contenido en `lib/course-pages.ts`.
export const getHomeProducts = createServerFn().handler(async () => {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  })
  // La herramienta ya no tiene tarjeta: sale en su propia sección con el precio más bajo de
  // sus niveles («Desde $429 al año»); sin niveles publicados no hay sección.
  const tools = products.filter((p) => p.kind === 'TOOL')
  const toolFromMxn = tools.length
    ? Math.min(...tools.map((p) => p.priceMxn))
    : null
  const courses = products
    .filter((p) => p.kind === 'COURSE')
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description ?? '',
      priceMxn: p.priceMxn,
      coverUrl: p.coverUrl,
      hasPage: p.slug in courseContents,
    }))
  return { courses, toolFromMxn }
})
