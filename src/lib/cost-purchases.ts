import { z } from 'zod'

// Registro de compras: cuánto cambió un precio y lo que se guarda al registrar una compra. Solo
// reglas (sin base de datos): el formulario y el servidor usan lo mismo.

export type PriceChange = {
  kind: 'UP' | 'DOWN' | 'SAME' | 'NEW'
  // Porcentaje respecto al precio anterior, con un decimal (265 contra 251 es 5.6).
  pct: number | null
}

// Cuánto cambió un precio. Menos de medio centavo de diferencia es "Igual"; si antes no había
// precio (costaba $0), es "Nuevo" y no hay porcentaje.
export function priceChange(previous: number, paid: number): PriceChange {
  if (Math.abs(paid - previous) < 0.005) return { kind: 'SAME', pct: null }
  if (previous <= 0) return { kind: 'NEW', pct: null }
  const pct = Math.round(((paid - previous) / previous) * 1000) / 10
  return { kind: paid > previous ? 'UP' : 'DOWN', pct: Math.abs(pct) }
}

// "▲ 5.6%", "▼ 4.6%", "Igual" o "Nuevo".
export function changeLabel(c: PriceChange) {
  if (c.kind === 'SAME') return 'Igual'
  if (c.kind === 'NEW') return 'Nuevo'
  return `${c.kind === 'UP' ? '▲' : '▼'} ${c.pct}%`
}

const day = /^\d{4}-\d{2}-\d{2}$/

export const purchaseSchema = z.object({
  // La tienda donde se compró; sin tienda también se puede.
  placeId: z.string().nullable(),
  // Un día, como "2026-10-13".
  date: z.string().regex(day, 'Escribe la fecha.'),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        price: z
          .number()
          .min(0, 'El precio no puede ser negativo.')
          .max(10_000_000, 'Es demasiado grande.'),
        // Lo que pesó el paquete completo: solo en lo que se compra por pieza.
        packGrams: z.number().positive().max(10_000_000).nullable(),
      }),
    )
    .min(1, 'Agrega al menos un ingrediente.')
    .max(100),
})

export type PurchaseInput = z.input<typeof purchaseSchema>

// "10 oct 2026": una fecha guardada como día (sin hora ni zona).
export const formatDay = (date: Date | string) =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(date))
    .replace(/\./g, '')
