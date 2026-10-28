import { z } from 'zod'

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
    // El impuesto de Ajustes que lleva su precio (ya incluido); sin valor, ninguno.
    taxTypeId: z.string().min(1).nullable(),
    // Su múltiplo mínimo; vacío usa el general de Ajustes.
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

// Semáforo del precio, sobre el costo total: rojo si no cubre el costo (menos de ×1), amarillo si
// lo cubre pero no llega al múltiplo mínimo, verde entre el mínimo y la meta, y verde brillante
// ("Excelente") por encima de la meta. `NONE`, cuando falta el precio o el costo.
export type Verdict = 'NONE' | 'LOSS' | 'LOW' | 'GOOD' | 'GREAT'

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
  // Mínimo del producto y meta general; si el mínimo pasa la meta, manda el mínimo.
  multiplier: number,
  target: number,
): Verdict {
  if (price === null || !cost) return 'NONE'
  if (price < cost) return 'LOSS'
  if (price < multiplier * cost) return 'LOW'
  return price > Math.max(target, multiplier) * cost ? 'GREAT' : 'GOOD'
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  NONE: 'Faltan datos',
  LOSS: 'Vendes a pérdida',
  LOW: 'Te queda poco',
  GOOD: 'Buen margen',
  GREAT: 'Excelente',
}

const EXPENSES =
  'Recuerda que hay gastos aparte de los ingredientes: tu tiempo, el gas, la luz y el desperdicio.'

// Texto del aviso del semáforo, con la razón.
export function verdictText(
  verdict: Verdict,
  ctx: { multiplier: number; target: number; ratio: number | null },
) {
  const ratio = ctx.ratio?.toFixed(2)
  switch (verdict) {
    case 'LOSS':
      return `Lo vendes por debajo de lo que te cuesta producirlo. ${EXPENSES}`
    case 'LOW':
      return `Quizás lo estés vendiendo muy barato: no llegas a tu mínimo de ${ctx.multiplier}×. ${EXPENSES}`
    case 'GOOD':
      return `Cubre tus costos y pasa de tu mínimo de ${ctx.multiplier}× (aquí vendes a ${ratio}× tu costo).`
    case 'GREAT':
      return `Excelente: vendes a ${ratio}× tu costo, por encima de tu meta de ${ctx.target}×.`
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
  // Mínimo del producto (o el general) y meta general.
  multiplier: number
  target: number
  // Tasa del impuesto que lleva el precio (ya incluido); sin valor, ninguno.
  taxPct: number | null
}

// Lo que cuesta, a cuánto se vende y cuánto se gana: el entero y, si aplica, cada rebanada.
export function productSummary(i: ProductSummaryInput) {
  const incomplete =
    i.recipes.length === 0 || i.recipes.some((r) => r.empty || r.total === null)
  const recipesCost = i.recipes.reduce((s, r) => s + (r.total ?? 0), 0)
  const wholeCost = recipesCost + i.packagingWhole
  // El precio ya incluye el impuesto: el margen y el semáforo salen del neto, precio ÷ (1 + tasa).
  const taxFactor = 1 + (i.taxPct ?? 0) / 100
  const net = (price: number | null) =>
    price === null ? null : price / taxFactor
  const netPrice = net(i.price)
  const netSlicePrice = net(i.slicePrice)
  const suggested = !incomplete ? wholeCost * i.multiplier * taxFactor : null

  const whole = {
    recipes: recipesCost,
    packaging: i.packagingWhole,
    cost: wholeCost,
    // Lo que cobra sin el impuesto.
    netPrice,
    margin: incomplete ? null : margin(netPrice ?? 0, wholeCost),
    verdict: incomplete
      ? ('NONE' as Verdict)
      : verdictOf(netPrice, wholeCost, i.multiplier, i.target),
    suggested,
  }

  let slices = null
  if (i.sellsSlices && i.slicesPerPiece && i.slicesPerPiece > 0) {
    const n = i.slicesPerPiece
    const portion = wholeCost / n
    const cost = portion + i.packagingSlice
    slices = {
      count: n,
      portion,
      packaging: i.packagingSlice,
      cost,
      netPrice: netSlicePrice,
      margin: incomplete ? null : margin(netSlicePrice ?? 0, cost),
      verdict: incomplete
        ? ('NONE' as Verdict)
        : verdictOf(netSlicePrice, cost, i.multiplier, i.target),
      // Si vende todas las rebanadas, esto le deja la pieza (sin el impuesto).
      allSold: netSlicePrice === null ? null : netSlicePrice * n,
    }
  }
  return { incomplete, whole, slices }
}
