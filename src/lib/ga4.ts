import type { EventName, TrackParams } from '#/lib/tracking-events'

// Google Analytics 4 (solo navegador: la pantalla de Marketing pide únicamente el ID de
// medición, y los eventos del servidor de GA4 necesitarían además una clave de API).
// Nombres de los eventos recomendados de GA4 para cada evento de Capagla.
export const GA4_EVENT: Record<EventName, string> = {
  PageView: 'page_view',
  ViewContent: 'view_item',
  Lead: 'generate_lead',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
}

// Parámetros del evento. GA4 cuenta una compra una sola vez por `transaction_id`, así que
// la de gracias lleva el id de la orden.
export function ga4Params(name: EventName, p?: TrackParams) {
  const params: Record<string, unknown> = {}
  if (p?.value !== undefined) {
    params.value = p.value
    params.currency = p.currency ?? 'MXN'
  }
  if (p?.contentIds?.length) {
    // Con un solo producto el nombre es el suyo; con varios (una compra) solo va el id.
    const oneName = p.contentIds.length === 1 ? p.contentName : undefined
    params.items = p.contentIds.map((id) => ({
      item_id: id,
      item_name: oneName ?? id,
      quantity: 1,
    }))
  }
  if (name === 'Purchase' && p?.transactionId) {
    params.transaction_id = p.transactionId
  }
  return params
}
