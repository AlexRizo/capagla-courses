import { describe, expect, it } from 'vitest'

import {
  EMPTY_SETTINGS,
  fixedCostPerHour,
  fullHour,
  laborPerHour,
  monthlyHours,
  multiplierExample,
  settingsSchema,
} from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'

// Los números del ejemplo de la maqueta: 15 h por semana, horno de 2 kW a $2.80, gas 0.4 kg/h a
// $22, renta de $6,000 con el 15%, horno de $9,000 que dura 5,000 h y $5,200 al mes.
const example: CostSettingsValues = {
  ...EMPTY_SETTINGS,
  hoursPerWeek: 15,
  ovenKw: 2,
  kwhPrice: 2.8,
  gasKgPerHour: 0.4,
  gasPricePerKg: 22,
  rentMonthly: 6000,
  rentSharePct: 15,
  equipCost: 9000,
  equipLifeHours: 5000,
  wantedMonthly: 5200,
  multiplier: 1.43,
}

describe('horas al mes', () => {
  it('15 por semana son 65 al mes (15 × 4.33, redondeado)', () => {
    expect(monthlyHours(example)).toBe(65)
  })

  it('sin horas no hay horas al mes', () => {
    expect(monthlyHours(EMPTY_SETTINGS)).toBeNull()
    expect(monthlyHours({ hoursPerWeek: 0 })).toBeNull()
  })
})

describe('gasto fijo por hora', () => {
  it('suma luz, gas, renta y depreciación como la maqueta', () => {
    const c = fixedCostPerHour(example)
    expect(c.electricity).toBeCloseTo(5.6)
    expect(c.gas).toBeCloseTo(8.8)
    expect(c.rent).toBeCloseTo(13.846, 2)
    expect(c.depreciation).toBeCloseTo(1.8)
    expect(c.total).toBeCloseTo(30.05, 1)
  })

  it('la renta se reparte entre las horas al mes: sin horas no se calcula', () => {
    const c = fixedCostPerHour({ ...example, hoursPerWeek: null })
    expect(c.rent).toBeNull()
    expect(c.total).toBeCloseTo(5.6 + 8.8 + 1.8)
  })

  it('con todo vacío es cero', () => {
    expect(fixedCostPerHour(EMPTY_SETTINGS).total).toBe(0)
  })
})

describe('mano de obra por hora', () => {
  it('con lo que quiere ganar: $5,200 ÷ 65 h = $80', () => {
    expect(laborPerHour(example)).toBe(80)
  })

  it('con el salario mínimo: entre 8 horas', () => {
    const s = {
      ...example,
      laborMode: 'MINIMUM_WAGE' as const,
      dailyMinWage: 248,
    }
    expect(laborPerHour(s)).toBe(31)
    expect(laborPerHour({ ...s, dailyMinWage: null })).toBeNull()
  })

  it('sin sumar mano de obra es cero', () => {
    expect(laborPerHour({ ...example, laborMode: 'NONE' })).toBe(0)
  })

  it('falta un dato: no se inventa un valor', () => {
    expect(laborPerHour({ ...example, wantedMonthly: null })).toBeNull()
    expect(laborPerHour({ ...example, hoursPerWeek: null })).toBeNull()
  })
})

describe('tu hora con todo', () => {
  it('mano de obra más gasto fijo: $80 + $30.05', () => {
    expect(fullHour(example)).toBeCloseTo(110.05, 1)
  })

  it('sin mano de obra es solo el gasto fijo', () => {
    expect(fullHour({ ...example, laborMode: 'NONE' })).toBeCloseTo(30.05, 1)
  })

  it('con la mano de obra sin calcular, no hay total', () => {
    expect(fullHour({ ...example, laborMode: 'MINIMUM_WAGE' })).toBeNull()
  })
})

describe('ejemplo del múltiplo', () => {
  it('×1.43 de $100: lo vendes a $143, tu costo es el 70% y ganas $43 (30%)', () => {
    const e = multiplierExample(1.43)
    expect(e.price).toBeCloseTo(143)
    expect(Math.round(e.costPct)).toBe(70)
    expect(e.gain).toBeCloseTo(43)
    expect(Math.round(e.gainPct)).toBe(30)
  })

  it('×3 de $100 es $300 (no 30%)', () => {
    expect(multiplierExample(3).price).toBe(300)
  })
})

describe('settingsSchema', () => {
  it('acepta los ajustes de ejemplo y los vacíos', () => {
    expect(settingsSchema.safeParse(example).success).toBe(true)
    expect(settingsSchema.safeParse(EMPTY_SETTINGS).success).toBe(true)
  })

  it('rechaza negativos, porcentajes pasados de 100 y múltiplos menores a 1', () => {
    expect(
      settingsSchema.safeParse({ ...example, rentMonthly: -1 }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...example, rentSharePct: 101 }).success,
    ).toBe(false)
    expect(settingsSchema.safeParse({ ...example, taxPct: 120 }).success).toBe(
      false,
    )
    expect(
      settingsSchema.safeParse({ ...example, multiplier: 0.9 }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...example, defaultWastePct: 100 }).success,
    ).toBe(false)
  })
})
