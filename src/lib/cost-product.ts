import { z } from 'zod'

import type { PriceBase } from '#/lib/cost-settings'

// Productos de la herramienta de costos: lo que se guarda y las cuentas de precio, ganancia y
// semáforo. Solo reglas (sin base de datos): el formulario y el servidor usan lo mismo.

const unit = z.enum(['G', 'KG', 'ML', 'L', 'PZA'])
const money = z
  .number()
  .min(0, 'No puede ser negativo.')
  .max(10_000_000, 'Es demasiado grande.')

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe el nombre.').max(80),
    // Lo que cobra por el entero y, si también lo vende por rebanadas, por cada una.
    price: money.nullable(),
    sellsSlices: z.boolean(),
    slicesPerPiece: z
      .number()
      .int('Las rebanadas son un número entero.')
      .min(2, 'Son al menos 2 rebanadas.')
      .max(1000)
      .nullable(),
    slicePrice: money.nullable(),
    withTax: z.boolean(),
    // El múltiplo de Ajustes, editable también desde aquí (se guarda en Ajustes).
    multiplier: z
      .number()
      .min(1, 'El múltiplo es de 1 en adelante: 1 es vender al costo.')
      .max(100)
      .nullable(),
    recipes: z
      .array(
        z.object({
          recipeId: z.string().min(1),
          piecesSold: z
            .number()
            .int('Las piezas son un número entero.')
            .min(1, 'Vendes al menos 1 pieza.')
            .max(100_000),
        }),
      )
      .max(30),
    packaging: z
      .array(
        z.object({
          scope: z.enum(['WHOLE', 'SLICE']),
          ingredientId: z.string().min(1),
          quantity: z
            .number()
            .positive('Escribe una cantidad mayor a 0.')
            .max(10_000_000),
          unit,
        }),
      )
      .max(60),
  })
  .superRefine((v, ctx) => {
    if (v.sellsSlices && !v.slicesPerPiece) {
      ctx.addIssue({
        code: 'custom',
        path: ['slicesPerPiece'],
        message: 'Escribe cuántas rebanadas salen de una pieza.',
      })
    }
  })
  .transform((v) => ({
    ...v,
    // Lo de las rebanadas solo cuenta si se venden por rebanada.
    slicesPerPiece: v.sellsSlices ? v.slicesPerPiece : null,
    slicePrice: v.sellsSlices ? v.slicePrice : null,
    packaging: v.packaging.filter((p) => v.sellsSlices || p.scope === 'WHOLE'),
  }))

export type ProductInput = z.input<typeof productSchema>

// Semáforo del precio: rojo si no cubre el costo, amarillo si lo cubre pero no llega al múltiplo,
// verde si lo alcanza. `COVERED` es cuando cubre el costo y aún no hay múltiplo en Ajustes con qué
// compararlo; `NONE`, cuando falta el precio o el costo.
export type Verdict = 'NONE' | 'LOSS' | 'LOW' | 'GOOD' | 'COVERED'

export type Margin = {
  gain: number
  // De lo que cobra: ganar $96.44 de $520 es 18.5%.
  gainPct: number
  // Cuántas veces su costo vende.
  ratio: number
}

export function margin(price: number, cost: number): Margin | null {
  if (!price || !cost) return null
  const gain = price - cost
  return { gain, gainPct: (gain / price) * 100, ratio: price / cost }
}

export function verdictOf(
  price: number | null,
  cost: number,
  // Costo sobre el que se aplica el múltiplo (el total o solo ingredientes y empaque).
  base: number,
  multiplier: number | null,
): Verdict {
  if (price === null || !cost) return 'NONE'
  if (price < cost) return 'LOSS'
  if (!multiplier) return 'COVERED'
  return price < multiplier * base ? 'LOW' : 'GOOD'
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  NONE: 'Faltan datos',
  LOSS: 'Vendes a pérdida',
  LOW: 'Te queda poco',
  GOOD: 'Buen margen',
  COVERED: 'Cubre tu costo',
}

