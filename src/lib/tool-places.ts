import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { requireTool } from '#/lib/tool-access'

// Lugares de compra de la herramienta de costos. Todo se limita a la dueña (`context.userId`):
// una alumna nunca lee ni cambia los de otra.

const placeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  note: z.string().trim().max(120),
})

export const getPlaces = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const places = await prisma.costPlace.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { ingredients: { where: { archivedAt: null } } } },
      },
    })
    return places.map((p) => ({
      id: p.id,
      name: p.name,
      note: p.note ?? '',
      ingredients: p._count.ingredients,
    }))
  })

export const createPlace = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ name: placeSchema.shape.name }))
  .handler(async ({ data, context }) => {
    const place = await prisma.costPlace.create({
      data: { userId: context.userId, name: data.name },
    })
    return { id: place.id }
  })

export const updatePlace = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(placeSchema.extend({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costPlace.updateMany({
      where: { id: data.id, userId: context.userId },
      data: { name: data.name, note: data.note || null },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// Sus ingredientes no se borran: quedan "Sin lugar asignado".
export const deletePlace = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costPlace.deleteMany({
      where: { id: data.id, userId: context.userId },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })
