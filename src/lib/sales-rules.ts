import { attributionSchema } from '#/lib/attribution'

// Reglas puras de las pantallas Ventas y Leads del panel (H34): de qué anuncio llegó cada quien y
// el CSV de los leads (lo importa Brevo: Contactos › Importar, columna EMAIL).

// «facebook · navidad · video-2», «Meta (clic)», «TikTok (clic)» o «Directo». Lee la atribución
// guardada (utm_*, fbclid, ttclid); lo que no cuadra cuenta como directo.
export function sourceLabel(raw: unknown): string {
  const parsed = attributionSchema.safeParse(raw)
  if (!parsed.success) return 'Directo'
  const a = parsed.data
  const utm = [a.utm_source, a.utm_campaign, a.utm_content].filter(Boolean)
  if (utm.length > 0) return utm.join(' · ')
  if (a.fbclid) return 'Meta (clic)'
  if (a.ttclid) return 'TikTok (clic)'
  return 'Directo'
}

// Una celda de CSV: entre comillas si lleva coma, comillas o salto de línea. Una celda que empieza
// con = + - @ se antepone con ' para que una hoja de cálculo no la ejecute como fórmula.
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const ymd = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
  }).format(d)

export type LeadRow = {
  email: string
  createdAt: Date
  newsletterAt: Date | null
  attribution: unknown
}

// CSV de los leads: EMAIL primero (Brevo lo reconoce solo), fechas en hora de México.
export function leadsCsv(leads: LeadRow[]): string {
  return toCsv([
    ['EMAIL', 'REGISTRO', 'ACEPTA_CORREOS', 'FECHA_ACEPTA_CORREOS', 'ORIGEN'],
    ...leads.map((l) => [
      l.email,
      ymd(l.createdAt),
      l.newsletterAt ? 'si' : 'no',
      l.newsletterAt ? ymd(l.newsletterAt) : '',
      sourceLabel(l.attribution),
    ]),
  ])
}
