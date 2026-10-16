import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { agoCapitalized } from '#/lib/ago'
import { requireAdmin } from '#/lib/guards'

export const MAX_ANSWER_LENGTH = 2000

// Cuántas preguntas esperan a la chef (el número junto a "Preguntas" en la barra lateral).
export const getPendingQuestions = createServerFn()
  .middleware([requireAdmin])
  .handler(() => prisma.lessonQuestion.count({ where: { status: 'PENDING' } }))

// Todas las preguntas de las alumnas, las más recientes primero; los filtros los hace la pantalla.
export const getAdminQuestions = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const questions = await prisma.lessonQuestion.findMany({
      include: {
        user: { select: { name: true } },
        item: { include: { parent: { select: { kind: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      status: q.status,
      answer: q.answer,
      who: q.user.name,
      when: agoCapitalized(q.createdAt, now),
      // "Enjambre de chocolate · Preparación": el capítulo y la lección.
      lesson: [
        q.item.parent?.kind === 'CHAPTER' ? q.item.parent.title : null,
        q.item.title,
      ]
        .filter(Boolean)
        .join(' · '),
      videoUrl: /^https?:\/\//.test(q.item.videoUrl ?? '')
        ? q.item.videoUrl
        : null,
    }))
  })

// "Publicar respuesta": la pregunta y la respuesta quedan visibles en la lección.
export const answerQuestion = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
    }),
  )
  .handler(async ({ data }) => {
    const question = await prisma.lessonQuestion.findUnique({
      where: { id: data.id },
      include: { user: { select: { email: true } } },
    })
    if (!question) throw notFound()
    if (question.status === 'ANSWERED') {
      return { error: 'Esta pregunta ya está respondida.' }
    }
    await prisma.lessonQuestion.update({
      where: { id: question.id },
      data: {
        status: 'ANSWERED',
        answer: data.answer,
        answeredAt: new Date(),
      },
    })
    // Sin servicio de correo todavía: igual que el enlace de acceso, solo se deja en el registro.
    console.log(
      `[correo] Respuesta de la chef para ${question.user.email}: ${data.answer}`,
    )
    return {}
  })

// "Ocultar pregunta": sale de la lección (y de la vista de la alumna); no se borra.
export const hideQuestion = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const question = await prisma.lessonQuestion.findUnique({
      where: { id: data.id },
    })
    if (!question) throw notFound()
    if (question.status === 'ANSWERED') {
      return { error: 'Una pregunta respondida no se puede ocultar.' }
    }
    await prisma.lessonQuestion.update({
      where: { id: question.id },
      data: { status: 'HIDDEN' },
    })
    return {}
  })
