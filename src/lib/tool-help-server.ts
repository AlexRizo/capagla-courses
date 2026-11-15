import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { fetchCaption, getBunnyVideo, signedPlaybackUrl } from '#/lib/bunny'
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

export type HelpCaption = { srclang: string; label: string; vtt: string }

// Subtítulos por video, guardados unos minutos para no preguntarle a Bunny en cada clic.
const CAPTIONS_TTL_MS = 10 * 60 * 1000
const captionsCache = new Map<string, { at: number; tracks: HelpCaption[] }>()

async function captionsFor(videoId: string) {
  const cached = captionsCache.get(videoId)
  if (cached && Date.now() - cached.at < CAPTIONS_TTL_MS) return cached.tracks
  const video = await getBunnyVideo(videoId)
  const tracks: HelpCaption[] = []
  for (const c of video?.captions ?? []) {
    const vtt = await fetchCaption(videoId, c.srclang)
    if (vtt) tracks.push({ srclang: c.srclang, label: c.label, vtt })
  }
  captionsCache.set(videoId, { at: Date.now(), tracks })
  return tracks
}

// Los subtítulos (VTT de Bunny) del video de una sección, para el botón CC del reproductor.
// Sin subtítulos, o si Bunny falla, el video se ve igual, sin CC.
export const getToolHelpCaptions = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ key: z.enum(HELP_KEYS as [HelpKey, ...HelpKey[]]) }))
  .handler(async ({ data, context }) => {
    const topic = HELP_TOPICS.find((t) => t.key === data.key)
    if (topic?.module && !hasModule(context.tier, topic.module)) return []
    const row = await prisma.toolHelpVideo.findUnique({
      where: { key: data.key },
    })
    if (!row) return []
    return captionsFor(row.videoId).catch(() => [])
  })

// La bienvenida se abrió: no vuelve a abrirse sola (sigue en Ayuda). Se marca al abrirla, no al
// cerrarla, para que no vuelva a salir si la alumna cierra la pestaña o entra desde otro equipo.
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
