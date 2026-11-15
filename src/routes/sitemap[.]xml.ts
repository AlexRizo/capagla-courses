import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { env } from '#/env'
import { findFreeLesson } from '#/lib/free-class'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// /sitemap.xml (H20): las páginas públicas que se pueden indexar. Las landings de promociones
// (anuncios) no van: tienen precios por tiempo limitado y su propio tráfico.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const base = env.BETTER_AUTH_URL.replace(/\/$/, '')
        const [courses, freeClass] = await Promise.all([
          prisma.product.findMany({
            where: { kind: 'COURSE', status: 'PUBLISHED' },
            orderBy: { position: 'asc' },
            select: { slug: true },
          }),
          findFreeLesson(),
        ])
        const paths = [
          '/',
          ...courses.map((c) => `/cursos/${c.slug}`),
          '/herramienta-de-costos',
          ...(freeClass ? ['/clase-gratis'] : []),
          '/privacidad',
          '/terminos',
          '/devoluciones',
          '/cookies',
        ]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join('\n')}
</urlset>
`
        return new Response(xml, {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
