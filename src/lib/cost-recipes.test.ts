import { describe, expect, it } from 'vitest'

import { EMPTY_SETTINGS } from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'
import {
  hourlyRates,
  normalizeTag,
  premixSchema,
  recipeSchema,
  tagKey,
} from '#/lib/cost-recipes'

const settings: CostSettingsValues = {
  ...EMPTY_SETTINGS,
  hoursPerWeek: 15,
  electricityMonthly: 364,
  gasMonthly: 572,
  rentMonthly: 6000,
  rentSharePct: 15,
  machineryCost: 9000,
  wantedMonthly: 5200,
  defaultWastePct: 5,
}

describe('tarifas por hora de las recetas', () => {
  it('van a centavos, como se ven en Ajustes: $80.00 y $30.55', () => {
    const r = hourlyRates(settings)
    expect(r.laborPerHour).toBe(80)
    expect(r.fixedPerHour).toBe(30.55)
    expect(r.defaultWastePct).toBe(5)
    // 2 h × lo que dice la pantalla, sin diferencias de centavos
    expect(2 * (r.fixedPerHour ?? 0)).toBeCloseTo(61.1, 5)
  })

  it('sin llenar Ajustes no se inventan tarifas', () => {
    const r = hourlyRates(EMPTY_SETTINGS)
    expect(r.fixedPerHour).toBeNull()
    expect(r.laborPerHour).toBeNull()
  })

  it('sin mano de obra la tarifa es 0 (no falta)', () => {
    expect(hourlyRates({ ...settings, laborMode: 'NONE' }).laborPerHour).toBe(0)
  })
})

describe('etiquetas', () => {
  it('no distinguen mayúsculas ni espacios de más', () => {
    expect(normalizeTag('  Pastel   de   fiesta ')).toBe('Pastel de fiesta')
    expect(tagKey('PASTEL ')).toBe(tagKey(' pastel'))
    expect(tagKey('Pastel')).not.toBe(tagKey('Cupcake'))
  })
})

describe('premixSchema', () => {
  const ok = {
    name: ' Betún ',
    yieldQty: 1300,
    yieldUnit: 'G' as const,
    lines: [{ ingredientId: 'i1', quantity: 570, unit: 'G' as const }],
  }

  it('acepta una premezcla válida y vacía de renglones', () => {
    expect(premixSchema.parse(ok).name).toBe('Betún')
    expect(premixSchema.safeParse({ ...ok, lines: [] }).success).toBe(true)
    expect(premixSchema.safeParse({ ...ok, yieldQty: null }).success).toBe(true)
  })

  it('rechaza nombre vacío, rendimiento 0, rendir en piezas y cantidades de 0', () => {
    expect(premixSchema.safeParse({ ...ok, name: ' ' }).success).toBe(false)
    expect(premixSchema.safeParse({ ...ok, yieldQty: 0 }).success).toBe(false)
    expect(premixSchema.safeParse({ ...ok, yieldUnit: 'PZA' }).success).toBe(
      false,
    )
    expect(
      premixSchema.safeParse({
        ...ok,
        lines: [{ ingredientId: 'i1', quantity: 0, unit: 'G' }],
      }).success,
    ).toBe(false)
  })
})

describe('recipeSchema', () => {
  const ok = {
    name: 'Pastel Red Velvet',
    tagName: 'Pastel',
    yieldPieces: 1,
    laborHours: 3,
    ovenHours: 2,
    includeLabor: true,
    includeFixed: true,
    includeWaste: true,
    wastePct: 5,
    lines: [
      {
        kind: 'ingredient' as const,
        refId: 'i1',
        quantity: 450,
        unit: 'G' as const,
      },
    ],
  }

  it('acepta una receta válida, con horas y piezas vacías', () => {
    expect(recipeSchema.safeParse(ok).success).toBe(true)
    expect(
      recipeSchema.safeParse({
        ...ok,
        yieldPieces: null,
        laborHours: null,
        ovenHours: null,
      }).success,
    ).toBe(true)
  })

  it('rinde piezas enteras, de 1 en adelante', () => {
    expect(recipeSchema.safeParse({ ...ok, yieldPieces: 0 }).success).toBe(
      false,
    )
    expect(recipeSchema.safeParse({ ...ok, yieldPieces: 1.5 }).success).toBe(
      false,
    )
    expect(recipeSchema.safeParse({ ...ok, yieldPieces: 24 }).success).toBe(
      true,
    )
  })

  it('rechaza horas negativas, merma de 100 y cantidades de 0', () => {
    expect(recipeSchema.safeParse({ ...ok, laborHours: -1 }).success).toBe(
      false,
    )
    expect(recipeSchema.safeParse({ ...ok, wastePct: 100 }).success).toBe(false)
    expect(
      recipeSchema.safeParse({
        ...ok,
        lines: [{ kind: 'premix', refId: 'p1', quantity: 0, unit: 'G' }],
      }).success,
    ).toBe(false)
  })
})
