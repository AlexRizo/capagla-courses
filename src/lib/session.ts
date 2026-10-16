import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { auth } from '#/lib/auth'

export const getSession = createServerFn().handler(() =>
  auth.api.getSession({ headers: getRequestHeaders() }),
)

// Datos de "Mis cursos" del usuario con sesión.
export const getMyCourses = createServerFn().handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
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

  const courses = enrollments.filter((e) => e.product.kind === 'COURSE')
  const ids = courses.map((e) => e.productId)
  const [lessons, seen] = await Promise.all([
    prisma.courseItem.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, kind: 'LESSON' },
      _count: true,
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, item: { productId: { in: ids } } },
      select: { item: { select: { productId: true } } },
    }),
  ])
  const lessonCount = new Map(lessons.map((l) => [l.productId, l._count]))
  const seenCount = new Map<string, number>()
  for (const s of seen) {
    const id = s.item.productId
    seenCount.set(id, (seenCount.get(id) ?? 0) + 1)
  }

  return {
    user: {
      name: session.user.name,
      email: session.user.email,
      isAdmin: session.user.role === 'ADMIN',
    },
    hasPassword: credential !== null,
    courses: courses.map((e) => ({
      slug: e.product.slug,
      name: e.product.name,
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

// Sin servicio de correo ni almacenamiento: el reporte se imprime en consola.
export const sendTicket = createServerFn({ method: 'POST' })
  .validator(z.object({ tipo: z.string(), detalle: z.string() }))
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    console.log(
      `[reporte] ${session?.user.email ?? 'sin sesión'} · ${data.tipo}: ${data.detalle}`,
    )
  })
