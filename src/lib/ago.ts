import { TIME_ZONE } from '#/lib/promotions'

// Día del calendario en hora de México, como número de días (para contar "hace N días" sin
// que dependa de la hora: lo de anoche a las 23:00 ya es "ayer" al amanecer).
const dayNumber = (date: Date) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-')
    .map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

// "hoy", "ayer", "hace 5 días", "hace 1 semana", "hace 2 meses".
export function ago(date: Date, now = new Date()) {
  const days = Math.max(0, dayNumber(now) - dayNumber(date))
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 30)
    return `hace ${plural(Math.floor(days / 7), 'semana', 'semanas')}`
  if (days < 365) return `hace ${plural(Math.floor(days / 30), 'mes', 'meses')}`
  return `hace ${plural(Math.floor(days / 365), 'año', 'años')}`
}

// "Hoy", "Ayer", "Hace 5 días" (columna "Enviada" del panel).
export const agoCapitalized = (date: Date, now = new Date()) => {
  const text = ago(date, now)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
