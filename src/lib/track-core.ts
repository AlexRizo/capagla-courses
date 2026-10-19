import { z } from 'zod'

import { prisma } from '#/db'
import { env } from '#/env'
import type { Attribution } from '#/lib/attribution'
import type { Consent } from '#/lib/consent'
import { sendMetaEvent } from '#/lib/meta-capi'
import type { MetaConfig, ServerEvent } from '#/lib/meta-capi'
import { sendTikTokEvent } from '#/lib/tiktok-events'
import type { TikTokConfig } from '#/lib/tiktok-events'
import type { ServerEventName, TrackParams } from '#/lib/tracking-events'

// Eventos de marketing del servidor: arma el evento con lo que sabe la petición y lo manda a
// las plataformas conectadas en Marketing. Solo servidor.

export type Platforms = { meta: MetaConfig | null; tiktok: TikTokConfig | null }

// Una plataforma cuenta como conectada con su ID de píxel y su token (igual que la insignia de
// la pantalla de Marketing).
export async function loadPlatforms(): Promise<Platforms> {
  const row = await prisma.marketingSettings.findUnique({
    where: { id: 'main' },
  })
  return {
    meta:
      row?.metaPixelId && row.metaToken
        ? {
            pixelId: row.metaPixelId,
            token: row.metaToken,
            testCode: row.metaTestCode || undefined,
            apiUrl: env.META_API_URL,
          }
        : null,
    tiktok:
      row?.tiktokPixelId && row.tiktokToken
        ? {
            pixelId: row.tiktokPixelId,
            token: row.tiktokToken,
            testCode: row.tiktokTestCode || undefined,
            apiUrl: env.TIKTOK_API_URL,
          }
        : null,
  }
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i

// Solo se manda con las cookies de medición aceptadas; ni la admin probando ni los robots cuentan.
export const shouldTrack = (c: {
  consent: Consent | null
  isAdmin: boolean
  userAgent?: string
}) => c.consent === 'accepted' && !c.isAdmin && !BOT.test(c.userAgent ?? '')

// Lo que se guarda del navegador al pagar para el evento Purchase (ver `Order.trackingContext`).
export const trackingContextSchema = z.object({
  ip: z.string().max(100).optional(),
  userAgent: z.string().max(500).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(300).optional(),
  ttp: z.string().max(200).optional(),
})
export type TrackingContext = z.infer<typeof trackingContextSchema>

export const parseTrackingContext = (raw: unknown): TrackingContext =>
  trackingContextSchema.safeParse(raw).data ?? {}

export type TrackInput = {
  name: ServerEventName
  eventId: string
  url: string
  email?: string
  fullName?: string
  params?: TrackParams
}

export type RequestContext = {
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
  ttp?: string
  attribution: Attribution | null
  // Cuenta con sesión: de ahí sale el correo si el navegador no lo manda.
  sessionEmail?: string
  sessionName?: string
}

// IP del cliente detrás del proxy (Railway): la primera de `x-forwarded-for`.
export function clientIp(forwardedFor: string | null | undefined) {
  return forwardedFor?.split(',')[0]?.trim() || undefined
}

// `fbc` es la cookie del píxel; sin ella se arma con el clic de Meta (`fbclid`) guardado en la
// atribución, con el formato `fb.1.<momento del clic en ms>.<fbclid>`.
export function resolveFbc(
  fbc: string | undefined,
  attribution: Attribution | null,
  now: number,
) {
  if (fbc) return fbc
  if (!attribution?.fbclid) return undefined
  const clickedAt = attribution.at ? Date.parse(attribution.at) : NaN
  return `fb.1.${Number.isNaN(clickedAt) ? now : clickedAt}.${attribution.fbclid}`
}

export function eventFromRequest(
  input: TrackInput,
  ctx: RequestContext,
  now = Date.now(),
): ServerEvent {
  return {
    name: input.name,
    eventId: input.eventId,
    time: Math.floor(now / 1000),
    sourceUrl: input.url,
    email: input.email ?? ctx.sessionEmail,
    fullName: input.fullName ?? ctx.sessionName,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    fbp: ctx.fbp,
    fbc: resolveFbc(ctx.fbc, ctx.attribution, now),
    ttp: ctx.ttp,
    ttclid: ctx.attribution?.ttclid,
    params: input.params,
  }
}

// Manda el evento a cada plataforma conectada; true si alguna lo aceptó.
export async function dispatchServerEvent(
  platforms: Platforms,
  event: ServerEvent,
) {
  const results = await Promise.all([
    platforms.meta ? sendMetaEvent(platforms.meta, event) : false,
    platforms.tiktok ? sendTikTokEvent(platforms.tiktok, event) : false,
  ])
  return results.some(Boolean)
}
