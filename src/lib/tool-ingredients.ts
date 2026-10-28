import { notFound } from '@tanstack/react-router'
import type { CostIngredient } from '@prisma/client'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { limitError } from '#/lib/tool-usage'
import { ingredientSchema } from '#/lib/costs'
import { requireTool } from '#/lib/tool-access'

// Ingredientes y empaques de la herramienta de costos. Todo se limita a la dueña
// (`context.userId`). Archivar no borra: lo que ya los usa sigue funcionando.

type Row = CostIngredient & { place?: { name: string } | null }

const toDto = (i: Row) => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  placeId: i.placeId,
  placeName: i.place?.name ?? null,
  price: Number(i.price),
  quantity: Number(i.quantity),
  unit: i.unit,
  flexible: i.flexible,
  sampleCount: i.sampleCount,
  sampleGrams: i.sampleGrams === null ? null : Number(i.sampleGrams),
  wasteEnabled: i.wasteEnabled,
  yieldPct: i.yieldPct,
  archived: i.archivedAt !== null,
})

export const getIngredients = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const rows = await prisma.costIngredient.findMany({
      where: { userId: context.userId },
      orderBy: { name: 'asc' },
      include: { place: { select: { name: true } } },
    })
    return rows.map(toDto)
  })

export const getIngredient = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const row = await prisma.costIngredient.findFirst({
      where: { id: data.id, userId: context.userId },
      include: { place: { select: { name: true } } },
    })
    if (!row) throw notFound()
    return toDto(row)
  })

// El lugar tiene que ser de la misma dueña: si no, se ignora y queda sin lugar.
// `createServerOnlyFn`: una función suelta con `prisma` llevaría el código del servidor al navegador.
const ownPlace = createServerOnlyFn(
  async (userId: string, placeId: string | null) => {
    if (!placeId) return null
    const place = await prisma.costPlace.findFirst({
      where: { id: placeId, userId },
      select: { id: true },
    })
    return place?.id ?? null
  },
)

export const createIngredient = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(ingredientSchema)
  .handler(async ({ data, context }) => {
    const full = await limitError(context.userId, context.tier)
    if (full) return { error: full }
    const row = await prisma.costIngredient.create({
      data: {
        ...data,
        userId: context.userId,
        placeId: await ownPlace(context.userId, data.placeId),
      },
    })
    return { id: row.id }
  })

export const updateIngredient = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string(), values: ingredientSchema }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costIngredient.updateMany({
      where: { id: data.id, userId: context.userId },
      data: {
        ...data.values,
        placeId: await ownPlace(context.userId, data.values.placeId),
      },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

export const setIngredientArchived = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costIngredient.updateMany({
      where: { id: data.id, userId: context.userId },
      data: { archivedAt: data.archived ? new Date() : null },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })
