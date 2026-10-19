// Eventos de marketing (maqueta del panel, Marketing › Eventos que se envían). Nombres de Meta;
// TikTok usa los suyos (`Lead` → `SubmitForm`, `Purchase` → `CompletePayment`).
//  - PageView y ViewContent: solo el navegador.
//  - Lead, AddToCart e InitiateCheckout: navegador y servidor con el mismo `event_id`.
//  - Purchase: el servidor al confirmar el pago (Stripe) y la página de gracias.
export const EVENT_NAMES = [
  'PageView',
  'ViewContent',
  'Lead',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
] as const
export type EventName = (typeof EVENT_NAMES)[number]

// Los que el navegador le pide al servidor que también envíe (Purchase lo manda el servidor solo).
export const SERVER_EVENTS = ['Lead', 'AddToCart', 'InitiateCheckout'] as const
export type ServerEventName = (typeof SERVER_EVENTS)[number]

// El mismo `event_id` en el píxel de la página de gracias y en el evento del servidor: así la
// plataforma cuenta una sola vez la compra aunque llegue por los dos caminos.
export const purchaseEventId = (orderId: string) => `purchase-${orderId}`

// Nombre de cada evento en TikTok. La maqueta del panel dice `CompletePayment` para la compra, pero
// ese es el nombre antiguo: TikTok ya la llama `Purchase` y su propio píxel convierte
// `CompletePayment` a `Purchase` al enviarla. Como TikTok solo deduplica si el nombre y el
// `event_id` coinciden en el píxel y en el servidor, los dos usan `Purchase`.
// `PageView` es `ttq.page()` en el navegador.
export const TIKTOK_EVENT: Record<EventName, string> = {
  PageView: 'Pageview',
  ViewContent: 'ViewContent',
  Lead: 'SubmitForm',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'Purchase',
}

export type TrackParams = {
  value?: number
  currency?: string
  contentName?: string
  contentIds?: string[]
  // Id de la orden (compra): GA4 deduplica la compra por este valor.
  transactionId?: string
}
