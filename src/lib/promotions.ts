// Reglas puras de las promociones (sin base de datos), compartidas por servidor y pantalla.

export const TIME_ZONE = 'America/Mexico_City'

// Máximo de productos por promoción: 1 principal y hasta 2 adicionales.
export const MAX_PROMOTION_PRODUCTS = 3

// Primer segmento de las rutas que ya existen: una promoción no puede usar esas URL.
const RESERVED_SLUGS = [
  'admin',
  'api',
  'checkout',
  'clase-gratis',
  'cursos',
  'entrar',
  'gracias',
  'mis-cursos',
  'pago-prueba',
  'revisa-tu-correo',
]

// "/Navidad-Final" → "navidad-final". Devuelve null si no es una URL válida o está reservada.
export function normalizeSlug(value: string) {
  const slug = value.trim().replace(/^\/+/, '').toLowerCase()
  if (slug.length > 60) return null
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  if (RESERVED_SLUGS.includes(slug)) return null
  return slug
}

const parts = (date: Date) => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(f.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

// Instante → "2026-11-17T23:59" en hora de México (para <input type="datetime-local">).
export function toLocalInput(date: Date | null) {
  if (!date) return ''
  const p = parts(date)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`
}

// "2026-11-17T23:59" en hora de México → instante. Vacío → null; inválido → undefined.
export function fromLocalInput(value: string) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return undefined
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute)
  // Se corrige por la diferencia de la zona en ese instante.
  const at = (guess: number) => {
    const p = parts(new Date(guess))
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess
  }
  let result = wanted - at(wanted)
  result = wanted - at(result)
  const date = new Date(result)
  return toLocalInput(date) === value ? date : undefined
}

export type PromotionStatus = 'Pausada' | 'Programada' | 'Activa' | 'Terminada'

// Sin fecha de inicio la promoción no ha empezado; sin fecha de fin no termina.
export function promotionStatus(
  p: { paused: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): PromotionStatus {
  if (p.paused) return 'Pausada'
  if (!p.startsAt || now < p.startsAt) return 'Programada'
  if (p.endsAt && now > p.endsAt) return 'Terminada'
  return 'Activa'
}

// "17 oct – 17 nov", "18 – 30 nov"; lo que falte se ve como "—".
export function vigency(startsAt: Date | null, endsAt: Date | null) {
  const month = (d: Date) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, month: 'short' })
      .format(d)
      .replace('.', '')
  const day = (d: Date) => parts(d).day
  if (!startsAt && !endsAt) return '—'
  const end = endsAt ? `${day(endsAt)} ${month(endsAt)}` : '—'
  if (!startsAt) return `— – ${end}`
  const s = parts(startsAt)
  if (
    endsAt &&
    s.year === parts(endsAt).year &&
    s.month === parts(endsAt).month
  ) {
    return `${day(startsAt)} – ${end}`
  }
  return `${day(startsAt)} ${month(startsAt)} – ${end}`
}

// Quien ya tenía el carrito abierto cuando terminó la promoción conserva el precio 1 hora más.
export const GRACE_MS = 60 * 60 * 1000

// ¿Aplican hoy los precios especiales? `graceMs` extiende el fin (solo para pagar, no para mostrar).
export function promotionApplies(
  p: { paused: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
  graceMs = 0,
) {
  if (p.paused || !p.startsAt || now < p.startsAt) return false
  return !p.endsAt || now.getTime() <= p.endsAt.getTime() + graceMs
}

// "17 de noviembre", en hora de México.
export function longDate(date: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'long',
  }).format(date)
}
