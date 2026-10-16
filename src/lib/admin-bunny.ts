import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { listBunnyVideos } from '#/lib/bunny'
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
