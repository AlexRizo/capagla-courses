import { CONSENT_EVENT, getConsent } from '#/lib/consent'
import { trackServerEvent } from '#/lib/track'
import { GA4_EVENT, ga4Params } from '#/lib/ga4'
import { SERVER_EVENTS, TIKTOK_EVENT } from '#/lib/tracking-events'
import type { EventName, TrackParams } from '#/lib/tracking-events'

// Eventos de marketing en el navegador. Los píxeles solo se cargan si la persona aceptó las
// cookies (ver `lib/consent.ts`); sin elección todavía, los eventos esperan en una cola corta
// que se envía si acepta y se descarta si rechaza.
type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[]
  loaded?: boolean
}
// `ttq` guarda en una lista lo que se le pide hasta que carga su script.
type Ttq = unknown[] & Record<string, any>
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: Fbq
    _fbq?: Fbq
    ttq?: Ttq
    TiktokAnalyticsObject?: string
  }
}

type Pending = {
  name: EventName
  eventId: string
  email?: string
  fullName?: string
  params?: TrackParams
  url: string
}

const MAX_PENDING = 10
let pending: Pending[] = []
let metaReady = false
let metaId: string | null = null
let tiktokReady = false
let tiktokId: string | null = null
let ga4Ready = false
let ga4Id: string | null = null
// Con algún píxel cargado ya se pueden enviar eventos (los del servidor también salen).
const ready = () => metaReady || tiktokReady || ga4Ready

// Carga el píxel de Meta (el código oficial) y lo inicia con su ID.
function loadMeta(pixelId: string) {
  if (window.fbq) return
  const fbq: Fbq = function (...args: unknown[]) {
    // @ts-expect-error `callMethod` lo agrega fbevents.js al cargar
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue?.push(args)
  }
  fbq.queue = []
  fbq.loaded = true
  window.fbq = fbq
  window._fbq = fbq
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('init', pixelId)
}

const TTQ_METHODS = [
  'page',
  'track',
  'identify',
  'instances',
  'debug',
  'on',
  'off',
  'once',
  'ready',
  'alias',
  'group',
  'enableCookie',
  'disableCookie',
  'holdConsent',
  'revokeConsent',
  'grantConsent',
]

// Carga el píxel de TikTok (el código oficial) y lo inicia con su ID.
function loadTikTok(pixelId: string) {
  if (window.ttq) return
  window.TiktokAnalyticsObject = 'ttq'
  const ttq = [] as unknown as Ttq
  window.ttq = ttq
  // Hasta que cargue el script, cada llamada queda en la lista.
  const defer = (target: Ttq, method: string) => {
    target[method] = (...args: unknown[]) => {
      target.push([method, ...args])
    }
  }
  TTQ_METHODS.forEach((method) => defer(ttq, method))
  ttq.instance = (id: string) => {
    const instance = (ttq._i?.[id] ?? []) as Ttq
    TTQ_METHODS.forEach((method) => defer(instance, method))
    return instance
  }
  ttq.load = (id: string, options?: unknown) => {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js'
    ttq._i = ttq._i ?? {}
    ttq._i[id] = []
    ttq._i[id]._u = url
    ttq._t = ttq._t ?? {}
    ttq._t[id] = Date.now()
    ttq._o = ttq._o ?? {}
    ttq._o[id] = options ?? {}
    const script = document.createElement('script')
    script.async = true
    script.src = `${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`
    document.head.appendChild(script)
  }
  ttq.load(pixelId)
}

// Carga Google Analytics 4 (código oficial de gtag.js). Los eventos se mandan a mano
// (`send_page_view: false`): una vista por página, también al navegar sin recargar.
function loadGA4(measurementId: string) {
  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    // gtag.js espera el objeto `arguments`, no una lista.
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments)
    }
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
}

const tiktokData = (p?: TrackParams) => ({
  ...(p?.value !== undefined
    ? { value: p.value, currency: p.currency ?? 'MXN' }
    : {}),
  ...(p?.contentIds?.length
    ? {
        content_type: 'product',
        contents: p.contentIds.map((id) => ({
          content_id: id,
          content_name: p.contentName,
          quantity: 1,
        })),
      }
    : {}),
  ...(p?.contentName ? { content_name: p.contentName } : {}),
})

