// Aviso de cookies (maqueta del panel, Marketing › Atribución): "los píxeles del navegador se
// cargan solo si la persona los acepta. Los eventos del servidor se envían con lo que la
// persona aceptó al comprar". La elección vive en una cookie propia (el servidor la lee al
// comprar o al registrarse) y no caduca hasta un año.
export const CONSENT_COOKIE = 'capagla_cookies'
export type Consent = 'accepted' | 'rejected'

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
