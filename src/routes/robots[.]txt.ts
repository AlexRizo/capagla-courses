import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'

// /robots.txt (H20): deja fuera las áreas con sesión y el pago, y apunta al sitemap.
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const base = env.BETTER_AUTH_URL.replace(/\/$/, '')
        const body = [
          'User-agent: *',
          'Disallow: /admin',
          'Disallow: /mis-cursos',
          'Disallow: /herramienta/',
          'Disallow: /checkout',
          'Disallow: /gracias',
          'Disallow: /api/',
          '',
          `Sitemap: ${base}/sitemap.xml`,
          '',
        ].join('\n')
        return new Response(body, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      },
    },
  },
})
