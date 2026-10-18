import { randomUUID } from 'node:crypto'

import { createServerOnlyFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequestHeader,
  setCookie,
} from '@tanstack/react-start/server'

import { prisma } from '#/db'
import { isAdminRequest } from '#/lib/guards'

// Medición de una promoción (ver `PromotionEvent`): un navegador anónimo, identificado con una
// cookie propia, cuenta una vez por tipo de evento. No guarda nada personal.
const VISITOR_COOKIE = 'capagla_visitante'

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i

export const recordPromotionEvent = createServerOnlyFn(
  async (promotionId: string, kind: 'VISIT' | 'CART') => {
    try {
      // Ni la admin probando sus enlaces ni los robots cuentan.
      if (BOT.test(getRequestHeader('user-agent') ?? '')) return
      if (await isAdminRequest()) return

      let visitorId = getCookie(VISITOR_COOKIE)
      if (!visitorId) {
        visitorId = randomUUID()
        setCookie(VISITOR_COOKIE, visitorId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
        })
      }
      await prisma.promotionEvent.createMany({
        data: { promotionId, kind, visitorId },
        skipDuplicates: true,
      })
    } catch (error) {
      // Medir nunca debe romper la página.
      console.error('[promo] No se pudo registrar el evento:', error)
    }
  },
)
