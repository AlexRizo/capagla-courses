import { createServerFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequestHeader,
  getRequestHeaders,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { hasPlaceholderName } from '#/lib/account-name'
import { ATTRIBUTION_COOKIE, parseAttribution } from '#/lib/attribution'
import { readSession } from '#/lib/auth'
import { CONSENT_COOKIE, parseConsent } from '#/lib/consent'
import { isAdminRequest } from '#/lib/guards'
import {
  clientIp,
  dispatchServerEvent,
  eventFromRequest,
  loadPlatforms,
  shouldTrack,
} from '#/lib/track-core'
import { validTrackingId } from '#/lib/tracking-ids'
import { SERVER_EVENTS } from '#/lib/tracking-events'

// IDs públicos de las plataformas para cargar los píxeles del navegador (los tokens nunca salen
// del servidor). Sin ID, nada se carga. A la admin no se le carga ningún píxel: sus visitas de
// prueba no cuentan. Si la base falla, el sitio sigue sin medición.
export const getTrackingConfig = createServerFn().handler(async () => {
  const none = {
    metaPixelId: null as string | null,
    tiktokPixelId: null as string | null,
    ga4MeasurementId: null as string | null,
  }
  try {
    if (await isAdminRequest()) return none
    const row = await prisma.marketingSettings.findUnique({
      where: { id: 'main' },
      select: {
        metaPixelId: true,
        tiktokPixelId: true,
        ga4MeasurementId: true,
      },
    })
    return {
      metaPixelId: validTrackingId('meta', row?.metaPixelId),
      tiktokPixelId: validTrackingId('tiktok', row?.tiktokPixelId),
      ga4MeasurementId: validTrackingId('ga4', row?.ga4MeasurementId),
    }
  } catch (error) {
    console.error('[marketing] No se pudo leer la configuración:', error)
    return none
  }
})

const text = (max: number) => z.string().trim().min(1).max(max)

// El navegador avisa que ocurrió un evento y el servidor lo manda también a las plataformas
// (con el mismo `eventId` que el píxel, para que no se cuente dos veces). Solo si la persona
// aceptó las cookies; la IP, el navegador y las cookies del píxel salen de la petición.
export const trackServerEvent = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.enum(SERVER_EVENTS),
      eventId: text(64),
      url: text(500),
      email: z.string().trim().email().max(200).optional(),
      fullName: text(100).optional(),
      params: z
        .object({
          value: z.number().min(0).max(1_000_000).optional(),
          currency: z.string().length(3).optional(),
          contentName: text(200).optional(),
          contentIds: z.array(text(100)).max(10).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const userAgent = getRequestHeader('user-agent')
      if (
        !shouldTrack({
          consent: parseConsent(getCookie(CONSENT_COOKIE)),
          isAdmin: await isAdminRequest(),
          userAgent,
        })
      ) {
        return { sent: false }
      }
      const platforms = await loadPlatforms()
      if (!platforms.meta && !platforms.tiktok) return { sent: false }

      const session = await readSession(getRequestHeaders())
      const event = eventFromRequest(data, {
        ip: clientIp(getRequestHeader('x-forwarded-for')),
        userAgent,
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
        ttp: getCookie('_ttp'),
        attribution: parseAttribution(getCookie(ATTRIBUTION_COOKIE)),
        sessionEmail: session?.user.email,
        // Una cuenta de clase gratis sin nombre real no aporta un nombre confiable.
        sessionName:
          session && !hasPlaceholderName(session.user)
            ? session.user.name
            : undefined,
      })
      return { sent: await dispatchServerEvent(platforms, event) }
    } catch (error) {
      // Medir nunca debe romper la página.
      console.error('[marketing] No se pudo enviar el evento:', error)
      return { sent: false }
    }
  })
