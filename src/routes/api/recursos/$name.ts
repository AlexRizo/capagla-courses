import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'
import { onlyFreeBlocks } from '#/lib/player-tree'
import { PRIVATE_URL_PREFIX, readPrivateUpload } from '#/lib/uploads'

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const notFound = () => new Response('Not Found', { status: 404 })

// Descarga de un recurso de capítulo o lección (recetario, plantillas). Se pide sesión y se
// comprueba en el servidor lo mismo que el reproductor: la admin entra siempre; una alumna,
// con el acceso del curso vigente o, si no, solo a lo que está dentro de un bloque gratis.
// Cualquier otro caso responde 404, como si el archivo no existiera.
export const Route = createFileRoute('/api/recursos/$name')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await readSession(request.headers)
        if (!session) return notFound()

        const resource = await prisma.resource.findFirst({
          where: { url: PRIVATE_URL_PREFIX + params.name },
          include: { item: true },
        })
        if (!resource) return notFound()

        if (session.user.role !== 'ADMIN') {
          const { productId } = resource.item
          const course = await prisma.product.findUnique({
            where: { id: productId },
          })
          if (course?.status !== 'PUBLISHED') return notFound()

          const enrollment = await prisma.enrollment.findUnique({
            where: {
              userId_productId: { userId: session.user.id, productId },
            },
          })
          if (!enrollment || enrollment.expiresAt <= new Date()) {
            const items = await prisma.courseItem.findMany({
              where: { productId },
            })
            if (!onlyFreeBlocks(items).some((i) => i.id === resource.itemId)) {
              return notFound()
            }
          }
        }

        const file = await readPrivateUpload(params.name)
        if (!file) return notFound()
        const ext = params.name.split('.').pop() ?? ''
        // Nombre original para guardar; ASCII en el parámetro simple y UTF-8 en `filename*`.
        const ascii = resource.name
          .replace(/[^\x20-\x7e]/g, '_')
          .replace(/["\\]/g, '_')
        return new Response(new Uint8Array(file), {
          headers: {
            'content-type': TYPES[ext] ?? 'application/octet-stream',
            'content-length': String(file.length),
            'content-disposition': `${ext === 'pdf' ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(resource.name)}`,
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, no-store',
          },
        })
      },
    },
  },
})
