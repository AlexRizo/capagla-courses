import { z } from 'zod'

// Ajustes de costos: lo que la alumna escribe una sola vez y lo que sale de ahí (horas al mes,
// gasto fijo por hora, mano de obra por hora, ejemplo del múltiplo). Solo reglas y números, sin
// base de datos: se usa en el formulario (para mostrar los cálculos en vivo) y en el servidor.

export const WEEKS_PER_MONTH = 4.33
export const HOURS_PER_WORKDAY = 8

export type LaborMode = 'WANTED' | 'MINIMUM_WAGE' | 'NONE'
export type PriceBase = 'TOTAL' | 'INGREDIENTS'

// Lo que se guarda; `null` es "aún no lo escribió".
export type CostSettingsValues = {
  hoursPerWeek: number | null
  ovenKw: number | null
  kwhPrice: number | null
  gasKgPerHour: number | null
  gasPricePerKg: number | null
  rentMonthly: number | null
  rentSharePct: number | null
  equipCost: number | null
  equipLifeHours: number | null
  laborMode: LaborMode
  wantedMonthly: number | null
  dailyMinWage: number | null
  multiplier: number | null
  defaultWastePct: number | null
  priceBase: PriceBase
  sellsAsBusiness: boolean
  taxPct: number | null
}

export const EMPTY_SETTINGS: CostSettingsValues = {
  hoursPerWeek: null,
  ovenKw: null,
  kwhPrice: null,
  gasKgPerHour: null,
  gasPricePerKg: null,
  rentMonthly: null,
  rentSharePct: null,
  equipCost: null,
  equipLifeHours: null,
  laborMode: 'WANTED',
  wantedMonthly: null,
  dailyMinWage: null,
  multiplier: null,
  defaultWastePct: null,
  priceBase: 'TOTAL',
  sellsAsBusiness: false,
  taxPct: null,
}

const num = (min: number, max: number) =>
  z.number().min(min, 'No puede ser negativo.').max(max, 'Es demasiado grande.')
const optional = (min: number, max: number) => num(min, max).nullable()

export const settingsSchema = z.object({
  hoursPerWeek: optional(0, 168),
  ovenKw: optional(0, 1000),
  kwhPrice: optional(0, 1000),
  gasKgPerHour: optional(0, 1000),
  gasPricePerKg: optional(0, 100_000),
  rentMonthly: optional(0, 100_000_000),
  rentSharePct: optional(0, 100),
  equipCost: optional(0, 100_000_000),
  equipLifeHours: optional(0, 10_000_000),
  laborMode: z.enum(['WANTED', 'MINIMUM_WAGE', 'NONE']),
  wantedMonthly: optional(0, 100_000_000),
  dailyMinWage: optional(0, 100_000),
  // Es un múltiplo del costo: menos de 1 sería vender por debajo del costo.
  multiplier: z
    .number()
    .min(1, 'El múltiplo es de 1 en adelante: 1 es vender al costo.')
    .max(100)
    .nullable(),
  defaultWastePct: optional(0, 99),
  priceBase: z.enum(['TOTAL', 'INGREDIENTS']),
  sellsAsBusiness: z.boolean(),
  taxPct: optional(0, 100),
})

// Horas al mes: las de la semana por 4.33, redondeadas (15 × 4.33 = 64.95 → 65).
export function monthlyHours(s: Pick<CostSettingsValues, 'hoursPerWeek'>) {
  return s.hoursPerWeek ? Math.round(s.hoursPerWeek * WEEKS_PER_MONTH) : null
}

const product = (a: number | null, b: number | null) =>
  a === null || b === null ? null : a * b

// Lo que cuesta una hora de cocina encendida (sin contar tu sueldo). Cada parte es `null` hasta
// que están todos sus datos; el total suma las que ya se pueden calcular.
export function fixedCostPerHour(s: CostSettingsValues) {
  const hours = monthlyHours(s)
  const electricity = product(s.ovenKw, s.kwhPrice)
  const gas = product(s.gasKgPerHour, s.gasPricePerKg)
  const rent =
    s.rentMonthly !== null && s.rentSharePct !== null && hours
      ? (s.rentMonthly * (s.rentSharePct / 100)) / hours
      : null
  const depreciation =
    s.equipCost !== null && s.equipLifeHours
      ? s.equipCost / s.equipLifeHours
      : null
  const parts = [electricity, gas, rent, depreciation]
  return {
    electricity,
    gas,
    rent,
    depreciation,
    total: parts.reduce<number>((sum, p) => sum + (p ?? 0), 0),
  }
}

// Mano de obra por hora según cómo la calcula. `null` si falta algún dato; sin mano de obra, 0.
export function laborPerHour(s: CostSettingsValues) {
  if (s.laborMode === 'NONE') return 0
  if (s.laborMode === 'MINIMUM_WAGE') {
    return s.dailyMinWage ? s.dailyMinWage / HOURS_PER_WORKDAY : null
  }
  const hours = monthlyHours(s)
  return s.wantedMonthly !== null && hours ? s.wantedMonthly / hours : null
}

// Tu hora de trabajo con todo: mano de obra más gasto fijo.
export function fullHour(s: CostSettingsValues) {
  const labor = laborPerHour(s)
  return labor === null ? null : labor + fixedCostPerHour(s).total
}

// Ejemplo del múltiplo con un costo de $100 (como la maqueta): a cuánto lo vendes, qué parte del
// precio es tu costo y cuánto ganas.
export function multiplierExample(multiplier: number, cost = 100) {
  const price = cost * multiplier
  const gain = price - cost
  return {
    price,
    costPct: (cost / price) * 100,
    gain,
    gainPct: (gain / price) * 100,
  }
}
