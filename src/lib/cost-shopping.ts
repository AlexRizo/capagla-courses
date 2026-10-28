import { z } from 'zod'

import { avgPieceGrams, UNITS, formatPrice, formatQuantity } from '#/lib/costs'
import type { CostUnit } from '#/lib/costs'
import { familyOf } from '#/lib/cost-engine'
import type { EngineIngredient } from '#/lib/cost-engine'

// Producción y lista de compra: cuánto hace falta de cada ingrediente, a cuántos paquetes
// completos equivale y qué cuesta comprarlos, el resumen de una producción y el texto para
// compartir la lista. Solo reglas (sin base de datos): las usan el servidor y la pantalla.

// Cuánto de un ingrediente hace falta, en la unidad base de como se compra (g, ml o pza), para
// `quantity` `unit` de él. Con desperdicio hay que comprar más: lo aprovechable es un porcentaje.
// Un ingrediente flexible escrito en gramos se pasa a piezas con su peso promedio.
export function neededBase(
  ing: EngineIngredient,
  quantity: number,
  unit: CostUnit,
) {
  const amount = quantity * UNITS[unit].factor
  let need: number
  if (familyOf(unit) === familyOf(ing.unit)) {
    need = amount
  } else if (
    ing.unit === 'PZA' &&
    ing.flexible &&
    ing.sampleCount &&
    ing.sampleGrams
  ) {
    need = amount / avgPieceGrams(ing.sampleGrams, ing.sampleCount)
  } else {
    return null
  }
  return ing.wasteEnabled && ing.yieldPct ? need / (ing.yieldPct / 100) : need
}

// Lo agregado a mano, en la unidad base de como se compra: la cantidad que escribe la alumna, sin
// desperdicio ni redondeo a paquetes (ella decide dónde y en qué presentación comprarlo). Un huevo
// escrito en gramos se pasa a piezas con su peso promedio. Sin equivalencia devuelve null.
export function manualBase(
  ing: EngineIngredient,
  quantity: number,
  unit: CostUnit,
) {
  const amount = quantity * UNITS[unit].factor
  if (familyOf(unit) === familyOf(ing.unit)) return amount
  if (
    ing.unit === 'PZA' &&
    ing.flexible &&
    ing.sampleCount &&
    ing.sampleGrams
  ) {
    return amount / avgPieceGrams(ing.sampleGrams, ing.sampleCount)
  }
  return null
}

// Lo que trae un paquete de lo que compra, en la unidad base (1,000 g, 1,360 g, 180 pza…).
export const packBase = (ing: Pick<EngineIngredient, 'quantity' | 'unit'>) =>
  ing.quantity * UNITS[ing.unit].factor

// Paquetes completos para cubrir lo que hace falta ("Comprar redondea a los paquetes completos").
export function packsFor(ing: EngineIngredient, need: number) {
  if (need <= 0) return 0
  // Un margen mínimo para que 1,000.0000001 g no pida un paquete de más.
  return Math.ceil(need / packBase(ing) - 1e-9)
}

// "2,350 g", "28 pza": lo que hace falta, redondeado (las piezas siempre hacia arriba).
export function needLabel(ing: Pick<EngineIngredient, 'unit'>, need: number) {
  const base = UNITS[ing.unit].base
  const rounded = base === 'pza' ? Math.ceil(need - 1e-9) : Math.round(need)
  return `${formatQuantity(rounded)} ${base}`
}

// "3 × 1,000 g", "6 × 100 g" o, si se compra de uno en uno por pieza, "5 pza".
export function buyLabel(
  ing: Pick<EngineIngredient, 'quantity' | 'unit'>,
  packs: number,
) {
  if (ing.unit === 'PZA' && ing.quantity === 1) return `${packs} pza`
  return `${packs} × ${formatQuantity(ing.quantity)} ${UNITS[ing.unit].label}`
}

