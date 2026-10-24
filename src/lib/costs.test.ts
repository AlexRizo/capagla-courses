import { describe, expect, it } from 'vitest'

import {
  avgPieceGrams,
  costLine,
  costPerBase,
  formatPrice,
  formatUnitCost,
  ingredientCosts,
  ingredientSchema,
  parseDecimal,
  purchaseLabel,
} from '#/lib/costs'
import type { Priced } from '#/lib/costs'

const base: Priced = {
  price: 13,
  quantity: 1000,
  unit: 'G',
  flexible: false,
  sampleCount: null,
  sampleGrams: null,
}

// Los ejemplos salen de la lista de ingredientes de la maqueta.
describe('costo por unidad', () => {
  it('precio ÷ lo que trae lo que compras', () => {
    expect(costPerBase(13, 1000, 'G')).toBeCloseTo(0.013)
    expect(costPerBase(109, 1360, 'G')).toBeCloseTo(0.0801, 3)
    expect(costPerBase(70, 500, 'ML')).toBeCloseTo(0.14)
  })

  it('kg y l se convierten a gramos y mililitros', () => {
    expect(costPerBase(13, 1, 'KG')).toBeCloseTo(0.013)
    expect(costPerBase(20, 1, 'L')).toBeCloseTo(0.02)
  })

  it('una pieza cuesta su precio entre las piezas', () => {
    expect(costPerBase(8.8, 1, 'PZA')).toBeCloseTo(8.8)
    expect(costPerBase(251, 180, 'PZA')).toBeCloseTo(1.3944, 3)
  })
})

describe('uso flexible', () => {
  const huevo: Priced = {
    price: 251,
    quantity: 180,
    unit: 'PZA',
    flexible: true,
    sampleCount: 30,
    sampleGrams: 1710,
  }

  it('el peso promedio es lo que pesaron entre las piezas', () => {
    expect(avgPieceGrams(1710, 30)).toBe(57)
  })

  it('con uso flexible sale también el costo por gramo', () => {
    const c = ingredientCosts(huevo)
    expect(c.avgGrams).toBe(57)
    expect(c.perGram).toBeCloseTo(0.0245, 3)
    expect(costLine(huevo)).toBe('$1.394/pza · $0.024/g')
  })

  it('sin activarlo, o si no se compra por pieza, no hay costo por gramo', () => {
    expect(ingredientCosts({ ...huevo, flexible: false }).perGram).toBeNull()
    expect(ingredientCosts({ ...huevo, unit: 'G' }).perGram).toBeNull()
    expect(ingredientCosts({ ...huevo, sampleGrams: null }).perGram).toBeNull()
  })
})

describe('formato', () => {
  it('el costo de una unidad lleva tres decimales y dos si es de varios pesos', () => {
    expect(formatUnitCost(0.013)).toBe('$0.013')
    expect(formatUnitCost(0.19)).toBe('$0.190')
    expect(formatUnitCost(1.3944)).toBe('$1.394')
    expect(formatUnitCost(8.8)).toBe('$8.80')
    expect(formatUnitCost(7.3)).toBe('$7.30')
  })

  it('las líneas de la lista salen como en la maqueta', () => {
    expect(costLine(base)).toBe('$0.013/g')
    expect(costLine({ ...base, price: 70, quantity: 500, unit: 'ML' })).toBe(
      '$0.140/ml',
    )
    expect(costLine({ ...base, price: 7.3, quantity: 1, unit: 'PZA' })).toBe(
      '$7.30/pza',
    )
  })

  it('precio y cantidad de compra', () => {
    expect(formatPrice(251)).toBe('$251.00')
    expect(purchaseLabel(1000, 'G')).toBe('1,000 g')
    expect(purchaseLabel(180, 'PZA')).toBe('180 pza')
  })
})

describe('parseDecimal', () => {
  it('acepta coma de miles y punto decimal', () => {
    expect(parseDecimal('251.00')).toBe(251)
    expect(parseDecimal('1,710')).toBe(1710)
    expect(parseDecimal(' $ 1,360.5 ')).toBe(1360.5)
    expect(parseDecimal('.5')).toBe(0.5)
  })

  it('lo ilegible o vacío es null', () => {
    for (const text of ['', 'abc', '1.2.3', '-5', '1e3', '12a']) {
      expect(parseDecimal(text)).toBeNull()
    }
  })
})

describe('ingredientSchema', () => {
  const ok = {
    name: ' Harina ',
    kind: 'INGREDIENT' as const,
    placeId: null,
    price: 13,
    quantity: 1000,
    unit: 'G' as const,
    flexible: false,
    sampleCount: null,
    sampleGrams: null,
    wasteEnabled: false,
    yieldPct: null,
  }

  it('acepta un ingrediente válido y le quita los espacios al nombre', () => {
    expect(ingredientSchema.parse(ok).name).toBe('Harina')
  })

  it('rechaza nombre vacío, precio negativo y cantidad cero', () => {
    expect(ingredientSchema.safeParse({ ...ok, name: '  ' }).success).toBe(
      false,
    )
    expect(ingredientSchema.safeParse({ ...ok, price: -1 }).success).toBe(false)
    expect(ingredientSchema.safeParse({ ...ok, quantity: 0 }).success).toBe(
      false,
    )
    expect(
      ingredientSchema.safeParse({ ...ok, quantity: Number.NaN }).success,
    ).toBe(false)
  })

  it('el uso flexible exige pieza y las dos medidas del pesaje', () => {
    const flexible = { ...ok, unit: 'PZA' as const, flexible: true }
    expect(ingredientSchema.safeParse(flexible).success).toBe(false)
    expect(
      ingredientSchema.safeParse({
        ...flexible,
        sampleCount: 30,
        sampleGrams: 1710,
      }).success,
    ).toBe(true)
    expect(
      ingredientSchema.safeParse({
        ...ok,
        flexible: true,
        sampleCount: 30,
        sampleGrams: 1710,
      }).success,
    ).toBe(false)
  })

  it('el desperdicio exige un porcentaje de 1 a 99', () => {
    const waste = { ...ok, wasteEnabled: true }
    expect(ingredientSchema.safeParse(waste).success).toBe(false)
    expect(ingredientSchema.safeParse({ ...waste, yieldPct: 0 }).success).toBe(
      false,
    )
    expect(
      ingredientSchema.safeParse({ ...waste, yieldPct: 100 }).success,
    ).toBe(false)
    expect(ingredientSchema.parse({ ...waste, yieldPct: 88 }).yieldPct).toBe(88)
  })

  it('lo que no aplica se descarta al guardar', () => {
    const parsed = ingredientSchema.parse({
      ...ok,
      sampleCount: 30,
      sampleGrams: 1710,
      yieldPct: 88,
    })
    expect(parsed.sampleCount).toBeNull()
    expect(parsed.sampleGrams).toBeNull()
    expect(parsed.yieldPct).toBeNull()
  })
})
