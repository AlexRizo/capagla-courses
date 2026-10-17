import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { auth, readSession } from '#/lib/auth'
import { ticketMail } from '#/lib/emails'
import { sendMail } from '#/lib/mailer'
import { onlyFreeBlocks } from '#/lib/player-tree'

export const getSession = createServerFn().handler(() =>
  readSession(getRequestHeaders()),
)

// Datos de "Mis cursos" del usuario con sesión.
export const getMyCourses = createServerFn().handler(async () => {
  const session = await readSession(getRequestHeaders())
  if (!session) return null

  const [enrollments, credential] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: session.user.id },
      include: { product: true },
    }),
    prisma.account.findFirst({
      where: { userId: session.user.id, providerId: 'credential' },
    }),
  ])

  // Solo cursos publicados: el reproductor no abre un borrador.
  const courses = enrollments.filter(
    (e) => e.product.kind === 'COURSE' && e.product.status === 'PUBLISHED',
  )
  const ids = courses.map((e) => e.productId)
  const [lessons, chapters, seen] = await Promise.all([
    prisma.courseItem.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, kind: 'LESSON' },
      _count: true,
    }),
    // "11 recetas": cada capítulo es una receta.
    prisma.courseItem.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, kind: 'CHAPTER' },
      _count: true,
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, item: { productId: { in: ids } } },
      select: { item: { select: { productId: true } } },
    }),
  ])
  const lessonCount = new Map(lessons.map((l) => [l.productId, l._count]))
  const recipeCount = new Map(chapters.map((c) => [c.productId, c._count]))
  const seenCount = new Map<string, number>()
  for (const s of seen) {
    const id = s.item.productId
    seenCount.set(id, (seenCount.get(id) ?? 0) + 1)
  }

  // Cursos publicados con un bloque gratis que la cuenta aún no tiene: se ofrece su clase gratis.
  const owned = new Set(enrollments.map((e) => e.productId))
  const freeCandidates = await prisma.product.findMany({
    where: {
      kind: 'COURSE',
      status: 'PUBLISHED',
      id: { notIn: [...owned] },
      items: { some: { kind: 'BLOCK', isFree: true } },
    },
    orderBy: { position: 'asc' },
  })
  const freeIds = freeCandidates.map((c) => c.id)
  const [freeItems, freeSeen] = await Promise.all([
    prisma.courseItem.findMany({
      where: { productId: { in: freeIds } },
      select: {
        id: true,
        productId: true,
        parentId: true,
        kind: true,
        isFree: true,
      },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, item: { productId: { in: freeIds } } },
      select: { itemId: true },
    }),
  ])
  const seenIds = new Set(freeSeen.map((s) => s.itemId))
  const freeCourses = freeCandidates.map((c) => {
    const mine = onlyFreeBlocks(freeItems.filter((i) => i.productId === c.id))
    const freeLessons = mine.filter((i) => i.kind === 'LESSON')
    return {
      slug: c.slug,
      name: c.name,
      coverUrl: c.coverUrl,
      lessons: freeLessons.length,
      seen: freeLessons.filter((l) => seenIds.has(l.id)).length,
    }
  })

  return {
    user: {
      name: session.user.name,
      email: session.user.email,
      isAdmin: session.user.role === 'ADMIN',
    },
    hasPassword: credential !== null,
    freeCourses,
    courses: courses.map((e) => ({
      slug: e.product.slug,
      name: e.product.name,
      coverUrl: e.product.coverUrl,
      recipes: recipeCount.get(e.productId) ?? 0,
      expiresAt: e.expiresAt.toISOString(),
      // Pasada la fecha, el curso queda bloqueado.
      active: e.expiresAt > new Date(),
      // Avance real: lecciones del curso y cuántas marcó como vistas.
      lessons: lessonCount.get(e.productId) ?? 0,
      seen: seenCount.get(e.productId) ?? 0,
    })),
  }
})

export const setMyPassword = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().min(8) }))
  .handler(async ({ data }) => {
    await auth.api.setPassword({
      body: { newPassword: data.password },
      headers: getRequestHeaders(),
    })
  })

// "Ayuda y reportar un fallo": llega por correo a soporte (sin Brevo, a la consola).
export const sendTicket = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tipo: z.string().trim().min(1).max(100),
      detalle: z.string().trim().max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const session = await readSession(getRequestHeaders())
    if (!session) return
    await sendMail(
      ticketMail({
        from: session.user.email,
        kind: data.tipo,
        detail: data.detalle || '(sin detalle)',
      }),
    )
  })
