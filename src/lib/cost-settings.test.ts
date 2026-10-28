import { describe, expect, it } from 'vitest'

import {
  EMPTY_SETTINGS,
  fixedCostPerHour,
  fullHour,
  laborPerHour,
  monthlyDepreciation,
  monthlyHours,
  multiplierExample,
  settingsSchema,
  taxTypesSchema,
} from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'

// Ejemplo: 15 h por semana (65 al mes), luz $364 y gas $572 al mes, renta de $6,000 con el 15%,
// maquinaria de $9,000 (5 años por defecto) y $5,200 al mes que quiere ganar.
const example: CostSettingsValues = {
  ...EMPTY_SETTINGS,
  hoursPerWeek: 15,
  electricityMonthly: 364,
  gasMonthly: 572,
  rentMonthly: 6000,
  rentSharePct: 15,
  machineryCost: 9000,
  wantedMonthly: 5200,
  multiplier: 2.5,
  targetMultiplier: 3.5,
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

describe('gastos fijos por hora', () => {
  it('(renta × % + gas + luz + depreciación) ÷ horas al mes', () => {
    const c = fixedCostPerHour(example)
    expect(c.electricity).toBeCloseTo(5.6)
    expect(c.gas).toBeCloseTo(8.8)
    expect(c.rent).toBeCloseTo(13.846, 2)
    // $9,000 ÷ (5 años × 12) = $150 al mes ÷ 65 h
    expect(c.depreciationMonthly).toBeCloseTo(150)
    expect(c.depreciation).toBeCloseTo(2.308, 2)
    expect(c.total).toBeCloseTo((364 + 572 + 900 + 150) / 65, 4)
  })

  it('todo se reparte entre las horas al mes: sin horas no se calcula', () => {
    const c = fixedCostPerHour({ ...example, hoursPerWeek: null })
    expect(c.rent).toBeNull()
    expect(c.electricity).toBeNull()
    expect(c.total).toBe(0)
  })

  it('con todo vacío es cero', () => {
    expect(fixedCostPerHour(EMPTY_SETTINGS).total).toBe(0)
  })
})

describe('depreciación del equipo', () => {
  it('maquinaria a 5 años y moldes a 3 por defecto', () => {
    const d = monthlyDepreciation({
      machineryCost: 6000,
      machineryYears: null,
      moldsCost: 1800,
      moldsYears: null,
    })
    expect(d.machinery).toBeCloseTo(100)
    expect(d.molds).toBeCloseTo(50)
    expect(d.total).toBeCloseTo(150)
  })

  it('en modo pro la alumna cambia los años', () => {
    const d = monthlyDepreciation({
      machineryCost: 6000,
      machineryYears: 10,
      moldsCost: null,
      moldsYears: null,
    })
    expect(d.machinery).toBeCloseTo(50)
    expect(d.molds).toBeNull()
    expect(d.total).toBeCloseTo(50)
  })

  it('sin equipo no hay depreciación', () => {
    expect(monthlyDepreciation(EMPTY_SETTINGS).total).toBeNull()
  })

  it('los años son de medio año a 50', () => {
    expect(
      settingsSchema.safeParse({ ...example, machineryYears: 0.2 }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...example, moldsYears: 3 }).success,
    ).toBe(true)
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
  it('tu tiempo más gastos fijos: $80 + $30.55', () => {
    expect(fullHour(example)).toBeCloseTo(110.55, 1)
  })

  it('sin tu tiempo son solo los gastos fijos', () => {
    expect(fullHour({ ...example, laborMode: 'NONE' })).toBeCloseTo(30.55, 1)
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
    expect(
      settingsSchema.safeParse({ ...example, multiplier: 0.9 }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...example, defaultWastePct: 100 }).success,
    ).toBe(false)
  })

  it('la meta no puede ser menor que el mínimo', () => {
    expect(
      settingsSchema.safeParse({ ...example, targetMultiplier: 2 }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...example, targetMultiplier: 2.5 }).success,
    ).toBe(true)
  })

  it('los ajustes vacíos arrancan con los recomendados: ×2.5 y ×3.5', () => {
    expect(EMPTY_SETTINGS.multiplier).toBe(2.5)
    expect(EMPTY_SETTINGS.targetMultiplier).toBe(3.5)
  })
})

describe('tipos de impuesto', () => {
  it('nombre y tasa de 0 a 100', () => {
    expect(
      taxTypesSchema.safeParse([{ id: null, name: ' IVA ', ratePct: 16 }])
        .success,
    ).toBe(true)
    expect(
      taxTypesSchema.safeParse([{ id: null, name: '', ratePct: 16 }]).success,
    ).toBe(false)
    expect(
      taxTypesSchema.safeParse([{ id: null, name: 'IVA', ratePct: 120 }])
        .success,
    ).toBe(false)
    expect(
      taxTypesSchema.safeParse([{ id: 'x', name: 'IVA', ratePct: -1 }]).success,
    ).toBe(false)
  })
})
