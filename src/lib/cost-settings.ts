import { z } from 'zod'

// Ajustes de costos: lo que la alumna escribe una sola vez y lo que sale de ahí (horas al mes,
// gasto fijo por hora, mano de obra por hora, ejemplo del múltiplo). Solo reglas y números, sin
// base de datos: se usa en el formulario (para mostrar los cálculos en vivo) y en el servidor.

export const WEEKS_PER_MONTH = 4.33
export const HOURS_PER_WORKDAY = 8

export type LaborMode = 'WANTED' | 'MINIMUM_WAGE' | 'NONE'

// Múltiplo del costo total (recomendación de la chef, por su experiencia): el mínimo con el que
// conviene vender y la meta a la que apuntar.
export const DEFAULT_MULTIPLIER = 2.5
export const DEFAULT_TARGET_MULTIPLIER = 3.5

// Lo que se guarda; `null` es "aún no lo escribió".
export type CostSettingsValues = {
  hoursPerWeek: number | null
  electricityMonthly: number | null
  gasMonthly: number | null
  rentMonthly: number | null
  rentSharePct: number | null
  machineryCost: number | null
  // Años de vida; sin valor se usan los de por defecto.
  machineryYears: number | null
  moldsCost: number | null
  moldsYears: number | null
  laborMode: LaborMode
  wantedMonthly: number | null
  dailyMinWage: number | null
  multiplier: number | null
  targetMultiplier: number | null
  defaultWastePct: number | null
}

export const EMPTY_SETTINGS: CostSettingsValues = {
  hoursPerWeek: null,
  electricityMonthly: null,
  gasMonthly: null,
  rentMonthly: null,
  rentSharePct: null,
  machineryCost: null,
  machineryYears: null,
  moldsCost: null,
  moldsYears: null,
  laborMode: 'WANTED',
  wantedMonthly: null,
  dailyMinWage: null,
  multiplier: DEFAULT_MULTIPLIER,
  targetMultiplier: DEFAULT_TARGET_MULTIPLIER,
  defaultWastePct: null,
}

const num = (min: number, max: number) =>
  z.number().min(min, 'No puede ser negativo.').max(max, 'Es demasiado grande.')
const optional = (min: number, max: number) => num(min, max).nullable()

// Años de vida del equipo: de medio año a 50.
const years = z
  .number()
  .min(0.5, 'Son al menos medio año.')
  .max(50, 'Es demasiado.')
  .nullable()

export const settingsSchema = z
  .object({
    hoursPerWeek: optional(0, 168),
    electricityMonthly: optional(0, 100_000_000),
    gasMonthly: optional(0, 100_000_000),
    rentMonthly: optional(0, 100_000_000),
    rentSharePct: optional(0, 100),
    machineryCost: optional(0, 100_000_000),
    machineryYears: years,
    moldsCost: optional(0, 100_000_000),
    moldsYears: years,
    laborMode: z.enum(['WANTED', 'MINIMUM_WAGE', 'NONE']),
    wantedMonthly: optional(0, 100_000_000),
    dailyMinWage: optional(0, 100_000),
    // Es un múltiplo del costo: menos de 1 sería vender por debajo del costo.
    multiplier: z
      .number()
      .min(1, 'El múltiplo es de 1 en adelante: 1 es vender al costo.')
      .max(100)
      .nullable(),
    targetMultiplier: z
      .number()
      .min(1, 'La meta es de 1 en adelante.')
      .max(100)
      .nullable(),
    defaultWastePct: optional(0, 99),
  })
  .superRefine((v, ctx) => {
    if (
      v.multiplier !== null &&
      v.targetMultiplier !== null &&
      v.targetMultiplier < v.multiplier
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetMultiplier'],
        message: 'La meta no puede ser menor que el mínimo.',
      })
    }
  })

// Horas al mes: las de la semana por 4.33, redondeadas (15 × 4.33 = 64.95 → 65).
export function monthlyHours(s: Pick<CostSettingsValues, 'hoursPerWeek'>) {
  return s.hoursPerWeek ? Math.round(s.hoursPerWeek * WEEKS_PER_MONTH) : null
}

// Años de vida del equipo si la alumna no los cambia (modo fácil): maquinaria (horno, batidora) y
// moldes y charolas.
export const DEFAULT_MACHINERY_YEARS = 5
export const DEFAULT_MOLDS_YEARS = 3

// Lo que se desgasta el equipo cada mes: precio ÷ (años × 12), con los años de cada tipo.
export function monthlyDepreciation(
  s: Pick<
    CostSettingsValues,
    'machineryCost' | 'machineryYears' | 'moldsCost' | 'moldsYears'
  >,
) {
  const part = (cost: number | null, life: number | null, fallback: number) =>
    cost === null ? null : cost / ((life ?? fallback) * 12)
  const machinery = part(
    s.machineryCost,
    s.machineryYears,
    DEFAULT_MACHINERY_YEARS,
  )
  const molds = part(s.moldsCost, s.moldsYears, DEFAULT_MOLDS_YEARS)
  return {
    machinery,
    molds,
    total:
      machinery === null && molds === null
        ? null
        : (machinery ?? 0) + (molds ?? 0),
  }
}

const perHourOf = (monthly: number | null, hours: number | null) =>
  monthly === null || !hours ? null : monthly / hours

// Gastos fijos por hora de producción: (renta × % que ocupa + gas + luz + depreciación mensual del
// equipo) ÷ horas al mes. Cada parte es `null` hasta que están todos sus datos (y las horas); el
// total suma las que ya se pueden calcular.
export function fixedCostPerHour(s: CostSettingsValues) {
  const hours = monthlyHours(s)
  const rentMonthly =
    s.rentMonthly !== null && s.rentSharePct !== null
      ? s.rentMonthly * (s.rentSharePct / 100)
      : null
  const depreciation = monthlyDepreciation(s)
  const parts = {
    electricity: perHourOf(s.electricityMonthly, hours),
    gas: perHourOf(s.gasMonthly, hours),
    rent: perHourOf(rentMonthly, hours),
    depreciation: perHourOf(depreciation.total, hours),
  }
  return {
    ...parts,
    // Lo que se paga al mes por la renta, con el % que ocupa (para mostrar la cuenta).
    rentMonthly,
    depreciationMonthly: depreciation.total,
    total: Object.values(parts).reduce<number>((sum, p) => sum + (p ?? 0), 0),
  }
}

// Tu tiempo (mano de obra) por hora según cómo la calcula. `null` si falta algún dato; sin mano de obra, 0.
export function laborPerHour(s: CostSettingsValues) {
  if (s.laborMode === 'NONE') return 0
  if (s.laborMode === 'MINIMUM_WAGE') {
    return s.dailyMinWage ? s.dailyMinWage / HOURS_PER_WORKDAY : null
  }
  const hours = monthlyHours(s)
  return s.wantedMonthly !== null && hours ? s.wantedMonthly / hours : null
}

// Tu hora de trabajo con todo: tu tiempo más los gastos fijos.
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

// Nota fija de Ajustes, receta y producto: la depreciación no es contable.
export const ACCOUNTING_NOTE =
  'Este no es el método contable, es uno sencillo para que sepas cuánto necesitas generar por hora para recuperar tu equipo y que tu negocio sea rentable.'

// Tipos de impuesto que la alumna da de alta (nombre y tasa). Los que ya existen llevan su `id`.
export const taxTypesSchema = z
  .array(
    z.object({
      id: z.string().min(1).nullable(),
      name: z.string().trim().min(1, 'Escribe el nombre.').max(40),
      ratePct: z
        .number('Escribe la tasa.')
        .min(0, 'No puede ser negativa.')
        .max(100, 'Es demasiado grande.'),
    }),
  )
  .max(20, 'Son demasiados impuestos.')
