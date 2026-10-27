import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'
import {
  UPLOAD_KINDS,
  UploadError,
  removeUpload,
  storeUpload,
  uploadsAvailable,
} from '#/lib/uploads'

const MAX_RESOURCES_PER_ITEM = 20

const json = (body: unknown, status = 200) => Response.json(body, { status })

// Subida de archivos del panel (solo admin). Un envío = una acción:
//  - target "cover": `id` es el slug del curso; reemplaza su portada.
//  - target "poster": `id` es una lección de video; reemplaza la portada que se ve antes de
//    reproducir el video.
//  - target "resource": `id` es un capítulo o lección; agrega un recurso.
// Van a Bunny Storage; sin él, a disco local solo en desarrollo (ver `lib/uploads.ts`).
export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await readSession(request.headers)
        if (session?.user.role !== 'ADMIN') {
          return new Response('Not Found', { status: 404 })
        }
        if (!uploadsAvailable()) {
          return json(
            { error: 'La subida de archivos aún no está disponible.' },
            501,
          )
        }

        // Se rechaza por el tamaño declarado antes de leer el cuerpo.
        const limit = UPLOAD_KINDS.file.maxBytes + 1024 * 1024
        if (Number(request.headers.get('content-length')) > limit) {
          return json({ error: 'El archivo es demasiado grande.' }, 413)
        }

        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        const target = form?.get('target')
        const id = form?.get('id')
        if (!(file instanceof File) || typeof id !== 'string' || !id) {
          return json({ error: 'Solicitud inválida.' }, 400)
        }

        try {
          if (target === 'cover') {
            const course = await prisma.product.findUnique({
              where: { slug: id },
            })
            if (course?.kind !== 'COURSE')
              return json({ error: 'No existe.' }, 404)
            const saved = await storeUpload(file, 'image')
            await prisma.product.update({
              where: { id: course.id },
              data: { coverUrl: saved.url },
            })
            await removeUpload(course.coverUrl)
            return json({ url: saved.url })
          }

          if (target === 'poster') {
            const lesson = await prisma.courseItem.findUnique({
              where: { id },
            })
            if (lesson?.kind !== 'LESSON' || lesson.lessonType !== 'VIDEO') {
              return json({ error: 'No existe.' }, 404)
            }
            const saved = await storeUpload(file, 'image')
            await prisma.courseItem.update({
              where: { id: lesson.id },
              data: { posterUrl: saved.url },
            })
            await removeUpload(lesson.posterUrl)
            return json({ url: saved.url })
          }

          if (target === 'resource') {
            const item = await prisma.courseItem.findUnique({
              where: { id },
              include: { _count: { select: { resources: true } } },
            })
            if (!item || (item.kind !== 'CHAPTER' && item.kind !== 'LESSON')) {
              return json({ error: 'No existe.' }, 404)
            }
            if (item._count.resources >= MAX_RESOURCES_PER_ITEM) {
              return json(
                {
                  error: `Máximo ${MAX_RESOURCES_PER_ITEM} archivos por elemento.`,
                },
                400,
              )
            }
            const saved = await storeUpload(file, 'file')
            const last = await prisma.resource.aggregate({
              where: { itemId: id },
              _max: { position: true },
            })
            const resource = await prisma.resource.create({
              data: {
                itemId: id,
                name: saved.name,
                url: saved.url,
                position: (last._max.position ?? -1) + 1,
              },
            })
            return json({ id: resource.id, url: resource.url })
          }
        } catch (error) {
          if (error instanceof UploadError) {
            return json({ error: error.message }, 400)
          }
          console.error('[subida] Falló:', error)
          return json({ error: 'No se pudo subir el archivo.' }, 500)
        }

        return json({ error: 'Solicitud inválida.' }, 400)
      },
    },
  },
})
