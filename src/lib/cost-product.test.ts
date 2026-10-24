import { describe, expect, it } from 'vitest'

import {
  margin,
  productSchema,
  productSummary,
  verdictOf,
  verdictText,
} from '#/lib/cost-product'
import type { ProductSummaryInput } from '#/lib/cost-product'

// Pastel Red Velvet de la maqueta: receta $407.46, empaque del entero $16.10 (disco y domo),
// 35 rebanadas con $2.17 de contenedor, entero a $520 y rebanada a $25, múltiplo 1.43.
const redVelvet: ProductSummaryInput = {
  recipes: [{ total: 407.46, ingredients: 102.25, empty: false }],
  packagingWhole: 16.1,
  packagingSlice: 2.17,
  sellsSlices: true,
  slicesPerPiece: 35,
  price: 520,
  slicePrice: 25,
  multiplier: 1.43,
  priceBase: 'TOTAL',
  taxPct: null,
  withTax: false,
}

describe('semáforo', () => {
  it('rojo si no cubre el costo, amarillo si no llega al múltiplo, verde si lo alcanza', () => {
    expect(verdictOf(380, 392.51, 392.51, 1.43)).toBe('LOSS')
    expect(verdictOf(520, 423.56, 423.56, 1.43)).toBe('LOW')
    expect(verdictOf(420, 258.4, 258.4, 1.43)).toBe('GOOD')
  })

  it('llegar justo al múltiplo ya es verde, y justo al costo ya no es pérdida', () => {
    expect(verdictOf(143, 100, 100, 1.43)).toBe('GOOD')
    expect(verdictOf(100, 100, 100, 1.43)).toBe('LOW')
  })

  it('sin precio o sin costo no hay semáforo; sin múltiplo, solo se sabe si cubre', () => {
    expect(verdictOf(null, 100, 100, 1.43)).toBe('NONE')
    expect(verdictOf(120, 0, 0, 1.43)).toBe('NONE')
    expect(verdictOf(120, 100, 100, null)).toBe('COVERED')
    expect(verdictOf(90, 100, 100, null)).toBe('LOSS')
  })

  it('los textos de la maqueta', () => {
    expect(verdictText('GOOD', { multiplier: 1.43, ratio: 1.625 })).toBe(
      'Cubre tus costos y pasa de tu 1.43× (aquí vendes a 1.63× tu costo).',
    )
    expect(verdictText('LOSS', { multiplier: 1.43, ratio: null })).toMatch(
      /por debajo de lo que te cuesta/,
    )
    expect(verdictText('LOW', { multiplier: 1.43, ratio: null })).toMatch(
      /muy barato/,
    )
  })
})

describe('ganancia', () => {
  it('es del precio: ganar $96.44 de $520 es 18.5%', () => {
    const m = margin(520, 423.56)!
    expect(m.gain).toBeCloseTo(96.44)
    expect(m.gainPct).toBeCloseTo(18.5, 1)
    expect(m.ratio).toBeCloseTo(1.2277, 3)
  })

  it('a pérdida: −$12.51 y −3.3%', () => {
    const m = margin(380, 392.51)!
    expect(m.gain).toBeCloseTo(-12.51)
    expect(m.gainPct).toBeCloseTo(-3.3, 1)
  })

  it('sin precio o costo no hay margen', () => {
    expect(margin(0, 100)).toBeNull()
    expect(margin(100, 0)).toBeNull()
  })
})

describe('producto con rebanadas (Pastel Red Velvet)', () => {
  const s = productSummary(redVelvet)

  it('entero: receta + empaque = $423.56, gana $96.44 y queda en amarillo', () => {
    expect(s.whole.cost).toBeCloseTo(423.56)
    expect(s.whole.margin?.gain).toBeCloseTo(96.44)
    expect(s.whole.verdict).toBe('LOW')
  })

  it('precio sugerido: 1.43 × $423.56 = $605.69', () => {
    expect(s.whole.suggested).toBeCloseTo(605.69, 1)
  })

  it('rebanada: $423.56 ÷ 35 = $12.10, más $2.17 = $14.27; a $25 gana $10.73 (42.9%)', () => {
    expect(s.slices?.portion).toBeCloseTo(12.1, 1)
    expect(s.slices?.cost).toBeCloseTo(14.27, 1)
    expect(s.slices?.margin?.gain).toBeCloseTo(10.73, 1)
    expect(s.slices?.margin?.gainPct).toBeCloseTo(42.9, 1)
    expect(s.slices?.margin?.ratio).toBeCloseTo(1.75, 2)
    expect(s.slices?.verdict).toBe('GOOD')
  })

  it('vendiendo las 35 rebanadas a $25, la pieza deja $875', () => {
    expect(s.slices?.allSold).toBe(875)
  })
})

