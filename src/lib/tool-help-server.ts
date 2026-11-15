import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { getBunnyVideo, signedPlaybackUrl } from '#/lib/bunny'
import { requireAdmin } from '#/lib/guards'
import { requireTool } from '#/lib/tool-access'
import { HELP_KEYS, HELP_TOPICS } from '#/lib/tool-help'
import type { HelpKey } from '#/lib/tool-help'
import { hasModule } from '#/lib/tool-tiers'
import type { ToolTierInfo } from '#/lib/tool-tiers'

// Lado servidor de la ayuda de la herramienta (ver lib/tool-help.ts).

export type HelpVideo = { key: HelpKey; url: string; seconds: number }

// Los videos que ya existen y que su nivel puede ver (los de módulos del Completo, solo con él),
// con su URL firmada, y si la bienvenida A00 debe abrirse sola.
export const loadToolHelp = createServerOnlyFn(
  async (userId: string, tier: ToolTierInfo) => {
    const [rows, user] = await Promise.all([
      prisma.toolHelpVideo.findMany(),
      prisma.user.findUnique({
        where: { id: userId },
        select: { toolWelcomeSeenAt: true },
      }),
    ])
    const videos: HelpVideo[] = []
    for (const topic of HELP_TOPICS) {
      if (topic.module && !hasModule(tier, topic.module)) continue
      const row = rows.find((r) => r.key === topic.key)
      const url = row && signedPlaybackUrl(row.videoId)
      if (url) videos.push({ key: topic.key, url, seconds: row.seconds })
    }
    return {
      videos,
      welcome: !user?.toolWelcomeSeenAt && videos.some((v) => v.key === 'A00'),
    }
  },
)

// La alumna vio o cerró la bienvenida: no vuelve a abrirse sola (sigue en Ayuda).
export const markToolWelcomeSeen = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .handler(async ({ context }) => {
    await prisma.user.update({
      where: { id: context.userId },
      data: { toolWelcomeSeenAt: new Date() },
    })
  })

// ---------- Panel ----------

export const getAdminToolHelp = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const rows = await prisma.toolHelpVideo.findMany()
    return HELP_TOPICS.map((t) => ({
      key: t.key,
      title: t.title,
      videoId: rows.find((r) => r.key === t.key)?.videoId ?? null,
    }))
  })

// Asigna (o quita, con `videoId` vacío) el video de una sección. La duración sale de Bunny.
export const saveToolHelpVideo = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      key: z.enum(HELP_KEYS as [HelpKey, ...HelpKey[]]),
      videoId: z.string().trim(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.videoId) {
      await prisma.toolHelpVideo.deleteMany({ where: { key: data.key } })
      return {}
    }
    const video = await getBunnyVideo(data.videoId).catch(() => null)
    if (!video) return { error: 'Ese video no está en la biblioteca de Bunny.' }
    await prisma.toolHelpVideo.upsert({
      where: { key: data.key },
      update: { videoId: video.id, seconds: video.durationSec },
      create: { key: data.key, videoId: video.id, seconds: video.durationSec },
    })
    return {}
  })
