import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { placeholderName } from '#/lib/account-name'
import { auth } from '#/lib/auth'
import { withLinkPurpose } from '#/lib/mailer'
import { buildPlayerTree, onlyFreeBlocks } from '#/lib/player-tree'
import { tooManyAttempts } from '#/lib/rate-limit'

// La clase gratis es el primer bloque gratis de un curso publicado: su primera lección es donde
// aterriza quien se registra. Sin bloque gratis (o sin lecciones) no hay clase gratis.
async function findFreeLesson() {
  const courses = await prisma.product.findMany({
    where: { kind: 'COURSE', status: 'PUBLISHED' },
    orderBy: { position: 'asc' },
  })
  for (const course of courses) {
    const items = await prisma.courseItem.findMany({
      where: { productId: course.id },
    })
    const { order } = buildPlayerTree(onlyFreeBlocks(items), new Set())
    if (order.length) return { slug: course.slug, lessonId: order[0].lesson.id }
  }
  return null
}

// La página /clase-gratis solo existe si hay una clase gratis que entregar.
export const requireFreeClass = createServerFn().handler(async () => {
  if (!(await findFreeLesson())) throw notFound()
})

// "Ver la clase gratis": registra el correo como lead (con su aceptación del aviso de privacidad)
// y le manda un enlace para entrar directo a la clase. Responde igual aunque el correo ya exista.
export const joinFreeClass = createServerFn({ method: 'POST' })
  .validator(
    z.object({ email: z.string().trim().email(), consent: z.literal(true) }),
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const email = data.email.toLowerCase()
    const ip = headers.get('x-forwarded-for') ?? ''
    if (tooManyAttempts(`gratis|${email}|${ip}`)) {
      return { next: 'blocked' as const }
    }

    const lesson = await findFreeLesson()
    if (!lesson) throw notFound()

    const ctx = await auth.$context
    const existing = await ctx.internalAdapter.findUserByEmail(email)
    // Sin cuenta se crea una sin contraseña; el correo se da por verificado al abrir el enlace.
    const user =
      existing?.user ??
      (await ctx.internalAdapter.createUser(
        { email, name: placeholderName(email), emailVerified: false },
        { method: 'free-class' },
      ))
    await prisma.lead.upsert({
      where: { email },
      create: { email, userId: user.id, consentAt: new Date() },
      update: {},
    })

    await withLinkPurpose({ kind: 'free-class' }, () =>
      auth.api.signInMagicLink({
        body: {
          email,
          callbackURL: `/mis-cursos/${lesson.slug}/${lesson.lessonId}`,
        },
        headers,
      }),
    )
    return { next: 'link' as const }
  })
