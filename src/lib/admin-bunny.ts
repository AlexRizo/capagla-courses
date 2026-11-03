import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import {
  MAX_UPLOAD_BYTES,
  createBunnyUpload,
  deleteBunnyVideo,
  deleteEmptyBunnyVideo,
  isBunnyId,
  listBunnyVideos,
  titleFromFilename,
} from '#/lib/bunny'
import { env } from '#/env'
import { bunnyVideoUsage, bunnyVideoUsedBy } from '#/lib/bunny-usage'
import { requireAdmin } from '#/lib/guards'

// Videos de la biblioteca de Bunny para elegir uno en una lección, con la lección que ya lo usa.
export const getBunnyVideos = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_API_KEY) {
      return { configured: false as const }
    }
    try {
      const [videos, usedBy] = await Promise.all([
        listBunnyVideos(),
        bunnyVideoUsage(),
      ])
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

// "Borrar" un video del selector: lo quita de la biblioteca de Bunny (no se puede deshacer). Solo si
// ninguna lección ni la intro de una promoción lo usa; el servidor lo comprueba aunque la pantalla
// ya lo oculte.
export const deleteUnusedVideo = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().refine(isBunnyId) }))
  .handler(async ({ data }) => {
    const usedBy = await bunnyVideoUsedBy(data.id)
    if (usedBy) {
      return { deleted: false as const, error: `Lo usa ${usedBy}.` }
    }
    try {
      await deleteBunnyVideo(data.id)
      return { deleted: true as const }
    } catch {
      return {
        deleted: false as const,
        error: 'No se pudo borrar. Revisa Bunny e intenta de nuevo.',
      }
    }
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
