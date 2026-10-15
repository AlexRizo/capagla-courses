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

  return {
    user: {
      name: session.user.name,
      email: session.user.email,
      isAdmin: session.user.role === 'ADMIN',
    },
    hasPassword: credential !== null,
    courses: enrollments
      .filter((e) => e.product.kind === 'COURSE')
      .map((e) => ({
        slug: e.product.slug,
        name: e.product.name,
        expiresAt: e.expiresAt.toISOString(),
        // Pasada la fecha, el curso queda bloqueado.
        active: e.expiresAt > new Date(),
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
