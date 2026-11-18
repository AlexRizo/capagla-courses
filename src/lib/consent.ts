// Aviso de cookies (decisión de Cheko, 2026-11-17): la medición (Meta, TikTok y GA4) está activa
// desde que entra la visitante y se apaga solo si elige «Rechazar». Cerrar la barra o seguir
// navegando guarda `si`. La elección vive en una cookie propia (el servidor la lee al comprar o
// al registrarse) y dura un año.
export const CONSENT_COOKIE = 'capagla_cookies'
export type Consent = 'accepted' | 'rejected'

// Se mide salvo que la persona haya rechazado (sin elección también se mide).
export const trackingAllowed = (consent: Consent | null) =>
  consent !== 'rejected'

// Valor de la cookie → elección; `null` si todavía no eligió (o el valor no es válido).
export function parseConsent(raw: string | undefined): Consent | null {
  if (raw === 'si') return 'accepted'
  if (raw === 'no') return 'rejected'
  return null
}

const readCookie = (name: string) =>
  document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)

// Solo en el navegador.
export function getConsent(): Consent | null {
  if (typeof document === 'undefined') return null
  try {
    return parseConsent(readCookie(CONSENT_COOKIE))
  } catch {
    return null
  }
}

export const CONSENT_EVENT = 'capagla:consent'

export function setConsent(choice: Consent) {
  try {
    document.cookie = `${CONSENT_COOKIE}=${choice === 'accepted' ? 'si' : 'no'}; max-age=${365 * 86400}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  } catch {
    // Sin cookies la elección vale solo para esta visita.
  }
  // Quien cargue los píxeles escucha este aviso.
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }))
}

// Cookies que dejan los píxeles de Meta (_fbp, _fbc), TikTok (_ttp, ttcsid) y Google Analytics
// (_ga, _ga_<ID>, _gid). Al rechazar se borran; las de funcionamiento (sesión, carrito, pago) no.
const TRACKING_COOKIE = /^(_fbp|_fbc|_ttp|ttcsid|_ga|_gid)/

export function clearTrackingCookies() {
  try {
    const names = document.cookie
      .split('; ')
      .map((part) => part.split('=')[0])
      .filter((name) => TRACKING_COOKIE.test(name))
    // Los píxeles las guardan en el dominio principal (`.capagla.com`): se prueba cada nivel.
    const labels = window.location.hostname.split('.')
    const domains = [
      '',
      ...labels
        .slice(0, -1)
        .map((_, i) => `; domain=.${labels.slice(i).join('.')}`),
    ]
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; max-age=0; path=/${domain}`
      }
    }
  } catch {
    // Sin acceso a las cookies no hay nada que borrar.
  }
}
