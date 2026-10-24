import { z } from 'zod'

import { fixedCostPerHour, laborPerHour } from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'

// Lo que se guarda de una premezcla y de una receta, y lo que de ahí se necesita de los ajustes.
// Solo esquemas y reglas (sin base de datos): el formulario y el servidor validan lo mismo.

const unit = z.enum(['G', 'KG', 'ML', 'L', 'PZA'])
const quantity = z
  .number()
  .positive('Escribe una cantidad mayor a 0.')
  .max(10_000_000, 'Es demasiado grande.')

export const premixSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(80),
  // Lo que de verdad le quedó, en peso o volumen (nunca en piezas).
  yieldQty: z
    .number()
    .positive('Escribe cuánto rindió de verdad.')
    .max(10_000_000)
    .nullable(),
  yieldUnit: z.enum(['G', 'KG', 'ML', 'L']),
  lines: z
    .array(z.object({ ingredientId: z.string().min(1), quantity, unit }))
    .max(100),
})

const hours = z
  .number()
  .min(0, 'No puede ser negativo.')
  .max(1000, 'Es demasiado grande.')
  .nullable()

export const recipeSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(80),
  // Se escribe al crear la receta; si no existe, se crea (sin mayúsculas ni espacios de más).
  tagName: z.string().trim().max(40),
  yieldPieces: z
    .number()
    .int('Las piezas son un número entero.')
    .min(1, 'Rinde al menos 1 pieza.')
    .max(100_000)
    .nullable(),
  laborHours: hours,
  ovenHours: hours,
  includeLabor: z.boolean(),
  includeFixed: z.boolean(),
  includeWaste: z.boolean(),
  wastePct: z
    .number()
    .min(0, 'No puede ser negativo.')
    .max(99, 'De 0 a 99.')
    .nullable(),
  lines: z
    .array(
      z.object({
        kind: z.enum(['ingredient', 'premix']),
        refId: z.string().min(1),
        quantity,
        unit,
      }),
    )
    .max(200),
})

export type PremixInput = z.input<typeof premixSchema>
export type RecipeInput = z.input<typeof recipeSchema>

const cents = (value: number) => Math.round(value * 100) / 100

// Mano de obra y gasto fijo por hora que usan las recetas. `null` es "aún no los llenó en Ajustes";
// el gasto fijo sin ningún dato (ni luz, gas, renta ni equipo) también cuenta como sin llenar.
export function hourlyRates(settings: CostSettingsValues) {
  const fixed = fixedCostPerHour(settings)
  const anyFixed = [
    fixed.electricity,
    fixed.gas,
    fixed.rent,
    fixed.depreciation,
  ].some((part) => part !== null)
  const labor = laborPerHour(settings)
  return {
    // A centavos, como se ven en Ajustes: "2 h × $30.05" tiene que dar lo que dice la pantalla.
    laborPerHour: labor === null ? null : cents(labor),
    fixedPerHour: anyFixed ? cents(fixed.total) : null,
    defaultWastePct: settings.defaultWastePct,
  }
}

// Etiquetas: sin distinguir mayúsculas ni espacios de más ("pastel " y "Pastel" son la misma).
export const normalizeTag = (name: string) => name.trim().replace(/\s+/g, ' ')
export const tagKey = (name: string) => normalizeTag(name).toLowerCase()
