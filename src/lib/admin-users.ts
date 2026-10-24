import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { requireAdmin } from '#/lib/guards'
import { withLinkPurpose } from '#/lib/mailer'
import { fromLocalInput } from '#/lib/promotions'
import { filterWhere, forbiddenOnSelf, searchWhere } from '#/lib/user-rules'

// Módulo de usuarios del panel. Toda función lleva `requireAdmin`: el `beforeLoad` de /admin
// solo protege la pantalla, no los datos. Los errores que la administradora debe leer se
// devuelven como `{ error }`; lo inesperado lanza.

const DAY_MS = 24 * 60 * 60 * 1000
export const USERS_PAGE_SIZE = 20

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const getAdminUsers = createServerFn()
  .middleware([requireAdmin])
  .validator(
    z.object({
      q: z.string().max(100).default(''),
      filter: z
        .enum(['todos', 'admin', 'alumnas', 'suspendidas'])
        .default('todos'),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data }) => {
    const where = { ...filterWhere(data.filter), ...searchWhere(data.q) }
    const [users, total, all, admins, suspended] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (data.page - 1) * USERS_PAGE_SIZE,
        take: USERS_PAGE_SIZE,
        include: { _count: { select: { enrollments: true } } },
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { suspendedAt: { not: null } } }),
    ])
    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        admin: u.role === 'ADMIN',
        suspended: !!u.suspendedAt,
        createdAt: u.createdAt,
        courses: u._count.enrollments,
      })),
      total,
      pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
      counts: {
        todos: all,
        admin: admins,
        alumnas: all - admins,
        suspendidas: suspended,
      },
    }
  })

export const getAdminUser = createServerFn()
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const user = await prisma.user.findUnique({
      where: { id: data.id },
      include: {
        enrollments: { include: { product: true } },
        accounts: { where: { providerId: 'credential' }, select: { id: true } },
        orders: {
          where: { status: { in: ['PAID', 'REFUNDED'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: true } } },
        },
        _count: { select: { lessonProgress: true, questions: true } },
      },
    })
    if (!user) throw notFound()
    const owned = user.enrollments.map((e) => e.productId)
    const available = await prisma.product.findMany({
      where: { id: { notIn: owned } },
      orderBy: { position: 'asc' },
    })
    const now = Date.now()
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      admin: user.role === 'ADMIN',
      suspended: !!user.suspendedAt,
      self: user.id === context.session.user.id,
      createdAt: user.createdAt,
      hasPassword: user.accounts.length > 0,
      lessonsSeen: user._count.lessonProgress,
      questions: user._count.questions,
      enrollments: user.enrollments
        .sort((a, b) => a.product.position - b.product.position)
        .map((e) => ({
          productId: e.productId,
          name: e.product.name,
          expiresAt: e.expiresAt,
          active: e.expiresAt.getTime() > now,
        })),
      available: available.map((p) => ({
        id: p.id,
        name: p.name,
        accessDays: p.accessDays,
      })),
      orders: user.orders.map((o) => ({
        id: o.id,
        status: o.status,
        amountMxn: o.amountMxn,
        createdAt: o.createdAt,
        items: o.items.map((i) => i.product.name),
      })),
    }
  })

// Crea la cuenta sin contraseña y le manda el enlace de acceso por correo (el mismo
// mecanismo de quien compra). Un administrador entra directo al panel.
export const createUser = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      admin: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email)
    const ctx = await auth.$context
    if (await ctx.internalAdapter.findUserByEmail(email)) {
      return { error: 'Ya existe una cuenta con ese correo.' }
    }
    const user = await ctx.internalAdapter.createUser(
      {
        email,
        name: data.name,
        emailVerified: false,
        role: data.admin ? 'ADMIN' : 'STUDENT',
      },
      { method: 'admin' },
    )
    await withLinkPurpose({ kind: 'invite', admin: data.admin }, () =>
      auth.api.signInMagicLink({
        body: {
          email,
          callbackURL: data.admin ? '/admin' : '/mis-cursos',
        },
        headers: new Headers(),
      }),
    )
    return { id: user.id }
  })

