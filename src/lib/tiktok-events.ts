import { createHash } from 'node:crypto'

import type { ServerEvent } from '#/lib/meta-capi'
import { TIKTOK_EVENT } from '#/lib/tracking-events'

// API de eventos de TikTok (eventos del servidor), versión 2.0. Solo servidor.
// El `event_id` y el nombre deben ser los mismos que los del píxel del navegador: así TikTok
// cuenta una sola vez el evento que llega por los dos caminos.
// Los nombres de los campos salen de guías de terceros (no de la referencia oficial): confirmar
// en TikTok Events Manager → Test events antes de lanzar.
export const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3'

export type TikTokConfig = {
  pixelId: string
  token: string
  testCode?: string
  // Para pruebas: otra dirección en lugar de business-api.tiktok.com.
  apiUrl?: string
}

// TikTok pide el correo en minúsculas, sin espacios y con SHA-256.
const sha256 = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export function buildTikTokEvent(ev: ServerEvent) {
  const user: Record<string, unknown> = {}
  if (ev.email) user.email = sha256(ev.email)
  if (ev.ip) user.ip = ev.ip
  if (ev.userAgent) user.user_agent = ev.userAgent
  if (ev.ttp) user.ttp = ev.ttp
  if (ev.ttclid) user.ttclid = ev.ttclid

  const p = ev.params
  const properties: Record<string, unknown> = {}
  if (p?.value !== undefined) {
    properties.value = p.value
    properties.currency = p.currency ?? 'MXN'
  }
  if (p?.contentIds?.length) {
    properties.content_type = 'product'
    properties.contents = p.contentIds.map((id) => ({
      content_id: id,
      quantity: 1,
    }))
  }
  if (p?.contentName) properties.content_name = p.contentName

  return {
    event: TIKTOK_EVENT[ev.name],
    event_time: ev.time,
    event_id: ev.eventId,
    user,
    properties,
    ...(ev.sourceUrl ? { page: { url: ev.sourceUrl } } : {}),
  }
}

// Nunca lanza: un evento que no sale no debe tumbar una compra ni un registro.
export async function sendTikTokEvent(config: TikTokConfig, ev: ServerEvent) {
  try {
    const response = await fetch(
      `${config.apiUrl ?? TIKTOK_API_URL}/event/track/`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Access-Token': config.token,
        },
        body: JSON.stringify({
          event_source: 'web',
          event_source_id: config.pixelId,
          data: [buildTikTokEvent(ev)],
          ...(config.testCode ? { test_event_code: config.testCode } : {}),
        }),
      },
    )
    // TikTok responde 200 aun con error: el resultado va en `code` (0 = bien).
    const body = (await response.json().catch(() => null)) as {
      code?: number
      message?: string
    } | null
    if (!response.ok || (body?.code !== undefined && body.code !== 0)) {
      console.error(
        `[tiktok] TikTok rechazó el evento ${ev.name} (${response.status}):`,
        body?.message ?? '',
      )
      return false
    }
    return true
  } catch (error) {
    console.error(`[tiktok] No se pudo enviar el evento ${ev.name}:`, error)
    return false
  }
}
