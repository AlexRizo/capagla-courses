import { z } from 'zod'

// Atribución de marketing (maqueta del panel, Marketing › Atribución): al entrar con etiquetas
// (utm_*), el clic de Meta (fbclid) o el de TikTok (ttclid) se guardan en una cookie propia
// del sitio y viajan hasta la compra y hasta el registro de la clase gratis. Sirve para
// atribuir las ventas (no depende de los píxeles); lo que se manda a Meta, TikTok o GA4 solo
// sale si la persona aceptó las cookies (ver `lib/consent.ts`).
export const ATTRIBUTION_COOKIE = 'capagla_attr'
const ATTRIBUTION_DAYS = 90

const KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'fbclid',
  'ttclid',
] as const

const text = z.string().trim().max(200)

export const attributionSchema = z.object({
  utm_source: text.optional(),
  utm_medium: text.optional(),
  utm_campaign: text.optional(),
  utm_content: text.optional(),
  fbclid: text.optional(),
  ttclid: text.optional(),
  // Página y momento de la entrada con esas etiquetas.
  landing: text.optional(),
  at: text.optional(),
})

export type Attribution = z.infer<typeof attributionSchema>

// Lee la cookie (valor tal cual llega) y la valida: lo que no cuadra se descarta, nunca lanza.
// La cookie la escribe el navegador, así que no es de fiar: solo se acepta texto corto.
export function parseAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const hasTag = KEYS.some((key) => parsed.data[key])
    return hasTag ? parsed.data : null
  } catch {
    return null
  }
}

// Etiquetas de una URL (`?utm_source=…`); null si no trae ninguna.
export function attributionFromSearch(
  search: string,
  landing: string,
): Attribution | null {
  const params = new URLSearchParams(search)
  const found: Attribution = {}
  for (const key of KEYS) {
    const value = params.get(key)?.trim().slice(0, 200)
    if (value) found[key] = value
  }
  if (!Object.keys(found).length) return null
  return {
    ...found,
    landing: landing.slice(0, 200),
    at: new Date().toISOString(),
  }
}

// En el navegador: si la URL trae etiquetas, se guardan (la última entrada con etiquetas
// reemplaza a la anterior). Sin etiquetas no toca lo guardado.
export function captureAttribution() {
  if (typeof document === 'undefined') return
  const found = attributionFromSearch(
    window.location.search,
    window.location.pathname,
  )
  if (!found) return
  try {
    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(found))}; max-age=${ATTRIBUTION_DAYS * 86400}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  } catch {
    // Sin cookies no hay atribución; la página sigue igual.
  }
}

// Para guardar en la base (columna JSON): solo los campos con valor; `undefined` si no hay.
export function attributionJson(a: Attribution | null) {
  if (!a) return undefined
  return Object.fromEntries(
    Object.entries(a).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

// Metadatos del cobro en Stripe: promoción, campaña y creativo que originaron la compra.
export function stripeMetadata(
  a: Attribution | null,
  promotionUrl: string | null,
): Record<string, string> {
  const meta: Record<string, string> = {}
  if (promotionUrl) meta.promotion = promotionUrl
  if (a?.utm_source) meta.utm_source = a.utm_source
  if (a?.utm_medium) meta.utm_medium = a.utm_medium
  if (a?.utm_campaign) meta.campaign = a.utm_campaign
  if (a?.utm_content) meta.creative = a.utm_content
  return meta
}

export type OriginRow = {
  source: string
  medium: string
  campaign: string
  creative: string
  purchases: number
  revenueMxn: number
}

// Compras pagadas agrupadas por origen (fuente, medio, campaña y creativo), de más a menos
// ingresos. Las que no traen etiquetas (enlace directo) van juntas en una fila con todo vacío,
// al final. Sirve para ver en Promociones qué anuncio originó cada compra.
export function groupPurchasesByOrigin(
  orders: { amountMxn: number; attribution: unknown }[],
): OriginRow[] {
  const groups = new Map<string, OriginRow>()
  for (const order of orders) {
    const a = attributionSchema.safeParse(order.attribution).data
    const row = {
      source: a?.utm_source ?? '',
      medium: a?.utm_medium ?? '',
      campaign: a?.utm_campaign ?? '',
      creative: a?.utm_content ?? '',
    }
    const key = JSON.stringify(
      Object.values(row).map((value) => value.toLowerCase()),
    )
    const group = groups.get(key) ?? { ...row, purchases: 0, revenueMxn: 0 }
    group.purchases += 1
    group.revenueMxn += order.amountMxn
    groups.set(key, group)
  }
  const untagged = (r: OriginRow) =>
    !r.source && !r.medium && !r.campaign && !r.creative
  return [...groups.values()].sort(
    (a, b) =>
      Number(untagged(a)) - Number(untagged(b)) ||
      b.revenueMxn - a.revenueMxn ||
      b.purchases - a.purchases,
  )
}
