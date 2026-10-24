import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { quoteSchema, quoteSummary } from '#/lib/cost-quotes'
import { laborPerHour } from '#/lib/cost-settings'
import { requireTool } from '#/lib/tool-access'
import { loadProductMetrics } from '#/lib/tool-products'
import { loadSettings } from '#/lib/tool-settings'

// Cotizaciones de la herramienta de costos: un pedido a partir de un producto. Todo se limita a la
// dueña (`context.userId`). Solo se guarda lo capturado; el mínimo a cobrar se recalcula con los
// costos de hoy y el producto no se modifica.

export const getQuoteForm = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const row = data.id
      ? await prisma.costQuote.findFirst({
          where: { id: data.id, userId: context.userId },
          include: { extras: { orderBy: { position: 'asc' } } },
        })
      : null
    if (data.id && !row) throw notFound()
    const [products, settings, quotes] = await Promise.all([
      loadProductMetrics(context.userId),
      loadSettings(context.userId),
      prisma.costQuote.findMany({
        where: { userId: context.userId },
        orderBy: { updatedAt: 'desc' },
        include: { extras: true },
      }),
    ])
    const rate = laborPerHour(settings)
    const byId = new Map(products.map((p) => [p.id, p]))
    return {
      quote: row && {
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        decorHours: Number(row.decorHours),
        sourcingHours: Number(row.sourcingHours),
        extras: row.extras.map((e) => ({ name: e.name, cost: Number(e.cost) })),
      },
      // Un producto archivado solo se ofrece si la cotización ya lo usa.
      products: products
        .filter((p) => !p.archived || p.id === row?.productId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sells: p.sells,
          cost: p.metrics?.cost ?? null,
          laborHours: p.metrics?.laborHours ?? null,
        })),
      rate,
      saved: quotes.map((q) => {
        const product = byId.get(q.productId)
        const { floor } = quoteSummary({
          unitCost: product?.metrics?.cost ?? null,
          quantity: q.quantity,
          decorHours: Number(q.decorHours),
          sourcingHours: Number(q.sourcingHours),
          rate,
          extras: q.extras.map((e) => Number(e.cost)),
        })
        return {
          id: q.id,
          product: product?.name ?? '—',
          quantity: q.quantity,
          floor,
          savedAt: q.updatedAt.toISOString(),
        }
      }),
    }
  })

export const saveQuote = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable(), values: quoteSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const owned = await prisma.costProduct.count({
      where: { id: values.productId, userId: context.userId },
    })
    if (owned !== 1) return { error: 'Ese producto no existe.' }
    const fields = {
      productId: values.productId,
      quantity: values.quantity,
      decorHours: values.decorHours,
      sourcingHours: values.sourcingHours,
    }
    const extras = values.extras.map((e, position) => ({ ...e, position }))
    if (data.id) {
      const found = await prisma.costQuote.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true },
      })
      if (!found) throw notFound()
      await prisma.$transaction([
        prisma.costQuoteExtra.deleteMany({ where: { quoteId: data.id } }),
        prisma.costQuote.update({
          where: { id: data.id },
          data: { ...fields, extras: { create: extras } },
        }),
      ])
      return { id: data.id }
    }
    const created = await prisma.costQuote.create({
      data: { ...fields, userId: context.userId, extras: { create: extras } },
    })
    return { id: created.id }
  })

export const deleteQuote = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costQuote.deleteMany({
      where: { id: data.id, userId: context.userId },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })
