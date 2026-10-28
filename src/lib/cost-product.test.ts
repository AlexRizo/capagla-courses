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
  // El mínimo propio de este producto (la maqueta usa ×1.43); la meta es la general.
  multiplier: 1.43,
  target: 3.5,
  taxPct: null,
}

describe('semáforo', () => {
  it('rojo bajo ×1, amarillo hasta el mínimo, verde hasta la meta y verde brillante arriba', () => {
    expect(verdictOf(380, 392.51, 2.5, 3.5)).toBe('LOSS')
    expect(verdictOf(200, 100, 2.5, 3.5)).toBe('LOW')
    expect(verdictOf(300, 100, 2.5, 3.5)).toBe('GOOD')
    expect(verdictOf(400, 100, 2.5, 3.5)).toBe('GREAT')
  })

  it('justo en el mínimo ya es verde, justo en la meta sigue verde y justo al costo ya no es pérdida', () => {
    expect(verdictOf(250, 100, 2.5, 3.5)).toBe('GOOD')
    expect(verdictOf(350, 100, 2.5, 3.5)).toBe('GOOD')
    expect(verdictOf(100, 100, 2.5, 3.5)).toBe('LOW')
  })

  it('un producto gancho con mínimo ×1.2 queda verde donde el general lo daría amarillo', () => {
    expect(verdictOf(130, 100, 2.5, 3.5)).toBe('LOW')
    expect(verdictOf(130, 100, 1.2, 3.5)).toBe('GOOD')
  })

  it('si el mínimo del producto pasa la meta, manda el mínimo', () => {
    expect(verdictOf(390, 100, 4, 3.5)).toBe('LOW')
    expect(verdictOf(400, 100, 4, 3.5)).toBe('GOOD')
    expect(verdictOf(420, 100, 4, 3.5)).toBe('GREAT')
  })

  it('sin precio o sin costo no hay semáforo', () => {
    expect(verdictOf(null, 100, 2.5, 3.5)).toBe('NONE')
    expect(verdictOf(120, 0, 2.5, 3.5)).toBe('NONE')
  })

  it('los textos del aviso', () => {
    const ctx = { multiplier: 2.5, target: 3.5 }
    expect(verdictText('GOOD', { ...ctx, ratio: 3.125 })).toBe(
      'Cubre tus costos y pasa de tu mínimo de 2.5× (aquí vendes a 3.13× tu costo).',
    )
    expect(verdictText('GREAT', { ...ctx, ratio: 4 })).toBe(
      'Excelente: vendes a 4.00× tu costo, por encima de tu meta de 3.5×.',
    )
    expect(verdictText('LOSS', { ...ctx, ratio: null })).toMatch(
      /por debajo de lo que te cuesta/,
    )
    expect(verdictText('LOW', { ...ctx, ratio: null })).toMatch(/muy barato/)
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

describe('múltiplo e impuesto', () => {
  it('el múltiplo siempre se aplica al costo total, con el mínimo del producto', () => {
    const general = productSummary({ ...redVelvet, multiplier: 2.5 })
    expect(general.whole.suggested).toBeCloseTo(423.56 * 2.5)
    // $520 no llega a ×2.5 del costo total: amarillo
    expect(general.whole.verdict).toBe('LOW')
    const gancho = productSummary({ ...redVelvet, multiplier: 1.2 })
    expect(gancho.whole.verdict).toBe('GOOD')
  })

  it('el precio sugerido suma el impuesto del producto', () => {
    const base = productSummary(redVelvet).whole.suggested ?? 0
    expect(
      productSummary({ ...redVelvet, taxPct: 16 }).whole.suggested,
    ).toBeCloseTo(base * 1.16)
    expect(
      productSummary({ ...redVelvet, taxPct: null }).whole.suggested,
    ).toBeCloseTo(base)
  })

  it('el precio ya incluye el impuesto: margen y semáforo salen de precio ÷ (1 + tasa)', () => {
    // $580 con 16% son $500 netos: ganas $76.44, no $156.44
    const s = productSummary({ ...redVelvet, price: 580, taxPct: 16 })
    expect(s.whole.netPrice).toBeCloseTo(500)
    expect(s.whole.margin?.gain).toBeCloseTo(500 - 423.56)
    expect(s.whole.margin?.ratio).toBeCloseTo(500 / 423.56)
    // el mismo precio sin impuesto sí llegaría a un margen mayor
    const sin = productSummary({ ...redVelvet, price: 580 })
    expect(sin.whole.margin?.gain).toBeCloseTo(580 - 423.56)
  })

  it('el impuesto puede bajar el semáforo: $520 con 16% son $448.28 netos', () => {
    const s = productSummary({
      ...redVelvet,
      multiplier: 1.2,
      price: 520,
    })
    expect(s.whole.verdict).toBe('GOOD')
    const conImpuesto = productSummary({
      ...redVelvet,
      multiplier: 1.2,
      price: 520,
      taxPct: 16,
    })
    expect(conImpuesto.whole.verdict).toBe('LOW')
  })

  it('la rebanada también se calcula sobre el neto', () => {
    const s = productSummary({ ...redVelvet, slicePrice: 29, taxPct: 16 })
    expect(s.slices?.netPrice).toBeCloseTo(25)
    expect(s.slices?.allSold).toBeCloseTo(875)
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
    taxTypeId: null,
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