// Un renglón de la lista: lo que pide la producción (a paquetes completos) más lo agregado a mano
// (la cantidad exacta, en la unidad base).
export function listRow(
  ing: EngineIngredient,
  productionNeed: number,
  manualAmount: number,
) {
  const packs = packsFor(ing, productionNeed)
  const need = productionNeed + manualAmount
  const wholeByPiece = ing.unit === 'PZA' && ing.quantity === 1
  const parts: string[] = []
  if (wholeByPiece && manualAmount > 0) {
    parts.push(buyLabel(ing, packs + Math.ceil(manualAmount - 1e-9)))
  } else {
    if (packs > 0) parts.push(buyLabel(ing, packs))
    if (manualAmount > 0) parts.push(needLabel(ing, manualAmount))
  }
  return {
    need,
    packs,
    cost: packs * ing.price + (manualAmount / packBase(ing)) * ing.price,
    needLabel: needLabel(ing, need),
    buyLabel: parts.join(' + '),
  }
}

// Lo que sale de producir: horas, dinero para comprar (solo ingredientes y empaque), costo total
// (con trabajo y gasto fijo), ventas y ganancia.
export type ProductionMetrics = {
  cost: number
  price: number | null
  // Ingredientes y empaque de una pieza entera.
  buy: number
  labor: number
  fixed: number
  laborHours: number
  ovenHours: number
}

export function productionSummary(
  items: { quantity: number; metrics: ProductionMetrics | null }[],
) {
  let laborHours = 0
  let ovenHours = 0
  let buy = 0
  let cost = 0
  let labor = 0
  let fixed = 0
  let sales = 0
  for (const { quantity, metrics: m } of items) {
    if (!m) continue
    laborHours += quantity * m.laborHours
    ovenHours += quantity * m.ovenHours
    buy += quantity * m.buy
    cost += quantity * m.cost
    labor += quantity * m.labor
    fixed += quantity * m.fixed
    sales += quantity * (m.price ?? 0)
  }
  return {
    laborHours,
    ovenHours,
    buy,
    cost,
    labor,
    fixed,
    sales,
    profit: sales - cost,
  }
}

export type ShareGroup = {
  name: string
  rows: { name: string; buy: string }[]
  subtotal: number
}

// El texto que se comparte (WhatsApp, notas): por tienda, solo lo que falta comprar.
export function shareText(title: string, groups: ShareGroup[], total: number) {
  const lines = [`Lista de compra · ${title}`]
  for (const g of groups) {
    if (g.rows.length === 0) continue
    lines.push('', `${g.name} (${formatPrice(g.subtotal)})`)
    for (const r of g.rows) lines.push(`• ${r.name}: ${r.buy}`)
  }
  lines.push('', `Total estimado ${formatPrice(total)}`)
  return lines.join('\n')
}

// Lo que se guarda de una producción: su nombre y los productos con cuántos enteros.
export const productionSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(80),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z
          .number()
          .int('Las cantidades son números enteros.')
          .min(1, 'Produces al menos 1.')
          .max(100_000),
      }),
    )
    .max(50),
})

// Arrastrar un renglón de la lista. Cae sobre otro renglón (queda junto a él: debajo si venía de
// arriba, encima si venía de abajo; en la vista por tienda también toma su lugar) o sobre un grupo
// vacío o su encabezado (se va a ese lugar, al final). El orden es el mismo en las dos vistas.
export function moveRow<T extends { ingredientId: string; placeKey: string }>(
  rows: T[],
  activeId: string,
  over: { kind: 'row'; id: string } | { kind: 'group'; key: string },
  adoptPlace: boolean,
): T[] {
  const from = rows.findIndex((r) => r.ingredientId === activeId)
  if (from < 0) return rows
  const active = rows[from]
  if (over.kind === 'row') {
    if (over.id === activeId) return rows
    const target = rows.findIndex((r) => r.ingredientId === over.id)
    if (target < 0) return rows
    const moved = adoptPlace
      ? { ...active, placeKey: rows[target].placeKey }
      : active
    const rest = rows.filter((r) => r.ingredientId !== activeId)
    const at = rest.findIndex((r) => r.ingredientId === over.id)
    rest.splice(from < target ? at + 1 : at, 0, moved)
    return rest
  }
  const moved = { ...active, placeKey: over.key }
  const rest = rows.filter((r) => r.ingredientId !== activeId)
  let last = -1
  rest.forEach((r, i) => {
    if (r.placeKey === over.key) last = i
  })
  rest.splice(last < 0 ? rest.length : last + 1, 0, moved)
  return rest
}
