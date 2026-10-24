import { z } from 'zod'

// Reglas de la herramienta de costos que no dependen de la base: unidades, costo por unidad,
// uso flexible (piezas que también se usan en gramos), formato de dinero y validación del formulario
// de ingredientes. Se usa en el navegador (formulario y lista) y en el servidor (validación).

export const UNITS = {
  G: { label: 'g', base: 'g', factor: 1 },
  KG: { label: 'kg', base: 'g', factor: 1000 },
  ML: { label: 'ml', base: 'ml', factor: 1 },
  L: { label: 'l', base: 'ml', factor: 1000 },
  PZA: { label: 'pza', base: 'pza', factor: 1 },
} as const

export type CostUnit = keyof typeof UNITS
export const COST_UNITS = Object.keys(UNITS) as CostUnit[]
export const KINDS = {
  INGREDIENT: 'Ingrediente',
  PACKAGING: 'Empaque',
} as const
export type CostKind = keyof typeof KINDS

// Lo mínimo de un ingrediente para calcular su costo.
export type Priced = {
  price: number
  quantity: number
  unit: CostUnit
  flexible: boolean
  sampleCount: number | null
  sampleGrams: number | null
}

// Costo de una unidad base (gramo, mililitro o pieza): precio ÷ lo que trae lo que compras.
export function costPerBase(price: number, quantity: number, unit: CostUnit) {
  return price / (quantity * UNITS[unit].factor)
}

// Peso promedio de una pieza: lo que pesaron en total ÷ las piezas que se pesaron.
export function avgPieceGrams(sampleGrams: number, sampleCount: number) {
  return sampleGrams / sampleCount
}

// Costo de cada unidad. Con uso flexible (se compra por pieza) también sale el costo por gramo.
export function ingredientCosts(i: Priced) {
  const perBase = costPerBase(i.price, i.quantity, i.unit)
  const base = UNITS[i.unit].base
  const grams =
    i.flexible && i.unit === 'PZA' && i.sampleCount && i.sampleGrams
      ? avgPieceGrams(i.sampleGrams, i.sampleCount)
      : null
  return {
    perBase,
    base,
    avgGrams: grams,
    perGram: grams ? perBase / grams : null,
  }
}

const money = (value: number, decimals: number, maxDecimals = decimals) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: maxDecimals,
  })}`

// "$251.00": lo que se paga.
export const formatPrice = (value: number) => money(value, 2)

// "$6,000" o "$13.85": una cantidad con sus centavos solo si los tiene.
export const formatAmount = (value: number) => money(value, 0, 2)

// Costo de una unidad: tres decimales (un gramo cuesta centavos) y dos si ya es de varios pesos
// ($0.013, $1.394, $8.80).
export const formatUnitCost = (value: number) =>
  money(value, value >= 5 ? 2 : 3)

export const formatQuantity = (value: number) =>
  value.toLocaleString('es-MX', { maximumFractionDigits: 3 })

// "1,000 g": lo que trae lo que compras.
export const purchaseLabel = (quantity: number, unit: CostUnit) =>
  `${formatQuantity(quantity)} ${UNITS[unit].label}`

// "$0.013/g" o, con uso flexible, "$1.394/pza · $0.024/g".
export function costLine(i: Priced) {
  const c = ingredientCosts(i)
  const main = `${formatUnitCost(c.perBase)}/${c.base}`
  return c.perGram === null ? main : `${main} · ${formatUnitCost(c.perGram)}/g`
}

// Número que escribe la persona: "1,710" o "251.00" (coma de miles, punto decimal). Vacío o
// ilegible → null.
export function parseDecimal(text: string) {
  const clean = text.replace(/[\s,$]/g, '')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(clean)) return null
  const value = Number(clean)
  return Number.isFinite(value) ? value : null
}

const MAX_AMOUNT = 10_000_000

// Lo que se guarda de un ingrediente. Las piezas pesadas solo cuentan con uso flexible y el
// porcentaje que se aprovecha solo con desperdicio; lo demás se descarta.
export const ingredientSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe el nombre.').max(80),
    kind: z.enum(['INGREDIENT', 'PACKAGING']),
    placeId: z.string().nullable(),
    price: z
      .number()
      .min(0, 'El precio no puede ser negativo.')
      .max(MAX_AMOUNT),
    quantity: z
      .number()
      .positive('Escribe cuánto trae lo que compras.')
      .max(MAX_AMOUNT),
    unit: z.enum(['G', 'KG', 'ML', 'L', 'PZA']),
    flexible: z.boolean(),
    sampleCount: z.number().int().positive().max(100_000).nullable(),
    sampleGrams: z.number().positive().max(MAX_AMOUNT).nullable(),
    wasteEnabled: z.boolean(),
    yieldPct: z.number().int().min(1).max(99).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.flexible) {
      if (v.unit !== 'PZA') {
        ctx.addIssue({
          code: 'custom',
          path: ['flexible'],
          message: 'El uso flexible es para lo que compras por pieza.',
        })
      }
      if (!v.sampleCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['sampleCount'],
          message: 'Escribe cuántas piezas pesaste.',
        })
      }
      if (!v.sampleGrams) {
        ctx.addIssue({
          code: 'custom',
          path: ['sampleGrams'],
          message: 'Escribe cuánto pesaron en total.',
        })
      }
    }
    if (v.wasteEnabled && !v.yieldPct) {
      ctx.addIssue({
        code: 'custom',
        path: ['yieldPct'],
        message: 'Escribe el porcentaje que aprovechas (de 1 a 99).',
      })
    }
  })
  .transform((v) => ({
    ...v,
    sampleCount: v.flexible ? v.sampleCount : null,
    sampleGrams: v.flexible ? v.sampleGrams : null,
    yieldPct: v.wasteEnabled ? v.yieldPct : null,
  }))

export type IngredientInput = z.input<typeof ingredientSchema>