const EXPENSES =
  'Recuerda que hay gastos aparte de los ingredientes: tu tiempo, el gas, la luz y el desperdicio.'

// Texto del aviso del semáforo, con la razón.
export function verdictText(
  verdict: Verdict,
  ctx: { multiplier: number | null; ratio: number | null },
) {
  switch (verdict) {
    case 'LOSS':
      return `Lo vendes por debajo de lo que te cuesta producirlo. ${EXPENSES}`
    case 'LOW':
      return `Quizás lo estés vendiendo muy barato. ${EXPENSES}`
    case 'GOOD':
      return `Cubre tus costos y pasa de tu ${ctx.multiplier}× (aquí vendes a ${ctx.ratio?.toFixed(2)}× tu costo).`
    case 'COVERED':
      return 'Cubre tu costo. Escribe tu múltiplo en Ajustes de costos para saber si es buen margen.'
    default:
      return 'Agrega las recetas y el precio para ver cuánto ganas.'
  }
}

export type ProductRecipeCost = {
  // Costo de la receta completa (null si no se puede calcular) y lo que lleva solo de ingredientes.
  total: number | null
  ingredients: number
  empty: boolean
}

export type ProductSummaryInput = {
  recipes: ProductRecipeCost[]
  packagingWhole: number
  packagingSlice: number
  sellsSlices: boolean
  slicesPerPiece: number | null
  price: number | null
  slicePrice: number | null
  multiplier: number | null
  priceBase: PriceBase
  // Impuesto de Ajustes, solo si el producto lo suma.
  taxPct: number | null
  withTax: boolean
}

// Lo que cuesta, a cuánto se vende y cuánto se gana: el entero y, si aplica, cada rebanada.
export function productSummary(i: ProductSummaryInput) {
  const incomplete =
    i.recipes.length === 0 || i.recipes.some((r) => r.empty || r.total === null)
  const recipesCost = i.recipes.reduce((s, r) => s + (r.total ?? 0), 0)
  const recipesIngredients = i.recipes.reduce((s, r) => s + r.ingredients, 0)
  const wholeCost = recipesCost + i.packagingWhole
  // Sobre qué se aplica el múltiplo: todo el costo, o solo lo que se compra.
  const wholeBase =
    i.priceBase === 'INGREDIENTS'
      ? recipesIngredients + i.packagingWhole
      : wholeCost
  const taxFactor = i.withTax && i.taxPct ? 1 + i.taxPct / 100 : 1
  const suggested =
    i.multiplier && !incomplete ? wholeBase * i.multiplier * taxFactor : null

  const whole = {
    recipes: recipesCost,
    packaging: i.packagingWhole,
    cost: wholeCost,
    margin: incomplete ? null : margin(i.price ?? 0, wholeCost),
    verdict: incomplete
      ? ('NONE' as Verdict)
      : verdictOf(i.price, wholeCost, wholeBase, i.multiplier),
    suggested,
  }

  let slices = null
  if (i.sellsSlices && i.slicesPerPiece && i.slicesPerPiece > 0) {
    const n = i.slicesPerPiece
    const portion = wholeCost / n
    const cost = portion + i.packagingSlice
    const base =
      i.priceBase === 'INGREDIENTS'
        ? (recipesIngredients + i.packagingWhole) / n + i.packagingSlice
        : cost
    slices = {
      count: n,
      portion,
      packaging: i.packagingSlice,
      cost,
      margin: incomplete ? null : margin(i.slicePrice ?? 0, cost),
      verdict: incomplete
        ? ('NONE' as Verdict)
        : verdictOf(i.slicePrice, cost, base, i.multiplier),
      // Si vende todas las rebanadas, esto le deja la pieza.
      allSold: i.slicePrice === null ? null : i.slicePrice * n,
    }
  }
  return { incomplete, whole, slices }
}