describe('otros productos de la maqueta', () => {
  it('Pastel tradicional: $376.41 + $16.10 = $392.51, a $380 es pérdida', () => {
    const s = productSummary({
      ...redVelvet,
      recipes: [{ total: 376.41, ingredients: 90, empty: false }],
      sellsSlices: false,
      price: 380,
    })
    expect(s.whole.cost).toBeCloseTo(392.51)
    expect(s.whole.verdict).toBe('LOSS')
    expect(s.whole.suggested).toBeCloseTo(561.29, 1)
    expect(s.slices).toBeNull()
  })

  it('Brownie: $244.40 + $14 = $258.40, a $420 gana $161.60 (38.5%) y es buen margen', () => {
    const s = productSummary({
      ...redVelvet,
      recipes: [{ total: 244.4, ingredients: 100, empty: false }],
      packagingWhole: 14,
      sellsSlices: false,
      price: 420,
    })
    expect(s.whole.margin?.gain).toBeCloseTo(161.6)
    expect(s.whole.margin?.gainPct).toBeCloseTo(38.5, 1)
    expect(s.whole.verdict).toBe('GOOD')
    expect(s.whole.suggested).toBeCloseTo(369.51, 1)
  })
})

describe('base del múltiplo y impuesto', () => {
  it('solo ingredientes y empaque: el múltiplo se aplica a lo que se compra', () => {
    const s = productSummary({ ...redVelvet, priceBase: 'INGREDIENTS' })
    // (102.25 + 16.10) × 1.43
    expect(s.whole.suggested).toBeCloseTo(169.24, 1)
    // $520 ya pasa de ese umbral aunque el costo total sea $423.56
    expect(s.whole.verdict).toBe('GOOD')
  })

  it('el impuesto se suma al precio sugerido solo si el producto lo pide y hay %', () => {
    const base = productSummary(redVelvet).whole.suggested ?? 0
    expect(
      productSummary({ ...redVelvet, withTax: true, taxPct: 16 }).whole
        .suggested,
    ).toBeCloseTo(base * 1.16)
    expect(
      productSummary({ ...redVelvet, withTax: true, taxPct: null }).whole
        .suggested,
    ).toBeCloseTo(base)
    expect(
      productSummary({ ...redVelvet, withTax: false, taxPct: 16 }).whole
        .suggested,
    ).toBeCloseTo(base)
  })
})

describe('producto incompleto', () => {
  it('sin recetas, o con una receta sin ingredientes, no hay semáforo ni sugerido', () => {
    for (const recipes of [
      [],
      [{ total: null, ingredients: 0, empty: true }],
    ]) {
      const s = productSummary({ ...redVelvet, recipes })
      expect(s.incomplete).toBe(true)
      expect(s.whole.verdict).toBe('NONE')
      expect(s.whole.margin).toBeNull()
      expect(s.whole.suggested).toBeNull()
    }
  })

  it('sin precio escrito: sin margen ni semáforo', () => {
    const s = productSummary({ ...redVelvet, price: null })
    expect(s.whole.verdict).toBe('NONE')
    expect(s.whole.margin).toBeNull()
    expect(s.whole.cost).toBeCloseTo(423.56)
  })
})

describe('productSchema', () => {
  const ok = {
    name: ' Pastel Red Velvet ',
    price: 520,
    sellsSlices: true,
    slicesPerPiece: 35,
    slicePrice: 25,
    withTax: false,
    multiplier: 1.43,
    recipes: [{ recipeId: 'r1', piecesSold: 1 }],
    packaging: [
      {
        scope: 'WHOLE' as const,
        ingredientId: 'i1',
        quantity: 1,
        unit: 'PZA' as const,
      },
      {
        scope: 'SLICE' as const,
        ingredientId: 'i2',
        quantity: 1,
        unit: 'PZA' as const,
      },
    ],
  }

  it('acepta un producto válido y le quita los espacios al nombre', () => {
    expect(productSchema.parse(ok).name).toBe('Pastel Red Velvet')
  })

  it('rebanadas: exige cuántas son (2 o más) y descarta lo de rebanadas si no se venden', () => {
    expect(
      productSchema.safeParse({ ...ok, slicesPerPiece: null }).success,
    ).toBe(false)
    expect(productSchema.safeParse({ ...ok, slicesPerPiece: 1 }).success).toBe(
      false,
    )
    const without = productSchema.parse({ ...ok, sellsSlices: false })
    expect(without.slicesPerPiece).toBeNull()
    expect(without.slicePrice).toBeNull()
    expect(without.packaging.map((p) => p.scope)).toEqual(['WHOLE'])
  })

  it('rechaza nombre vacío, precio negativo y piezas en 0', () => {
    expect(productSchema.safeParse({ ...ok, name: ' ' }).success).toBe(false)
    expect(productSchema.safeParse({ ...ok, price: -1 }).success).toBe(false)
    expect(
      productSchema.safeParse({
        ...ok,
        recipes: [{ recipeId: 'r1', piecesSold: 0 }],
      }).success,
    ).toBe(false)
  })

  it('el múltiplo es de 1 en adelante y puede quedar sin escribir', () => {
    expect(productSchema.safeParse({ ...ok, multiplier: 0.9 }).success).toBe(
      false,
    )
    expect(productSchema.safeParse({ ...ok, multiplier: null }).success).toBe(
      true,
    )
  })

  it('el precio puede quedar sin escribir', () => {
    expect(productSchema.safeParse({ ...ok, price: null }).success).toBe(true)
  })
})
