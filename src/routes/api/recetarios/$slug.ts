import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'
import { readRecipeBook } from '#/lib/recipe-books'

const notFound = () => new Response('Not Found', { status: 404 })

// Descarga del recetario PDF del curso. Se pide sesión y se comprueba en el servidor, igual
// que el reproductor: la admin entra siempre; una alumna solo con el curso publicado y su
// acceso vigente (el recetario no está en la clase gratis). Cualquier otro caso responde
// 404, como si el archivo no existiera.
export const Route = createFileRoute('/api/recetarios/$slug')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await readSession(request.headers)
        if (!session) return notFound()

        const course = await prisma.product.findUnique({
          where: { slug: params.slug },
        })
        if (course?.kind !== 'COURSE') return notFound()

        if (session.user.role !== 'ADMIN') {
          if (course.status !== 'PUBLISHED') return notFound()
          const enrollment = await prisma.enrollment.findUnique({
            where: {
              userId_productId: {
                userId: session.user.id,
                productId: course.id,
              },
            },
          })
          if (!enrollment || enrollment.expiresAt <= new Date()) {
            return notFound()
          }
        }

        const file = await readRecipeBook(course.slug)
        if (!file) return notFound()
        const name = `Recetario - ${course.name}.pdf`
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
