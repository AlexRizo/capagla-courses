import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { agoCapitalized } from '#/lib/ago'
import {
  MAX_MAX_CHARS,
  MIN_MAX_CHARS,
  assistantEnabled,
  draftAnswer,
  getMaxChars,
} from '#/lib/assistant'
import { MAX_GLOBAL_LIMIT, MIN_GLOBAL_LIMIT } from '#/lib/assistant-limits'
import { loadAssistantLimits, usageSummary } from '#/lib/assistant-usage'
import { answerMail } from '#/lib/emails'
import { requireAdmin } from '#/lib/guards'
import { sendMail } from '#/lib/mailer'
import type { TranscriptLine } from '#/lib/transcript'

export const MAX_ANSWER_LENGTH = 2000

// Cuántas preguntas esperan a la chef (el número junto a "Preguntas" en la barra lateral).
export const getPendingQuestions = createServerFn()
  .middleware([requireAdmin])
  .handler(() => prisma.lessonQuestion.count({ where: { status: 'PENDING' } }))

// Todas las preguntas de las alumnas, las más recientes primero; los filtros los hace la pantalla.
export const getAdminQuestions = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    // Las que solo contestó el asistente no llegan a la chef (la alumna decide mandarlas).
    const questions = await prisma.lessonQuestion.findMany({
      where: { status: { not: 'ASSISTANT' } },
      include: {
        user: { select: { name: true } },
        item: { include: { parent: { select: { kind: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    return questions.map((q) => ({
      id: q.id,
      itemId: q.itemId,
      text: q.text,
      status: q.status,
      answer: q.answer,
      assistantAnswer: q.assistantAnswer,
      vote: q.vote,
      draft: q.draft,
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
      include: {
        user: { select: { email: true } },
        item: { select: { title: true, product: { select: { slug: true } } } },
      },
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
    // Aviso a la alumna (Brevo; sin configurar, en la consola).
    await sendMail(
      answerMail({
        to: question.user.email,
        lesson: question.item.title,
        question: question.text,
        answer: data.answer,
        lessonPath: `/mis-cursos/${question.item.product.slug}/${question.itemId}`,
      }),
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

// ¿Hay asistente de IA? Cambia el texto de la pantalla y muestra el borrador y "Regenerar con IA".
export const getAssistantInfo = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const limits = await loadAssistantLimits()
    return {
      enabled: assistantEnabled(),
      maxChars: await getMaxChars(),
      // Interruptor y tope global de las alumnas, y lo que se gastó en las últimas 24 horas.
      studentsEnabled: limits.enabled,
      dailyLimit: limits.dailyLimit,
      usage: await usageSummary(),
    }
  })

// Interruptor del asistente para las alumnas y su tope global de preguntas en 24 horas. Apagado o
// en el tope, "Preguntar" va directo a la chef. El borrador para la chef no depende de esto.
export const saveAssistantLimits = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ enabled: z.boolean(), dailyLimit: z.number().int() }))
  .handler(async ({ data }) => {
    if (
      data.dailyLimit < MIN_GLOBAL_LIMIT ||
      data.dailyLimit > MAX_GLOBAL_LIMIT
    ) {
      return {
        error: `Escribe un número entre ${MIN_GLOBAL_LIMIT} y ${MAX_GLOBAL_LIMIT}.`,
      }
    }
    await prisma.assistantSettings.upsert({
      where: { id: 'main' },
      create: {
        id: 'main',
        enabled: data.enabled,
        dailyLimit: data.dailyLimit,
      },
      update: { enabled: data.enabled, dailyLimit: data.dailyLimit },
    })
    return {}
  })

export const saveAssistantMaxChars = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ maxChars: z.number().int() }))
  .handler(async ({ data }) => {
    if (data.maxChars < MIN_MAX_CHARS || data.maxChars > MAX_MAX_CHARS) {
      return {
        error: `Escribe un número entre ${MIN_MAX_CHARS} y ${MAX_MAX_CHARS}.`,
      }
    }
    await prisma.assistantSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main', maxChars: data.maxChars },
      update: { maxChars: data.maxChars },
    })
    return {}
  })

// Borrador de la IA para la respuesta de la chef. Se guarda en la pregunta: se genera una vez
// al abrirla y `regenerate` lo reemplaza.
export const generateDraft = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string(), regenerate: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const question = await prisma.lessonQuestion.findUnique({
      where: { id: data.id },
    })
    if (!question) throw notFound()
    if (question.status === 'ANSWERED') return { draft: question.draft }
    if (question.draft && !data.regenerate) return { draft: question.draft }
    if (!assistantEnabled()) {
      return { error: 'Aún no hay un proveedor de IA conectado.' }
    }
    try {
      const draft = await draftAnswer(
        question.itemId,
        question.text,
        question.assistantAnswer,
      )
      await prisma.lessonQuestion.update({
        where: { id: question.id },
        data: { draft },
      })
      return { draft }
    } catch (error) {
      console.error('[asistente] No se pudo generar el borrador:', error)
      return { error: 'No se pudo generar el borrador. Inténtalo de nuevo.' }
    }
  })

// Transcripción de la lección de una pregunta (vacía si aún no se carga).
export const getLessonTranscript = createServerFn()
  .middleware([requireAdmin])
  .validator(z.object({ itemId: z.string() }))
  .handler(async ({ data }) => {
    const row = await prisma.lessonTranscript.findUnique({
      where: { itemId: data.itemId },
    })
    return (row?.lines ?? []) as TranscriptLine[]
  })
