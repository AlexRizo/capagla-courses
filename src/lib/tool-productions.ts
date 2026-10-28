import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { productionSchema, productionSummary } from '#/lib/cost-shopping'
import { requireModule } from '#/lib/tool-access'
import { loadProductMetrics } from '#/lib/tool-products'

// Producciones de la herramienta de costos: lo que se va a hornear y cuántos. Todo se limita a
// la dueña (`context.userId`). Se guardan 30 días desde el último guardado y luego se limpian.

export const PRODUCTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export const getProductions = createServerFn()
  .middleware([requireModule('PRODUCTION')])
  .handler(async ({ context }) => {
    // Las vencidas se limpian al abrir la lista (sin tarea programada).
    await prisma.costProduction.deleteMany({
      where: { userId: context.userId, expiresAt: { lt: new Date() } },
    })
    const [productions, products] = await Promise.all([
      prisma.costProduction.findMany({
        where: { userId: context.userId },
        orderBy: { updatedAt: 'desc' },
        include: { items: true },
      }),
      loadProductMetrics(context.userId),
    ])
    const byId = new Map(products.map((p) => [p.id, p.metrics]))
    const now = Date.now()
    return productions.map((p) => {
      const s = productionSummary(
        p.items.map((i) => ({
          quantity: i.quantity,
          metrics: byId.get(i.productId) ?? null,
        })),
      )
      return {
        id: p.id,
        name: p.name,
        products: p.items.length,
        pieces: p.items.reduce((sum, i) => sum + i.quantity, 0),
        buy: s.buy,
        cost: s.cost,
        sales: s.sales,
        daysLeft: Math.max(
          0,
          Math.ceil((p.expiresAt.getTime() - now) / DAY_MS),
        ),
      }
    })
  })

// Lo que necesita el formulario de una producción (nueva si `id` es null): los productos que se
// pueden elegir, con lo que cuestan y valen, para mostrar el resumen mientras se arma.
export const getProductionForm = createServerFn()
  .middleware([requireModule('PRODUCTION')])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const row = data.id
      ? await prisma.costProduction.findFirst({
          where: { id: data.id, userId: context.userId },
          include: { items: { orderBy: { position: 'asc' } } },
        })
      : null
    if (data.id && !row) throw notFound()
    const keep = new Set(row?.items.map((i) => i.productId))
    const products = await loadProductMetrics(context.userId)
    return {
      production: row && {
        id: row.id,
        name: row.name,
        items: row.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      },
      products: products.filter((p) => !p.archived || keep.has(p.id)),
    }
  })

export const saveProduction = createServerFn({ method: 'POST' })
  .middleware([requireModule('PRODUCTION')])
  .validator(z.object({ id: z.string().nullable(), values: productionSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const ids = values.items.map((i) => i.productId)
    if (new Set(ids).size !== ids.length) {
      return { error: 'Un producto solo puede estar una vez en la producción.' }
    }
    const owned = await prisma.costProduct.count({
      where: { userId: context.userId, id: { in: ids } },
    })
    if (owned !== ids.length) return { error: 'Hay un producto que no existe.' }
    const items = values.items.map((i, position) => ({ ...i, position }))
    const fields = {
      name: values.name,
      expiresAt: new Date(Date.now() + PRODUCTION_DAYS * DAY_MS),
    }
    if (data.id) {
      const found = await prisma.costProduction.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true },
      })
      if (!found) throw notFound()
      await prisma.$transaction([
        prisma.costProductionItem.deleteMany({
          where: { productionId: data.id },
        }),
        prisma.costProduction.update({
          where: { id: data.id },
          data: { ...fields, items: { create: items } },
        }),
      ])
      return { id: data.id }
    }
    const created = await prisma.costProduction.create({
      data: { ...fields, userId: context.userId, items: { create: items } },
    })
    return { id: created.id }
  })

export const deleteProduction = createServerFn({ method: 'POST' })
  .middleware([requireModule('PRODUCTION')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costProduction.deleteMany({
      where: { id: data.id, userId: context.userId },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })
