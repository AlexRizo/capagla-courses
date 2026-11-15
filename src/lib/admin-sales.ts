import type { OrderStatus, Prisma } from '@prisma/client'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { requireAdmin } from '#/lib/guards'
import { sourceLabel } from '#/lib/sales-rules'

// Ventas y Leads del panel (H34; no están en la maqueta: diseño como Usuarios). Solo admin.

export const ADMIN_PAGE_SIZE = 25

const emailSearch = (q: string) =>
  q.trim() ? { contains: q.trim(), mode: 'insensitive' as const } : undefined

// ---------- Leads ----------

export const LEAD_FILTERS = ['todos', 'correos', 'sin-correos'] as const
export type LeadFilter = (typeof LEAD_FILTERS)[number]

export function leadsWhere(
  q: string,
  filter: LeadFilter,
): Prisma.LeadWhereInput {
  return {
    email: emailSearch(q),
    ...(filter === 'correos'
      ? { newsletterAt: { not: null } }
      : filter === 'sin-correos'
        ? { newsletterAt: null }
        : {}),
  }
}

export const getAdminLeads = createServerFn()
  .middleware([requireAdmin])
  .validator(
    z.object({
      q: z.string().max(100).default(''),
      filter: z.enum(LEAD_FILTERS).default('todos'),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data }) => {
    const where = leadsWhere(data.q, data.filter)
    const [leads, total, all, newsletter] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (data.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
        include: {
          user: {
            select: {
              orders: { where: { status: 'PAID' }, select: { id: true } },
            },
          },
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count(),
      prisma.lead.count({ where: { newsletterAt: { not: null } } }),
    ])
    return {
      leads: leads.map((l) => ({
        id: l.id,
        email: l.email,
        createdAt: l.createdAt,
        newsletterAt: l.newsletterAt,
        source: sourceLabel(l.attribution),
        // Ya compró algo (con la misma cuenta).
        bought: l.user.orders.length > 0,
      })),
      total,
      pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
      counts: {
        todos: all,
        correos: newsletter,
        'sin-correos': all - newsletter,
      },
    }
  })

// ---------- Ventas ----------

export const SALE_FILTERS = [
  'pagadas',
  'reembolsadas',
  'pendientes',
  'fallidas',
  'todas',
] as const
export type SaleFilter = (typeof SALE_FILTERS)[number]

const STATUS_BY_FILTER: Record<SaleFilter, OrderStatus | undefined> = {
  pagadas: 'PAID',
  reembolsadas: 'REFUNDED',
  pendientes: 'PENDING',
  fallidas: 'FAILED',
  todas: undefined,
}

export const getAdminSales = createServerFn()
  .middleware([requireAdmin])
  .validator(
    z.object({
      q: z.string().max(100).default(''),
      filter: z.enum(SALE_FILTERS).default('pagadas'),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim()
    const where: Prisma.OrderWhereInput = {
      status: STATUS_BY_FILTER[data.filter],
      ...(q
        ? {
            OR: [
              { email: emailSearch(q) },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const [orders, total, byStatus, paid] = await Promise.all([
      prisma.order.findMany({
        where,
        // Las pagadas por fecha de pago; el resto por fecha de creación.
        orderBy: [
          { paidAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (data.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
        include: {
          items: {
            include: { product: { select: { name: true, position: true } } },
          },
          promotion: { select: { name: true } },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({ by: ['status'], _count: true }),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { amountMxn: true },
      }),
    ])
    const count = (s: OrderStatus) =>
      byStatus.find((b) => b.status === s)?._count ?? 0
    return {
      orders: orders.map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        status: o.status,
        amountMxn: o.amountMxn,
        date: o.paidAt ?? o.createdAt,
        products: [...o.items]
          .sort((a, b) => a.product.position - b.product.position)
          .map((i) =>
            i.amountMxn === 0 ? `${i.product.name} (gratis)` : i.product.name,
          ),
        kind: o.renewal
          ? 'Renovación'
          : o.upgradeFromProductId
            ? 'Mejora de nivel'
            : null,
        promotion: o.promotion?.name ?? null,
        source: sourceLabel(o.attribution),
      })),
      total,
      pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
      // Cobrado y vigente (sin reembolsos).
      paidMxn: paid._sum.amountMxn ?? 0,
      counts: {
        pagadas: count('PAID'),
        reembolsadas: count('REFUNDED'),
        pendientes: count('PENDING'),
        fallidas: count('FAILED'),
        todas: byStatus.reduce((sum, b) => sum + b._count, 0),
      },
    }
  })
