import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import {
  quoteDaysLeft,
  quoteExpiry,
  quoteSchema,
  quoteSummary,
} from '#/lib/cost-quotes'
import { limitError } from '#/lib/tool-usage'
import { laborPerHour } from '#/lib/cost-settings'
import { requireModule } from '#/lib/tool-access'
import { loadProductMetrics } from '#/lib/tool-products'
import { loadSettings } from '#/lib/tool-settings'

// Cotizaciones de la herramienta de costos: un pedido a partir de un producto. Todo se limita a la
// dueña (`context.userId`). Solo se guarda lo capturado; el mínimo a cobrar se recalcula con los
// costos de hoy y el producto no se modifica. Al guardar se congela lo cotizado ese día; la
// cotización vence a los 90 días de su último guardado y se borra al abrir el cotizador.

// El mínimo a cobrar de hoy para lo capturado (null si falta un dato).
const floorNow = createServerOnlyFn(
  async (
    userId: string,
    v: {
      productId: string
      quantity: number
      decorHours: number
      sourcingHours: number
      extras: number[]
    },
  ) => {
    const [products, settings] = await Promise.all([
      loadProductMetrics(userId, [v.productId]),
      loadSettings(userId),
    ])
    return quoteSummary({
      unitCost: products[0]?.metrics?.cost ?? null,
      quantity: v.quantity,
      decorHours: v.decorHours,
      sourcingHours: v.sourcingHours,
      rate: laborPerHour(settings),
      extras: v.extras,
    }).floor
  },
)

export const getQuoteForm = createServerFn()
  .middleware([requireModule('QUOTES')])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    // Las vencidas se borran (como las producciones).
    await prisma.costQuote.deleteMany({
      where: { userId: context.userId, expiresAt: { lt: new Date() } },
    })
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
        // Lo que se cotizó al guardar (no cambia con los costos) y cuándo vence.
        quotedFloor: row.quotedFloor === null ? null : Number(row.quotedFloor),
        savedAt: row.updatedAt.toISOString(),
        daysLeft: quoteDaysLeft(row.expiresAt),
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
      // Cuánto duran las cotizaciones en su nivel.
      quoteDays: context.tier.quoteDays,
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
          quoted: q.quotedFloor === null ? null : Number(q.quotedFloor),
          floor,
          savedAt: q.updatedAt.toISOString(),
          daysLeft: quoteDaysLeft(q.expiresAt),
        }
      }),
    }
  })

export const saveQuote = createServerFn({ method: 'POST' })
  .middleware([requireModule('QUOTES')])
  .validator(z.object({ id: z.string().nullable(), values: quoteSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const owned = await prisma.costProduct.count({
      where: { id: values.productId, userId: context.userId },
    })
    if (owned !== 1) return { error: 'Ese producto no existe.' }
    // Se congela lo cotizado hoy y el plazo corre desde este guardado.
    const fields = {
      productId: values.productId,
      quantity: values.quantity,
      decorHours: values.decorHours,
      sourcingHours: values.sourcingHours,
      quotedFloor: await floorNow(context.userId, {
        ...values,
        extras: values.extras.map((e) => e.cost),
      }),
      expiresAt: quoteExpiry(new Date(), context.tier.quoteDays),
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
    const full = await limitError(context.userId, context.tier)
    if (full) return { error: full }
    const created = await prisma.costQuote.create({
      data: { ...fields, userId: context.userId, extras: { create: extras } },
    })
    return { id: created.id }
  })

export const deleteQuote = createServerFn({ method: 'POST' })
  .middleware([requireModule('QUOTES')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costQuote.deleteMany({
      where: { id: data.id, userId: context.userId },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// Duplicar: una copia con lo mismo, cotizada con los costos de hoy y con su plazo completo.
export const duplicateQuote = createServerFn({ method: 'POST' })
  .middleware([requireModule('QUOTES')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const found = await prisma.costQuote.findFirst({
      where: {
        id: data.id,
        userId: context.userId,
        expiresAt: { gte: new Date() },
      },
      include: { extras: { orderBy: { position: 'asc' } } },
    })
    if (!found) throw notFound()
    const full = await limitError(context.userId, context.tier)
    if (full) return { error: full }
    const copy = await prisma.costQuote.create({
      data: {
        userId: context.userId,
        productId: found.productId,
        quantity: found.quantity,
        decorHours: found.decorHours,
        sourcingHours: found.sourcingHours,
        quotedFloor: await floorNow(context.userId, {
          productId: found.productId,
          quantity: found.quantity,
          decorHours: Number(found.decorHours),
          sourcingHours: Number(found.sourcingHours),
          extras: found.extras.map((e) => Number(e.cost)),
        }),
        expiresAt: quoteExpiry(new Date(), context.tier.quoteDays),
        extras: {
          create: found.extras.map((e) => ({
            name: e.name,
            cost: e.cost,
            position: e.position,
          })),
        },
      },
    })
    return { id: copy.id }
  })
