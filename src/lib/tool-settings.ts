import type { CostSettings } from '@prisma/client'
import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { EMPTY_SETTINGS, settingsSchema } from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'
import { requireTool } from '#/lib/tool-access'

// Ajustes de costos de la dueña (`context.userId`): una sola fila por alumna, que se crea al
// guardar por primera vez. Mientras no exista, la pantalla muestra los campos vacíos.

const n = (value: { toString: () => string } | null) =>
  value === null ? null : Number(value)

const toValues = (row: CostSettings): CostSettingsValues => ({
  hoursPerWeek: n(row.hoursPerWeek),
  ovenKw: n(row.ovenKw),
  kwhPrice: n(row.kwhPrice),
  gasKgPerHour: n(row.gasKgPerHour),
  gasPricePerKg: n(row.gasPricePerKg),
  rentMonthly: n(row.rentMonthly),
  rentSharePct: n(row.rentSharePct),
  equipCost: n(row.equipCost),
  equipLifeHours: n(row.equipLifeHours),
  laborMode: row.laborMode,
  wantedMonthly: n(row.wantedMonthly),
  dailyMinWage: n(row.dailyMinWage),
  multiplier: n(row.multiplier),
  defaultWastePct: n(row.defaultWastePct),
  priceBase: row.priceBase,
  sellsAsBusiness: row.sellsAsBusiness,
  taxPct: n(row.taxPct),
})

export const getCostSettings = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const row = await prisma.costSettings.findUnique({
      where: { userId: context.userId },
    })
    return row ? toValues(row) : EMPTY_SETTINGS
  })

export const saveCostSettings = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(settingsSchema)
  .handler(async ({ data, context }) => {
    // Los impuestos solo cuentan si vende como negocio.
    const values = {
      ...data,
      taxPct: data.sellsAsBusiness ? data.taxPct : null,
    }
    await prisma.costSettings.upsert({
      where: { userId: context.userId },
      create: { userId: context.userId, ...values },
      update: values,
    })
    return { ok: true as const }
  })
