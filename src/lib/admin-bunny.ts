import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import {
  MAX_UPLOAD_BYTES,
  createBunnyUpload,
  deleteEmptyBunnyVideo,
  isBunnyId,
  listBunnyVideos,
  titleFromFilename,
} from '#/lib/bunny'
import { env } from '#/env'
import { requireAdmin } from '#/lib/guards'

// Videos de la biblioteca de Bunny para elegir uno en una lección, con la lección que ya lo usa.
export const getBunnyVideos = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_API_KEY) {
      return { configured: false as const }
    }
    try {
      const [videos, used] = await Promise.all([
        listBunnyVideos(),
        prisma.courseItem.findMany({
          where: { bunnyVideoId: { not: null } },
          select: { bunnyVideoId: true, title: true },
        }),
      ])
      const usedBy = new Map(used.map((u) => [u.bunnyVideoId, u.title]))
      return {
        configured: true as const,
        videos: videos.map((v) => ({ ...v, usedBy: usedBy.get(v.id) ?? null })),
      }
    } catch {
      return { configured: true as const, videos: null }
    }
  })

// Subir un video nuevo desde el panel: crea el video vacío en Bunny y devuelve lo que el
// navegador necesita para mandarle el archivo directo (TUS). No llega el archivo al servidor.
export const startVideoUpload = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      filename: z.string().trim().min(1).max(255),
      type: z.string().startsWith('video/'),
      size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    }),
  )
  .handler(async ({ data }) => {
    if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_API_KEY) {
      throw new Error('Bunny no está configurado.')
    }
    return createBunnyUpload(titleFromFilename(data.filename))
  })

// Subida cancelada o fallida: quita el video vacío para que no quede en la biblioteca.
// Solo borra uno sin archivo y que ninguna lección ni promoción use.
export const cancelVideoUpload = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().refine(isBunnyId) }))
  .handler(async ({ data }) => {
    const [lesson, promotion] = await Promise.all([
      prisma.courseItem.findFirst({ where: { bunnyVideoId: data.id } }),
      prisma.promotion.findFirst({ where: { introVideoId: data.id } }),
    ])
    if (lesson || promotion) return { deleted: false }
    return { deleted: await deleteEmptyBunnyVideo(data.id).catch(() => false) }
  })
