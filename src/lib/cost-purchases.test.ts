import { describe, expect, it } from 'vitest'

import {
  changeLabel,
  formatDay,
  priceChange,
  purchaseSchema,
} from '#/lib/cost-purchases'

// Las compras de la maqueta: huevo $251 → $265, mantequilla $46 → $48.50, harina igual y queso
// crema $109 → $104.
describe('cuánto cambió un precio', () => {
  it('sube: huevo ▲ 5.6% y mantequilla ▲ 5.4%', () => {
    expect(changeLabel(priceChange(251, 265))).toBe('▲ 5.6%')
    expect(changeLabel(priceChange(46, 48.5))).toBe('▲ 5.4%')
  })

  it('baja: queso crema ▼ 4.6%', () => {
    expect(changeLabel(priceChange(109, 104))).toBe('▼ 4.6%')
  })

  it('igual cuando no cambió (o cambió menos de medio centavo)', () => {
    expect(changeLabel(priceChange(13, 13))).toBe('Igual')
    expect(changeLabel(priceChange(13, 13.004))).toBe('Igual')
  })

  it('sin precio anterior es "Nuevo" y no hay porcentaje', () => {
    expect(priceChange(0, 20)).toEqual({ kind: 'NEW', pct: null })
    expect(changeLabel(priceChange(0, 20))).toBe('Nuevo')
  })

  it('el porcentaje va con un decimal y sin signo (la flecha dice la dirección)', () => {
    expect(priceChange(100, 150)).toEqual({ kind: 'UP', pct: 50 })
    expect(priceChange(100, 50)).toEqual({ kind: 'DOWN', pct: 50 })
  })
})

describe('fecha de la compra', () => {
  it('"10 oct 2026" sin punto, aunque la zona horaria sea otra', () => {
    expect(formatDay('2026-10-10T00:00:00.000Z')).toBe('10 oct 2026')
    expect(formatDay(new Date('2026-09-30T00:00:00Z'))).toBe('30 sep 2026')
  })
})

describe('purchaseSchema', () => {
  const ok = {
    placeId: 'p1',
    date: '2026-10-13',
    items: [{ ingredientId: 'i1', price: 265, packGrams: null }],
  }

  it('acepta una compra válida, con o sin tienda', () => {
    expect(purchaseSchema.safeParse(ok).success).toBe(true)
    expect(purchaseSchema.safeParse({ ...ok, placeId: null }).success).toBe(
      true,
    )
  })

  it('exige al menos un ingrediente y una fecha de un día', () => {
    expect(purchaseSchema.safeParse({ ...ok, items: [] }).success).toBe(false)
    expect(
      purchaseSchema.safeParse({ ...ok, date: '13 oct 2026' }).success,
    ).toBe(false)
    expect(purchaseSchema.safeParse({ ...ok, date: '' }).success).toBe(false)
  })

  it('rechaza precios negativos y pesos de 0', () => {
    const bad = (item: object) =>
      purchaseSchema.safeParse({ ...ok, items: [{ ...ok.items[0], ...item }] })
        .success
    expect(bad({ price: -1 })).toBe(false)
    expect(bad({ packGrams: 0 })).toBe(false)
    expect(bad({ price: 0 })).toBe(true)
    expect(bad({ packGrams: 10260 })).toBe(true)
  })
})
