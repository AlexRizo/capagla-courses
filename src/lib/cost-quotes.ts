import { z } from 'zod'

// Reglas del Cotizador que no dependen de la base: lo mínimo que se puede cobrar por un pedido y lo
// que se guarda de una cotización. Se usa en el navegador (formulario) y en el servidor.

const MAX_HOURS = 1000
const MAX_AMOUNT = 10_000_000

const cents = (value: number) => Math.round(value * 100) / 100

// Lo mínimo que puedes cobrar: el costo del producto por la cantidad (ya trae sus horas habituales),
// más las horas extra a tu tarifa de mano de obra, más los extras del pedido. Es el piso: sin
// ganancia. Cada renglón se redondea a centavos y el total es su suma. `null` donde falta un dato:
// el producto no tiene costo, o hay horas extra y la tarifa de Ajustes está incompleta.
export function quoteSummary(input: {
  unitCost: number | null
  quantity: number
  decorHours: number
  sourcingHours: number
  rate: number | null
  extras: number[]
}) {
  const hours = input.decorHours + input.sourcingHours
  const product =
    input.unitCost === null ? null : cents(input.unitCost * input.quantity)
  const hoursCost =
    hours === 0 ? 0 : input.rate === null ? null : cents(hours * input.rate)
  const extras = cents(input.extras.reduce((sum, cost) => sum + cost, 0))
  const floor =
    product === null || hoursCost === null
      ? null
      : cents(product + hoursCost + extras)
  return { hours, product, hoursCost, extras, floor }
}

// Cuánto dura una cotización desde su último guardado (90 días), y cuántos días antes de vencer se
// avisa.
export const QUOTE_DAYS = 90
export const QUOTE_WARN_DAYS = 15

const DAY_MS = 24 * 60 * 60 * 1000

// Días que le quedan (0 el último día); negativo si ya venció.
export const quoteDaysLeft = (expiresAt: Date | string, now = new Date()) =>
  Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS)

export const quoteExpiry = (from = new Date(), days = QUOTE_DAYS) =>
  new Date(from.getTime() + days * DAY_MS)

// "Vence en 12 días", "Vence mañana", "Vence hoy".
export function expiryLabel(daysLeft: number) {
  if (daysLeft <= 0) return 'Vence hoy'
  if (daysLeft === 1) return 'Vence mañana'
  return `Vence en ${daysLeft} días`
}

// Lo que se guarda de una cotización: producto, cuántos enteros, horas extra y extras (nombre y costo).
export const quoteSchema = z.object({
  productId: z.string().min(1, 'Elige el producto.'),
  quantity: z
    .number()
    .int('Las cantidades son números enteros.')
    .min(1, 'Cotizas al menos 1.')
    .max(100_000),
  decorHours: z.number().min(0).max(MAX_HOURS),
  sourcingHours: z.number().min(0).max(MAX_HOURS),
  extras: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Escribe el extra.').max(80),
        cost: z.number().positive('Escribe el costo.').max(MAX_AMOUNT),
      }),
    )
    .max(50),
})

export type QuoteInput = z.input<typeof quoteSchema>

// Día y hora de México en que se guardó la cotización.
export const formatSaved = (date: Date | string) =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(date))
    .replace(/\./g, '')