const customData = (p?: TrackParams) => ({
  ...(p?.value !== undefined
    ? { value: p.value, currency: p.currency ?? 'MXN' }
    : {}),
  ...(p?.contentName ? { content_name: p.contentName } : {}),
  ...(p?.contentIds?.length
    ? { content_ids: p.contentIds, content_type: 'product' }
    : {}),
})

function send(ev: Pending) {
  if (metaReady && window.fbq) {
    // El mismo `eventID` que recibe el servidor: Meta cuenta una sola vez el evento.
    window.fbq('track', ev.name, customData(ev.params), {
      eventID: ev.eventId,
    })
  }
  if (tiktokReady && window.ttq) {
    // Con el mismo `event_id` que el servidor (TikTok también lo deduplica).
    if (ev.name === 'PageView') window.ttq.page()
    else {
      window.ttq.track(TIKTOK_EVENT[ev.name], tiktokData(ev.params), {
        event_id: ev.eventId,
      })
    }
  }
  if (ga4Ready && window.gtag) {
    window.gtag('event', GA4_EVENT[ev.name], {
      ...ga4Params(ev.name, ev.params),
      ...(ev.name === 'PageView'
        ? { page_location: ev.url, page_title: document.title }
        : {}),
    })
  }
  if ((SERVER_EVENTS as readonly string[]).includes(ev.name)) {
    trackServerEvent({
      data: {
        name: ev.name as (typeof SERVER_EVENTS)[number],
        eventId: ev.eventId,
        url: ev.url,
        email: ev.email,
        fullName: ev.fullName,
        params: ev.params,
      },
    }).catch(() => {})
  }
}

// Con las cookies aceptadas y el píxel listo se envía lo que esperaba.
function flush() {
  if (getConsent() !== 'accepted' || !ready()) return
  const queued = pending
  pending = []
  queued.forEach(send)
}

// Lo llama el componente de seguimiento con los IDs públicos y cada vez que cambia la elección.
export function initTracking(config: {
  metaPixelId: string | null
  tiktokPixelId: string | null
  ga4MeasurementId: string | null
}) {
  const consent = getConsent()
  if (consent === 'rejected') {
    pending = []
    return
  }
  if (consent !== 'accepted') return
  if (config.metaPixelId && metaId !== config.metaPixelId) {
    metaId = config.metaPixelId
    loadMeta(config.metaPixelId)
    metaReady = true
  }
  if (config.tiktokPixelId && tiktokId !== config.tiktokPixelId) {
    tiktokId = config.tiktokPixelId
    loadTikTok(config.tiktokPixelId)
    tiktokReady = true
  }
  if (config.ga4MeasurementId && ga4Id !== config.ga4MeasurementId) {
    ga4Id = config.ga4MeasurementId
    loadGA4(config.ga4MeasurementId)
    ga4Ready = true
  }
  flush()
}

export function onConsentChange(handler: () => void) {
  window.addEventListener(CONSENT_EVENT, handler)
  return () => window.removeEventListener(CONSENT_EVENT, handler)
}

// Un evento idéntico (mismo nombre, página y datos) en menos de 2 s no se repite: en desarrollo
// React corre cada efecto dos veces y un doble clic haría lo mismo; Meta contaría las dos.
const DUPLICATE_MS = 2000
const recent = new Map<string, { at: number; eventId: string }>()

// Registra un evento. Devuelve su `eventId` (para compartirlo con otros envíos del mismo evento).
export function track(
  name: EventName,
  opts: {
    eventId?: string
    email?: string
    fullName?: string
    params?: TrackParams
  } = {},
) {
  const eventId = opts.eventId ?? crypto.randomUUID()
  if (typeof window === 'undefined') return eventId
  const key = JSON.stringify([name, window.location.href, opts.params])
  const last = recent.get(key)
  if (last && Date.now() - last.at < DUPLICATE_MS) return last.eventId
  recent.set(key, { at: Date.now(), eventId })
  const consent = getConsent()
  if (consent === 'rejected') return eventId
  const ev: Pending = {
    name,
    eventId,
    email: opts.email,
    fullName: opts.fullName,
    params: opts.params,
    url: window.location.href.slice(0, 500),
  }
  if (consent === 'accepted' && ready()) return (send(ev), eventId)
  // Sin elección (o con el píxel aún sin cargar): espera.
  pending = [...pending, ev].slice(-MAX_PENDING)
  return eventId
}
