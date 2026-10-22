import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'
import { RECIPE_URL_PREFIX, readRecipePdf } from '#/lib/recipe-pdfs'
import { canReadResource } from '#/lib/resource-access'

const notFound = () => new Response('Not Found', { status: 404 })

// Descarga del PDF de una receta. Se pide sesión y el acceso se comprueba en el servidor como el
// de cualquier recurso de lección (`canReadResource`): el PDF solo se baja desde la lección que lo
// trae, así que una receta dentro de un capítulo gratis es gratis y las demás piden el curso.
// Cualquier otro caso responde 404, como si el archivo no existiera.
export const Route = createFileRoute('/api/recetas/$name')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await readSession(request.headers)
        if (!session) return notFound()

        const resources = await prisma.resource.findMany({
          where: { url: RECIPE_URL_PREFIX + params.name },
          include: { item: true },
        })
        let resource = null
        for (const r of resources) {
          if (await canReadResource(session, r)) {
            resource = r
            break
          }
        }
        if (!resource) return notFound()

        const file = await readRecipePdf(params.name)
        if (!file) return notFound()
        const name = `${resource.name}.pdf`
        // ASCII en el parámetro simple y UTF-8 en `filename*`.
        const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
        return new Response(new Uint8Array(file), {
          headers: {
            'content-type': 'application/pdf',
            'content-length': String(file.length),
            'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, no-store',
          },
        })
      },
    },
  },
})
