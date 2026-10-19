import { prisma } from '#/db'
import { env } from '#/env'
import { attributionSchema } from '#/lib/attribution'
import type { ServerEvent } from '#/lib/meta-capi'
import {
  dispatchServerEvent,
  loadPlatforms,
  parseTrackingContext,
  resolveFbc,
} from '#/lib/track-core'
import { purchaseEventId } from '#/lib/tracking-events'

// Evento Purchase del servidor (Meta). Lo dispara `completeOrder` al confirmarse el pago, con el
// `event_id` que también usa el píxel de la página de gracias. Solo servidor.

type PaidOrder = {
  id: string
  email: string
  name: string
  amountMxn: number
  paidAt: Date | null
  attribution: unknown
  trackingContext: unknown
  items: { product: { slug: string; name: string } }[]
}

export function buildPurchaseEvent(order: PaidOrder): ServerEvent {
  const ctx = parseTrackingContext(order.trackingContext)
  const time = order.paidAt ?? new Date()
  const attribution = attributionSchema.safeParse(order.attribution).data
  return {
    name: 'Purchase',
    eventId: purchaseEventId(order.id),
    time: Math.floor(time.getTime() / 1000),
    sourceUrl: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/gracias`,
    email: order.email,
    fullName: order.name,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    fbp: ctx.fbp,
    fbc: resolveFbc(ctx.fbc, attribution ?? null, time.getTime()),
    ttp: ctx.ttp,
    ttclid: attribution?.ttclid,
    params: {
      value: order.amountMxn,
      currency: 'MXN',
      contentIds: order.items.map((i) => i.product.slug),
      contentName: order.items.map((i) => i.product.name).join(', '),
    },
  }
}

// Manda el Purchase de una orden pagada. No manda nada si la persona no aceptó las cookies al
// pagar, si es una renovación (no viene de un anuncio) o si compró una admin probando.
// Nunca lanza: medir no debe romper una compra.
export async function trackPurchase(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, user: true },
    })
    if (order?.status !== 'PAID' || order.renewal) return false
    if (order.marketingConsent !== true) return false
    if (order.user?.role === 'ADMIN') return false
    const platforms = await loadPlatforms()
    if (!platforms.meta && !platforms.tiktok) return false
    return await dispatchServerEvent(platforms, buildPurchaseEvent(order))
  } catch (error) {
    console.error('[marketing] No se pudo enviar la compra:', error)
    return false
  }
}
