import { describe, expect, it } from 'vitest'

import {
  defaultLineUnit,
  ingredientLineCost,
  lineUnits,
  piecesHint,
  premixLineCost,
  premixSummary,
  recipeBreakdown,
} from '#/lib/cost-engine'
import type { EngineIngredient } from '#/lib/cost-engine'

const ing = (
  price: number,
  quantity: number,
  unit: EngineIngredient['unit'],
  extra: Partial<EngineIngredient> = {},
): EngineIngredient => ({
  price,
  quantity,
  unit,
  flexible: false,
  sampleCount: null,
  sampleGrams: null,
  wasteEnabled: false,
  yieldPct: null,
  ...extra,
})

// Ingredientes de la maqueta (lista de Ingredientes).
const harina = ing(13, 1000, 'G')
const azucar = ing(18, 1000, 'G')
const mantequilla = ing(46, 1000, 'G')
const cocoa = ing(190, 1000, 'G')
const leche = ing(20, 1000, 'ML')
const vainilla = ing(70, 500, 'ML')
const quesoCrema = ing(109, 1360, 'G')
const azucarGlas = ing(20, 1000, 'G')
const huevo = ing(251, 180, 'PZA', {
  flexible: true,
  sampleCount: 30,
  sampleGrams: 1710,
})

describe('costo de una línea', () => {
  it('cantidad por costo de la unidad, como la receta de la maqueta', () => {
    expect(ingredientLineCost(harina, 450, 'G')).toBeCloseTo(5.85)
    expect(ingredientLineCost(azucar, 300, 'G')).toBeCloseTo(5.4)
    expect(ingredientLineCost(mantequilla, 240, 'G')).toBeCloseTo(11.04)
    expect(ingredientLineCost(cocoa, 25, 'G')).toBeCloseTo(4.75)
    expect(ingredientLineCost(leche, 300, 'ML')).toBeCloseTo(6)
  })

  it('kg y l convierten a gramos y mililitros', () => {
    expect(ingredientLineCost(harina, 0.45, 'KG')).toBeCloseTo(5.85)
    expect(ingredientLineCost(leche, 0.3, 'L')).toBeCloseTo(6)
  })

  it('el huevo flexible: 342 g cuestan lo mismo que 6 piezas de 57 g', () => {
    expect(ingredientLineCost(huevo, 342, 'G')).toBeCloseTo(8.37, 1)
    expect(ingredientLineCost(huevo, 6, 'PZA')).toBeCloseTo(8.37, 1)
    expect(piecesHint(huevo, 342, 'G')).toEqual({ pieces: 6, avgGrams: 57 })
  })

  it('una unidad que no corresponde no se cuenta', () => {
    expect(ingredientLineCost(harina, 2, 'PZA')).toBeNull()
    expect(ingredientLineCost(harina, 100, 'ML')).toBeNull()
    expect(ingredientLineCost(ing(8.8, 1, 'PZA'), 100, 'G')).toBeNull()
    expect(piecesHint(harina, 100, 'G')).toBeNull()
  })

  it('el desperdicio encarece lo aprovechable: con 88% cuesta 1/0.88', () => {
    const conMerma = ing(13, 1000, 'G', { wasteEnabled: true, yieldPct: 88 })
    expect(ingredientLineCost(conMerma, 100, 'G')).toBeCloseTo(1.3 / 0.88)
  })

  it('unidades permitidas por ingrediente', () => {
    expect(lineUnits(harina)).toEqual(['G', 'KG'])
    expect(lineUnits(leche)).toEqual(['ML', 'L'])
    expect(lineUnits(huevo)).toEqual(['G', 'PZA'])
    expect(lineUnits(ing(8.8, 1, 'PZA'))).toEqual(['PZA'])
    expect(defaultLineUnit(huevo)).toBe('G')
  })
})

describe('premezcla', () => {
  const lines = [
    { ingredient: quesoCrema, quantity: 570, unit: 'G' as const },
    { ingredient: mantequilla, quantity: 270, unit: 'G' as const },
    { ingredient: azucarGlas, quantity: 500, unit: 'G' as const },
    { ingredient: vainilla, quantity: 50, unit: 'ML' as const },
  ]

  it('Betún de queso crema: suma 1,390, cuesta $75.10 y $57.77 por kilo', () => {
    const s = premixSummary(lines, 1300, 'G')
    expect(s.sum).toBe(1390)
    expect(s.cost).toBeCloseTo(75.1, 1)
    expect(s.perBulk).toBeCloseTo(57.77, 1)
    expect(s.bulkUnit).toBe('kilo')
  })

  it('rinde en kilos o en litros: es el mismo costo por unidad', () => {
    expect(premixSummary(lines, 1.3, 'KG').perBulk).toBeCloseTo(57.77, 1)
    expect(premixSummary(lines, 1.3, 'L').bulkUnit).toBe('litro')
  })

  it('si rinde menos que la suma, la merma encarece cada gramo', () => {
    const entero = premixSummary(lines, 1390, 'G').perBulk ?? 0
    const real = premixSummary(lines, 1300, 'G').perBulk ?? 0
    expect(real).toBeGreaterThan(entero)
  })

  it('sin rendimiento no hay costo por unidad', () => {
    expect(premixSummary(lines, null, 'G').perBase).toBeNull()
    expect(premixSummary(lines, 0, 'G').perBase).toBeNull()
    expect(premixSummary([], 500, 'G').cost).toBe(0)
  })

  it('usar 400 g del betún en una receta cuesta $23.11', () => {
    const s = premixSummary(lines, 1300, 'G')
    expect(premixLineCost(s.perBase, s.family, 400, 'G')).toBeCloseTo(23.11, 1)
    expect(premixLineCost(s.perBase, s.family, 0.4, 'KG')).toBeCloseTo(23.11, 1)
    expect(premixLineCost(s.perBase, s.family, 400, 'ML')).toBeNull()
    expect(premixLineCost(null, 'weight', 400, 'G')).toBeNull()
  })
})

describe('costo de la receta', () => {
  // Pastel Red Velvet de la maqueta: $102.25 de ingredientes, 5% de merma, 3 h de trabajo a $80
  // y 2 h de horno a $30.05.
  const base = {
    ingredients: 102.25,
    includeWaste: true,
    wastePct: 5,
    includeLabor: true,
    laborHours: 3,
    laborPerHour: 80,
    includeFixed: true,
    ovenHours: 2,
    fixedPerHour: 30.05,
    yieldPieces: 1,
  }

  it('suma ingredientes, merma, mano de obra y gasto fijo: $407.46', () => {
    const r = recipeBreakdown(base)
    expect(r.waste).toBeCloseTo(5.11, 1)
    expect(r.labor).toBe(240)
    expect(r.fixed).toBeCloseTo(60.1, 1)
    expect(r.total).toBeCloseTo(407.46, 1)
    expect(r.perPiece).toBeCloseTo(407.46, 1)
    expect(r.missingSettings).toBe(false)
  })

  it('lo apagado no se suma', () => {
    const r = recipeBreakdown({
      ...base,
      includeWaste: false,
      includeLabor: false,
      includeFixed: false,
    })
    expect(r.total).toBeCloseTo(102.25)
  })

  it('el costo por pieza es el de la receta entre lo que rinde', () => {
    expect(recipeBreakdown({ ...base, yieldPieces: 24 }).perPiece).toBeCloseTo(
      407.46 / 24,
      1,
    )
    expect(recipeBreakdown({ ...base, yieldPieces: null }).perPiece).toBeNull()
  })

  it('sin ajustes por hora no se inventa: queda sin calcular y se avisa', () => {
    const r = recipeBreakdown({
      ...base,
      laborPerHour: null,
      fixedPerHour: null,
    })
    expect(r.labor).toBeNull()
    expect(r.fixed).toBeNull()
    expect(r.missingSettings).toBe(true)
    expect(r.total).toBeCloseTo(102.25 + 5.11, 1)
  })

  it('sin horas escritas, esa parte es cero y no falta nada', () => {
    const r = recipeBreakdown({
      ...base,
      laborHours: null,
      ovenHours: null,
      laborPerHour: null,
    })
    expect(r.labor).toBe(0)
    expect(r.fixed).toBe(0)
    expect(r.missingSettings).toBe(false)
  })
})
