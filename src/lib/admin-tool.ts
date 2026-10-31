import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { requireAdmin } from '#/lib/guards'
import { TOOL_MODULES, priceOrderError } from '#/lib/tool-tiers'

// Niveles de la herramienta de costos en el panel (modo pro): precio, límite de elementos, módulos
// y plazo de las cotizaciones de cada nivel, y cuánto usa cada alumna. Toda función lleva
// `requireAdmin`.

export const USAGE_LIMIT = 200

// Elementos guardados por alumna (los mismos que cuenta `countItems`, de todas a la vez).
async function usageByUser(userIds: string[]) {
  const live = { userId: { in: userIds }, archivedAt: null }
  const groups = await Promise.all([
    prisma.costIngredient.groupBy({
      by: ['userId'],
      where: live,
      _count: true,
    }),
    prisma.costPremix.groupBy({ by: ['userId'], where: live, _count: true }),
    prisma.costRecipe.groupBy({ by: ['userId'], where: live, _count: true }),
    prisma.costProduct.groupBy({ by: ['userId'], where: live, _count: true }),
    prisma.costQuote.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: true,
    }),
  ])
  const used = new Map<string, number>()
  for (const rows of groups) {
    for (const r of rows)
      used.set(r.userId, (used.get(r.userId) ?? 0) + r._count)
  }
  return used
}

export const getAdminTool = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const products = await prisma.product.findMany({
      where: { kind: 'TOOL' },
      include: { tier: true },
      orderBy: { position: 'asc' },
    })
    const enrollments = await prisma.enrollment.findMany({
      where: {
        expiresAt: { gt: new Date() },
        product: { kind: 'TOOL' },
      },
      include: { user: true, product: { include: { tier: true } } },
      orderBy: { createdAt: 'desc' },
      take: USAGE_LIMIT,
    })
    const used = await usageByUser(enrollments.map((e) => e.userId))
    return {
      tiers: products.map((p) => ({
        productId: p.id,
        name: p.name,
        status: p.status,
        priceMxn: p.priceMxn,
        compareAtMxn: p.compareAtMxn,
        rank: p.tier?.rank ?? 2,
        itemLimit: p.tier?.itemLimit ?? 1000,
        quoteDays: p.tier?.quoteDays ?? 90,
        modules: p.tier?.modules ?? [...TOOL_MODULES],
      })),
      usage: enrollments.map((e) => ({
        id: e.id,
        name: e.user.name,
        email: e.user.email,
        tier: e.product.name,
        itemLimit: e.product.tier?.itemLimit ?? 1000,
        used: used.get(e.userId) ?? 0,
        expiresAt: e.expiresAt.toISOString(),
      })),
    }
  })

const tierSchema = z.object({
  productId: z.string().min(1),
  priceMxn: z.number().int().min(0).max(1_000_000),
  compareAtMxn: z.number().int().min(0).max(1_000_000).nullable(),
  itemLimit: z.number().int().min(1).max(1_000_000),
  quoteDays: z.number().int().min(1).max(3650),
  modules: z.array(z.enum(TOOL_MODULES)),
})

export const saveToolTier = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(tierSchema)
  .handler(async ({ data }) => {
    const product = await prisma.product.findFirst({
      where: { id: data.productId, kind: 'TOOL' },
      include: { tier: true },
    })
    if (!product) throw notFound()
    const { productId, priceMxn, compareAtMxn, ...tier } = data
    const all = await prisma.product.findMany({
      where: { kind: 'TOOL' },
      include: { tier: true },
    })
    const error = priceOrderError(
      // Un producto sin nivel cuenta como Completo (rango 2), igual que en el acceso.
      all.map((p) => ({
        name: p.name,
        rank: p.tier?.rank ?? 2,
        priceMxn: p.id === productId ? priceMxn : p.priceMxn,
      })),
    )
    if (error) return { ok: false as const, error }
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { priceMxn, compareAtMxn },
      }),
      prisma.toolTier.upsert({
        where: { productId },
        update: tier,
        // Un producto sin nivel aún: queda por encima de los demás hasta que se ordene.
        create: { productId, rank: product.tier?.rank ?? 2, ...tier },
      }),
    ])
    return { ok: true as const }
  })