export const updateUser = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(80),
      admin: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const target = await prisma.user.findUnique({ where: { id: data.id } })
    if (!target) throw notFound()
    const role = data.admin ? 'ADMIN' : 'STUDENT'
    if (role !== target.role) {
      const blocked = forbiddenOnSelf(
        context.session.user.id,
        target.id,
        'role',
      )
      if (blocked) return { error: blocked }
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { name: data.name, role },
    })
    return { ok: true as const }
  })

// Suspender cierra sus sesiones y le impide volver a entrar (ver `databaseHooks` en lib/auth.ts);
// no borra nada y su acceso a los cursos queda como estaba.
export const setUserSuspended = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string(), suspended: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (data.suspended) {
      const blocked = forbiddenOnSelf(
        context.session.user.id,
        data.id,
        'suspend',
      )
      if (blocked) return { error: blocked }
    }
    const exists = await prisma.user.findUnique({ where: { id: data.id } })
    if (!exists) throw notFound()
    await prisma.$transaction([
      prisma.user.update({
        where: { id: data.id },
        data: { suspendedAt: data.suspended ? new Date() : null },
      }),
      ...(data.suspended
        ? [prisma.session.deleteMany({ where: { userId: data.id } })]
        : []),
    ])
    return { ok: true as const }
  })

// Borra la cuenta y lo que es solo suyo (sesiones, contraseña, progreso, momentos, preguntas,
// accesos y registro de clase gratis). Las órdenes se conservan, sin usuario.
export const deleteUser = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string(), confirmEmail: z.string() }))
  .handler(async ({ data, context }) => {
    const blocked = forbiddenOnSelf(context.session.user.id, data.id, 'delete')
    if (blocked) return { error: blocked }
    const target = await prisma.user.findUnique({ where: { id: data.id } })
    if (!target) throw notFound()
    if (normalizeEmail(data.confirmEmail) !== target.email) {
      return { error: 'El correo escrito no coincide.' }
    }
    await prisma.user.delete({ where: { id: target.id } })
    return { ok: true as const }
  })

// Manda otra vez el enlace de acceso (el de siempre de "Entrar"). No a una cuenta suspendida.
export const sendAccessLink = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const target = await prisma.user.findUnique({ where: { id: data.id } })
    if (!target) throw notFound()
    if (target.suspendedAt) {
      return { error: 'La cuenta está suspendida: reactívala primero.' }
    }
    await withLinkPurpose({ kind: 'login' }, () =>
      auth.api.signInMagicLink({
        body: {
          email: target.email,
          callbackURL: target.role === 'ADMIN' ? '/admin' : '/mis-cursos',
        },
        headers: new Headers(),
      }),
    )
    return { ok: true as const }
  })

// Da acceso a un producto sin pasar por una compra: vence en `days` días desde hoy.
export const grantAccess = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      userId: z.string(),
      productId: z.string(),
      days: z.number().int().min(1).max(3650),
    }),
  )
  .handler(async ({ data }) => {
    const [user, product, current] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.userId } }),
      prisma.product.findUnique({ where: { id: data.productId } }),
      prisma.enrollment.findUnique({
        where: {
          userId_productId: { userId: data.userId, productId: data.productId },
        },
      }),
    ])
    if (!user || !product) throw notFound()
    if (current) return { error: 'Ya tiene acceso a ese producto.' }
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        productId: product.id,
        expiresAt: new Date(Date.now() + data.days * DAY_MS),
      },
    })
    return { ok: true as const }
  })

// Cambia el vencimiento de un acceso: el último minuto (23:59, hora de México) de esa fecha.
export const setAccessExpiry = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      userId: z.string(),
      productId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const expiresAt = fromLocalInput(`${data.date}T23:59`)
    if (!expiresAt) return { error: 'La fecha no es válida.' }
    const result = await prisma.enrollment.updateMany({
      where: { userId: data.userId, productId: data.productId },
      data: { expiresAt },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// Quita el acceso (como un reembolso total): su avance en las lecciones no se borra.
export const revokeAccess = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ userId: z.string(), productId: z.string() }))
  .handler(async ({ data }) => {
    const result = await prisma.enrollment.deleteMany({
      where: { userId: data.userId, productId: data.productId },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })
