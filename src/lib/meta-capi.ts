import { createHash } from 'node:crypto'

import type { EventName, TrackParams } from '#/lib/tracking-events'

// API de conversiones de Meta (eventos del servidor). Solo servidor.
// Doc: developers.facebook.com/documentation/ads-commerce/conversions-api
// El `event_id` y el nombre deben ser los mismos que los del píxel del navegador: así Meta
// cuenta una sola vez el evento que llega por los dos caminos.
export const META_API_URL = 'https://graph.facebook.com/v26.0'

export type ServerEvent = {
  name: EventName
  eventId: string
  // Segundos desde 1970.
  time: number
  sourceUrl?: string
  email?: string
  fullName?: string
  ip?: string
  userAgent?: string
  // Cookies del píxel (`_fbp`, `_fbc`): no se cifran.
  fbp?: string
  fbc?: string
  // TikTok: cookie del píxel (`_ttp`) y clic del anuncio (`ttclid`); tampoco se cifran.
  ttp?: string
  ttclid?: string
  params?: TrackParams
}

export type MetaConfig = {
  pixelId: string
  token: string
  testCode?: string
  // Para pruebas: otra dirección en lugar de graph.facebook.com.
  apiUrl?: string
}

// Meta pide los datos personales en minúsculas, sin espacios y con SHA-256.
const sha256 = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export function buildMetaEvent(ev: ServerEvent) {
  const user: Record<string, unknown> = {}
  if (ev.email) user.em = [sha256(ev.email)]
  const [first, ...rest] = (ev.fullName ?? '').trim().split(/\s+/)
  if (first) user.fn = [sha256(first)]
  if (rest.length) user.ln = [sha256(rest.join(' '))]
  if (ev.ip) user.client_ip_address = ev.ip
  if (ev.userAgent) user.client_user_agent = ev.userAgent
  if (ev.fbp) user.fbp = ev.fbp
  if (ev.fbc) user.fbc = ev.fbc

  const p = ev.params
  const custom: Record<string, unknown> = {}
  if (p?.value !== undefined) {
    custom.value = p.value
    custom.currency = p.currency ?? 'MXN'
  }
  if (p?.contentName) custom.content_name = p.contentName
  if (p?.contentIds?.length) {
    custom.content_ids = p.contentIds
    custom.content_type = 'product'
  }

  return {
    event_name: ev.name,
    event_time: ev.time,
    event_id: ev.eventId,
    action_source: 'website',
    ...(ev.sourceUrl ? { event_source_url: ev.sourceUrl } : {}),
    user_data: user,
    ...(Object.keys(custom).length ? { custom_data: custom } : {}),
  }
}

// Nunca lanza: un evento que no sale no debe tumbar una compra ni un registro.
export async function sendMetaEvent(config: MetaConfig, ev: ServerEvent) {
  try {
    const response = await fetch(
      `${config.apiUrl ?? META_API_URL}/${encodeURIComponent(config.pixelId)}/events`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data: [buildMetaEvent(ev)],
          access_token: config.token,
          ...(config.testCode ? { test_event_code: config.testCode } : {}),
        }),
      },
    )
    if (!response.ok) {
      console.error(
        `[meta] Meta rechazó el evento ${ev.name} (${response.status}):`,
        await response.text(),
      )
      return false
    }
    return true
  } catch (error) {
    console.error(`[meta] No se pudo enviar el evento ${ev.name}:`, error)
    return false
  }
}
