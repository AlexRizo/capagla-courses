import type { CostSettings } from '@prisma/client'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import {
  DEFAULT_MULTIPLIER,
  DEFAULT_TARGET_MULTIPLIER,
  EMPTY_SETTINGS,
  settingsSchema,
  taxTypesSchema,
} from '#/lib/cost-settings'
import type { CostSettingsValues } from '#/lib/cost-settings'
import { requireTool } from '#/lib/tool-access'

// Ajustes de costos de la dueña (`context.userId`): una sola fila por alumna, que se crea al
// guardar por primera vez. Mientras no exista, la pantalla muestra los campos vacíos.

const n = (value: { toString: () => string } | null) =>
  value === null ? null : Number(value)

const toValues = (row: CostSettings): CostSettingsValues => ({
  hoursPerWeek: n(row.hoursPerWeek),
  electricityMonthly: n(row.electricityMonthly),
  gasMonthly: n(row.gasMonthly),
  rentMonthly: n(row.rentMonthly),
  rentSharePct: n(row.rentSharePct),
  machineryCost: n(row.machineryCost),
  machineryYears: n(row.machineryYears),
  moldsCost: n(row.moldsCost),
  moldsYears: n(row.moldsYears),
  laborMode: row.laborMode,
  wantedMonthly: n(row.wantedMonthly),
  dailyMinWage: n(row.dailyMinWage),
  // Sin valor se usan los recomendados.
  multiplier: n(row.multiplier) ?? DEFAULT_MULTIPLIER,
  targetMultiplier: n(row.targetMultiplier) ?? DEFAULT_TARGET_MULTIPLIER,
  defaultWastePct: n(row.defaultWastePct),
})

// Los ajustes de una alumna (vacíos si aún no guarda). Lo usan también las recetas, que necesitan
// su mano de obra y su gasto fijo por hora.
export const loadSettings = createServerOnlyFn(async (userId: string) => {
  const row = await prisma.costSettings.findUnique({ where: { userId } })
  return row ? toValues(row) : EMPTY_SETTINGS
})

// Los tipos de impuesto de una alumna, en el orden en que los dio de alta.
export const loadTaxTypes = createServerOnlyFn(async (userId: string) =>
  (
    await prisma.costTaxType.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  ).map((t) => ({ id: t.id, name: t.name, ratePct: Number(t.ratePct) })),
)

export const getCostSettings = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => ({
    ...(await loadSettings(context.userId)),
    taxTypes: await loadTaxTypes(context.userId),
  }))

export const saveCostSettings = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ settings: settingsSchema, taxTypes: taxTypesSchema }))
  .handler(async ({ data, context }) => {
    const userId = context.userId
    const current = await prisma.costTaxType.findMany({
      where: { userId },
      select: { id: true },
    })
    const owned = new Set(current.map((t) => t.id))
    const kept = data.taxTypes.filter((t) => t.id && owned.has(t.id))
    await prisma.$transaction([
      prisma.costSettings.upsert({
        where: { userId },
        create: { userId, ...data.settings },
        update: data.settings,
      }),
      // Lo que ya no está se borra (sus productos quedan sin impuesto); lo demás se actualiza o se crea.
      prisma.costTaxType.deleteMany({
        where: { userId, id: { notIn: kept.map((t) => t.id!) } },
      }),
      ...kept.map((t) =>
        prisma.costTaxType.update({
          where: { id: t.id! },
          data: { name: t.name, ratePct: t.ratePct },
        }),
      ),
      prisma.costTaxType.createMany({
        data: data.taxTypes
          .filter((t) => !t.id || !owned.has(t.id))
          .map((t) => ({ userId, name: t.name, ratePct: t.ratePct })),
      }),
    ])
    return { ok: true as const }
  })
