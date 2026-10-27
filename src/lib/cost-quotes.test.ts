import { describe, expect, it } from 'vitest'

import { quoteSchema, quoteSummary } from '#/lib/cost-quotes'

// Cifras de la maqueta: pastel de $423.56, 3 h de decorado y 0.5 h para conseguir insumos a $60
// la hora, y dos extras ($90 y $35) = $758.56.
const maqueta = {
  unitCost: 423.56,
  quantity: 1,
  decorHours: 3,
  sourcingHours: 0.5,
  rate: 60,
  extras: [90, 35],
}

describe('quoteSummary', () => {
  it('suma costo, horas extra y extras como la maqueta', () => {
    expect(quoteSummary(maqueta)).toEqual({
      hours: 3.5,
      product: 423.56,
      hoursCost: 210,
      extras: 125,
      floor: 758.56,
    })
  })

  it('el costo del producto se multiplica por la cantidad; las horas extra no', () => {
    const s = quoteSummary({ ...maqueta, quantity: 3 })
    expect(s.product).toBe(1270.68)
    expect(s.hoursCost).toBe(210)
    expect(s.floor).toBe(1605.68)
  })

  it('sin horas extra ni extras, el mínimo es el costo del producto', () => {
    const s = quoteSummary({
      ...maqueta,
      decorHours: 0,
      sourcingHours: 0,
      extras: [],
    })
    expect(s.floor).toBe(423.56)
    expect(s.hours).toBe(0)
  })

  it('redondea cada renglón a centavos', () => {
    const s = quoteSummary({
      unitCost: 100.005,
      quantity: 1,
      decorHours: 0.333,
      sourcingHours: 0,
      rate: 80.55,
      extras: [0.1, 0.2],
    })
    expect(s.product).toBe(100.01)
    expect(s.hoursCost).toBe(26.82)
    expect(s.extras).toBe(0.3)
    expect(s.floor).toBe(127.13)
  })

  it('con horas extra y sin tarifa de mano de obra no hay mínimo', () => {
    const s = quoteSummary({ ...maqueta, rate: null })
    expect(s.hoursCost).toBeNull()
    expect(s.floor).toBeNull()
  })

  it('sin horas extra la tarifa no hace falta', () => {
    const s = quoteSummary({
      ...maqueta,
      decorHours: 0,
      sourcingHours: 0,
      rate: null,
    })
    expect(s.hoursCost).toBe(0)
    expect(s.floor).toBe(548.56)
  })

  it('con mano de obra en cero (no sumar) las horas extra no cuestan', () => {
    const s = quoteSummary({ ...maqueta, rate: 0 })
    expect(s.hoursCost).toBe(0)
    expect(s.floor).toBe(548.56)
  })

  it('un producto sin costo no tiene mínimo', () => {
    expect(quoteSummary({ ...maqueta, unitCost: null }).floor).toBeNull()
  })
})

describe('quoteSchema', () => {
  const valid = {
    productId: 'p1',
    quantity: 1,
    decorHours: 3,
    sourcingHours: 0.5,
    extras: [{ name: 'Muñeco de dinosaurio', cost: 90 }],
  }

  it('acepta una cotización completa', () => {
    expect(quoteSchema.safeParse(valid).success).toBe(true)
  })

  it('pide un producto y una cantidad entera de 1 en adelante', () => {
    expect(quoteSchema.safeParse({ ...valid, productId: '' }).success).toBe(
      false,
    )
    expect(quoteSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
    expect(quoteSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(
      false,
    )
  })

  it('no acepta horas negativas', () => {
    expect(quoteSchema.safeParse({ ...valid, decorHours: -1 }).success).toBe(
      false,
    )
    expect(
      quoteSchema.safeParse({ ...valid, sourcingHours: -0.5 }).success,
    ).toBe(false)
  })

  it('un extra lleva nombre y un costo mayor que cero', () => {
    const bad = (extra: object) =>
      quoteSchema.safeParse({ ...valid, extras: [extra] }).success
    expect(bad({ name: '  ', cost: 10 })).toBe(false)
    expect(bad({ name: 'Palitos', cost: 0 })).toBe(false)
    expect(bad({ name: 'Palitos', cost: -5 })).toBe(false)
    expect(bad({ name: 'Palitos', cost: 35 })).toBe(true)
  })
})
