import { UNITS, avgPieceGrams, ingredientCosts } from '#/lib/costs'
import type { CostUnit, Priced } from '#/lib/costs'

// Motor de costos de recetas y premezclas. Solo cuentas, sin base de datos: se usa en el servidor
// (listas) y en el navegador (para mostrar el costo mientras se edita). El costo de un ingrediente
// sale de lo que pagó y cuánto trajo (lib/costs.ts); aquí se arman las líneas, las premezclas y la
// receta con su merma, mano de obra y gasto fijo.

export type Family = 'weight' | 'volume' | 'piece'

export const familyOf = (unit: CostUnit): Family => {
  const base = UNITS[unit].base
  return base === 'g' ? 'weight' : base === 'ml' ? 'volume' : 'piece'
}

// Un ingrediente con lo que hace falta para costear una cantidad de él.
export type EngineIngredient = Priced & {
  wasteEnabled: boolean
  yieldPct: number | null
}

// En qué unidades se puede escribir su cantidad: la de su familia (g y kg, ml y l, o piezas) y,
// con uso flexible, gramos y piezas (el huevo se escribe en gramos o en piezas).
export function lineUnits(ing: Pick<Priced, 'unit' | 'flexible'>): CostUnit[] {
  const family = familyOf(ing.unit)
  if (family === 'weight') return ['G', 'KG']
  if (family === 'volume') return ['ML', 'L']
  // Con uso flexible, gramos primero: la receta sale igual cada vez si se pesa.
  return ing.flexible ? ['G', 'PZA'] : ['PZA']
}

export const defaultLineUnit = (ing: Pick<Priced, 'unit' | 'flexible'>) =>
  lineUnits(ing)[0]

// Costo de `quantity` `unit` de un ingrediente, con su desperdicio si lo tiene (lo que se tira
// hace que lo aprovechable cueste más). `null` si la unidad no corresponde al ingrediente.
export function ingredientLineCost(
  ing: EngineIngredient,
  quantity: number,
  unit: CostUnit,
) {
  const costs = ingredientCosts(ing)
  const base = quantity * UNITS[unit].factor
  let cost: number
  if (familyOf(unit) === familyOf(ing.unit)) {
    cost = base * costs.perBase
  } else if (ing.unit === 'PZA' && unit !== 'PZA' && costs.perGram !== null) {
    cost = base * costs.perGram
  } else {
    return null
  }
  return ing.wasteEnabled && ing.yieldPct ? cost / (ing.yieldPct / 100) : cost
}

// Un ingrediente flexible escrito en gramos: a cuántas piezas equivale ("≈ 6 pzas de 57 g").
export function piecesHint(
  ing: Pick<Priced, 'unit' | 'flexible' | 'sampleCount' | 'sampleGrams'>,
  quantity: number,
  unit: CostUnit,
) {
  if (!ing.flexible || ing.unit !== 'PZA' || familyOf(unit) !== 'weight') {
    return null
  }
  if (!ing.sampleCount || !ing.sampleGrams) return null
  const avg = avgPieceGrams(ing.sampleGrams, ing.sampleCount)
  return { pieces: (quantity * UNITS[unit].factor) / avg, avgGrams: avg }
}

// Peso o volumen de una línea (en g o ml): lo que suma a lo que lleva una premezcla. Las piezas
// de un ingrediente flexible cuentan por su peso promedio; las demás piezas no pesan nada.
function lineAmount(ing: EngineIngredient, quantity: number, unit: CostUnit) {
  if (familyOf(unit) !== 'piece') return quantity * UNITS[unit].factor
  const avg =
    ing.flexible && ing.sampleCount && ing.sampleGrams
      ? avgPieceGrams(ing.sampleGrams, ing.sampleCount)
      : 0
  return quantity * avg
}

export type PremixLineInput = {
  ingredient: EngineIngredient
  quantity: number
  unit: CostUnit
}

// Una premezcla se cuesta por lo que de verdad rinde: el costo de todo lo que lleva entre el
// peso o volumen final real. Si rinde menos que la suma, la diferencia es merma y encarece cada
// gramo. `perBase` es por gramo o mililitro; `perBulk`, por kilo o litro.
export function premixSummary(
  lines: PremixLineInput[],
  yieldQty: number | null,
  yieldUnit: CostUnit,
) {
  let sum = 0
  let cost = 0
  for (const l of lines) {
    sum += lineAmount(l.ingredient, l.quantity, l.unit)
    cost += ingredientLineCost(l.ingredient, l.quantity, l.unit) ?? 0
  }
  const family = familyOf(yieldUnit)
  const yieldBase = yieldQty ? yieldQty * UNITS[yieldUnit].factor : 0
  const perBase = yieldBase > 0 ? cost / yieldBase : null
  return {
    sum,
    cost,
    family,
    perBase,
    perBulk: perBase === null ? null : perBase * 1000,
    bulkUnit: family === 'volume' ? 'litro' : 'kilo',
  }
}

// Costo de usar `quantity` `unit` de una premezcla (misma familia que su rendimiento).
export function premixLineCost(
  perBase: number | null,
  family: Family,
  quantity: number,
  unit: CostUnit,
) {
  if (perBase === null || familyOf(unit) !== family) return null
  return quantity * UNITS[unit].factor * perBase
}

// Cuánto cuesta hacer la receta, desglosado. Cada parte activa suma; lo que no se puede calcular
// todavía (no hay horas de trabajo o falta llenar Ajustes) queda `null` y se avisa.
export function recipeBreakdown(input: {
  ingredients: number
  includeWaste: boolean
  wastePct: number | null
  includeLabor: boolean
  laborHours: number | null
  laborPerHour: number | null
  includeFixed: boolean
  ovenHours: number | null
  fixedPerHour: number | null
  yieldPieces: number | null
}) {
  const waste =
    input.includeWaste && input.wastePct
      ? input.ingredients * (input.wastePct / 100)
      : 0
  const labor = input.includeLabor
    ? input.laborHours && input.laborPerHour !== null
      ? input.laborHours * input.laborPerHour
      : input.laborHours
        ? null
        : 0
    : 0
  const fixed = input.includeFixed
    ? input.ovenHours && input.fixedPerHour !== null
      ? input.ovenHours * input.fixedPerHour
      : input.ovenHours
        ? null
        : 0
    : 0
  const total = input.ingredients + waste + (labor ?? 0) + (fixed ?? 0)
  return {
    ingredients: input.ingredients,
    waste,
    labor,
    fixed,
    total,
    perPiece: input.yieldPieces ? total / input.yieldPieces : null,
    // Faltan los ajustes por hora: el total no los incluye.
    missingSettings: labor === null || fixed === null,
  }
}
