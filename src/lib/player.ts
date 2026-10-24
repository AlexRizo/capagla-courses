import type { JSONContent } from '@tiptap/react'
import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { answerQuestion, assistantEnabled } from '#/lib/assistant'
import { AssistantRefusal } from '#/lib/assistant-model'
import { finishSlot, reserveSlot, studentsCanAsk } from '#/lib/assistant-usage'
import { readSession } from '#/lib/auth'
import { signedPlaybackUrl } from '#/lib/bunny'
import { ago } from '#/lib/ago'
import { parseParts, partAt } from '#/lib/duration'
import { RECIPE_BOOK_URL_PREFIX } from '#/lib/recipe-books'
import {
  buildPlayerTree,
  lessonPosition,
  onlyFreeItems,
  resumeLessonId,
} from '#/lib/player-tree'

// Entra al curso quien tiene sesión y está inscrita sin que se le haya vencido el acceso (`full`).
// Con sesión pero sin acceso completo (una lead de "Clase gratis" o con el acceso vencido) solo
// entra a los bloques gratis; si el curso no tiene, vuelve a Mis cursos (ahí se ve el curso
// bloqueado). La comprobación es del servidor, no de la pantalla.
// Una admin entra completa a cualquier curso publicado sin inscripción (con su propio avance).
// `preview` ("Ver como alumna" del panel): solo una admin; ve el curso completo aunque esté
// en borrador, como una alumna recién inscrita (sin su avance) y sin guardar nada.
async function requireAccess(slug: string, preview = false) {
  const session = await readSession(getRequestHeaders())
  if (!session) throw redirect({ to: '/entrar' })
  const asAdmin = preview && session.user.role === 'ADMIN'

  const course = await prisma.product.findUnique({ where: { slug } })
  if (
    course?.kind !== 'COURSE' ||
    (course.status !== 'PUBLISHED' && !asAdmin)
  ) {
    throw notFound()
  }
  if (asAdmin) return { session, course, full: true, preview: true }
  if (session.user.role === 'ADMIN') {
    return { session, course, full: true, preview: false }
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_productId: { userId: session.user.id, productId: course.id },
    },
  })
  const full = !!enrollment && enrollment.expiresAt > new Date()
  if (!full) {
    const free = await prisma.courseItem.count({
      where: { productId: course.id, isFree: true },
    })
    if (free === 0) throw redirect({ to: '/mis-cursos' })
  }
  return { session, course, full, preview: false }
}

// `fresh`: sin avance (vista previa de la admin).
async function loadTree(
  userId: string,
  productId: string,
  full: boolean,
  fresh = false,
) {
  const [allItems, progress] = await Promise.all([
    prisma.courseItem.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
    }),
    fresh
      ? []
      : prisma.lessonProgress.findMany({
          where: { userId, item: { productId } },
          select: { itemId: true },
        }),
  ])
  const items = full ? allItems : onlyFreeItems(allItems)
  const seen = new Set(progress.map((p) => p.itemId))
  return { items, seen, ...buildPlayerTree(items, seen) }
}

// Primera lección sin ver (o la primera): a donde lleva "Continuar progreso".
export const getResumeLesson = createServerFn()
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { session, course, full } = await requireAccess(data.slug)
    const { order } = await loadTree(session.user.id, course.id, full)
    return { lessonId: order.length ? resumeLessonId(order) : null }
  })

// Todo lo que necesita la pantalla de una lección.
export const getPlayer = createServerFn()
  .validator(
    z.object({
      slug: z.string(),
      lessonId: z.string(),
      preview: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { session, course, full, preview } = await requireAccess(
      data.slug,
      data.preview,
    )
    const { items, seen, tree, order } = await loadTree(
      session.user.id,
      course.id,
      full,
      preview,
    )
    const current = order.find((o) => o.lesson.id === data.lessonId)
    if (!current) throw notFound()

    const item = items.find((i) => i.id === data.lessonId)
    const chapterItem = current.chapterId
      ? items.find((i) => i.id === current.chapterId)
      : undefined
    const block = tree.find((b) => b.id === current.blockId)

    const moments = preview
      ? []
      : await prisma.lessonMoment.findMany({
          where: { userId: session.user.id, itemId: data.lessonId },
          orderBy: { seconds: 'asc' },
        })
    // Las respondidas las ven todas; las que espera la chef, solo quien las hizo.
    const questions = await prisma.lessonQuestion.findMany({
      where: {
        itemId: data.lessonId,
        OR: [
          { status: 'ANSWERED' },
          ...(preview
            ? []
            : [{ status: 'PENDING' as const, userId: session.user.id }]),
        ],
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    const resources = await prisma.resource.findMany({
      where: {
        itemId: {
          in: [data.lessonId, ...(chapterItem ? [chapterItem.id] : [])],
        },
        // El recetario general pide el curso comprado: la clase gratis no lo ve ni lo ofrece.
        ...(full
          ? {}
          : { NOT: { url: { startsWith: RECIPE_BOOK_URL_PREFIX } } }),
      },
      orderBy: { position: 'asc' },
    })
    const toResource = (r: { id: string; name: string; url: string }) => ({
      id: r.id,
      name: r.name,
      url: r.url,
    })

    const total = order.length
    const seenCount = order.filter((o) => seen.has(o.lesson.id)).length
    return {
      preview,
      // Hay un proveedor de IA y no está apagado ni en su tope: "Preguntar" lo consulta primero
      // (ver `lib/assistant.ts` y `lib/assistant-usage.ts`).
      assistant: assistantEnabled() && (await studentsCanAsk()),
      course: { slug: course.slug, name: course.name },
      user: {
        name: session.user.name,
        email: session.user.email,
        isAdmin: session.user.role === 'ADMIN',
      },
      progress: {
        seen: seenCount,
        total,
        pct: total ? Math.round((seenCount / total) * 100) : 0,
      },
      tree,
      lesson: {
        id: data.lessonId,
        title: item?.title ?? '',
        type: item?.lessonType ?? 'VIDEO',
        durationSec: item?.durationSec ?? null,
        notes: item?.notes ?? null,
        // Un video de Bunny va firmado y por HLS; si no, la URL http(s) que escribió la chef.
        videoUrl:
          (item?.bunnyVideoId && signedPlaybackUrl(item.bunnyVideoId)) ||
          (/^https?:\/\//.test(item?.videoUrl ?? '') ? item?.videoUrl : null),
        parts: parseParts(item?.videoParts ?? null),
        moments: moments.map((m) => ({
          id: m.id,
          seconds: m.seconds,
          name: m.name,
        })),
        questions: questions.map((q) => ({
          id: q.id,
          // De las demás alumnas solo se ve el primer nombre.
          who:
            q.userId === session.user.id
              ? 'Tú'
              : (q.user.name.trim().split(/\s+/)[0] ?? 'Alumna'),
          ago: ago(q.createdAt, now),
          text: q.text,
          answer: q.status === 'ANSWERED' ? q.answer : null,
        })),
        body: (item?.body ?? null) as JSONContent | null,
        seen: current.lesson.seen,
        blockTitle: block?.title ?? '',
        chapterTitle: chapterItem?.title ?? null,
        chapterId: current.chapterId,
        resources: resources
          .filter((r) => r.itemId === data.lessonId)
          .map(toResource),
        ...lessonPosition(order, data.lessonId),
      },
      chapter: chapterItem
        ? {
            title: chapterItem.title,
            recipe: (chapterItem.recipe ?? null) as JSONContent | null,
            resources: resources
              .filter((r) => r.itemId === chapterItem.id)
              .map(toResource),
          }
        : null,
    }
  })

// Acceso a una lección por su id: la alumna debe poder entrar al curso al que pertenece.
async function requireLessonAccess(lessonId: string) {
  const lesson = await prisma.courseItem.findUnique({
    where: { id: lessonId },
    include: { product: true },
  })
  if (lesson?.kind !== 'LESSON') throw notFound()
  const { session, full } = await requireAccess(lesson.product.slug)
  if (!full) {
    const items = await prisma.courseItem.findMany({
      where: { productId: lesson.productId },
    })
    if (!onlyFreeItems(items).some((i) => i.id === lesson.id)) {
      throw notFound()
    }
  }
  return { session, lesson }
}

// "Marcar como vista" / quitar la marca. Solo lecciones de un curso al que tiene acceso.
export const setLessonSeen = createServerFn({ method: 'POST' })
  .validator(z.object({ lessonId: z.string(), seen: z.boolean() }))
  .handler(async ({ data }) => {
    const { session, lesson } = await requireLessonAccess(data.lessonId)

    const where = {
      userId_itemId: { userId: session.user.id, itemId: lesson.id },
    }
    if (data.seen) {
      await prisma.lessonProgress.upsert({
        where,
        create: { userId: session.user.id, itemId: lesson.id },
        update: {},
      })
    } else {
      await prisma.lessonProgress.deleteMany({
        where: { userId: session.user.id, itemId: lesson.id },
      })
    }
  })

const MAX_MOMENTS = 50

// "Marcar este momento": el nombre lo pone el servidor (la parte del video en la que va).
export const addMoment = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      lessonId: z.string(),
      seconds: z.number().int().min(0).max(86_400),
    }),
  )
  .handler(async ({ data }) => {
    const { session, lesson } = await requireLessonAccess(data.lessonId)
    const mine = { userId: session.user.id, itemId: lesson.id }
    if ((await prisma.lessonMoment.count({ where: mine })) >= MAX_MOMENTS) {
      return { error: `Máximo ${MAX_MOMENTS} momentos por lección.` }
    }
    const part = partAt(parseParts(lesson.videoParts), data.seconds)
    await prisma.lessonMoment.create({
      data: { ...mine, seconds: data.seconds, name: part?.title ?? 'Momento' },
    })
    return {}
  })

// Solo la dueña del momento puede cambiarlo o quitarlo (y solo con acceso al curso).
async function ownMoment(id: string) {
  const moment = await prisma.lessonMoment.findUnique({ where: { id } })
  if (!moment) throw notFound()
  const { session } = await requireLessonAccess(moment.itemId)
  if (moment.userId !== session.user.id) throw notFound()
  return moment
}

export const renameMoment = createServerFn({ method: 'POST' })
  .validator(
    z.object({ id: z.string(), name: z.string().trim().min(1).max(80) }),
  )
  .handler(async ({ data }) => {
    const moment = await ownMoment(data.id)
    await prisma.lessonMoment.update({
      where: { id: moment.id },
      data: { name: data.name },
    })
  })

export const deleteMoment = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const moment = await ownMoment(data.id)
    await prisma.lessonMoment.delete({ where: { id: moment.id } })
  })

export const MAX_QUESTION_LENGTH = 1000
// Para que una alumna no llene la bandeja de la chef con la misma lección.
const MAX_PENDING_QUESTIONS = 5

const tooManyPending = async (userId: string, itemId: string) =>
  (await prisma.lessonQuestion.count({
    where: { userId, itemId, status: 'PENDING' },
  })) >= MAX_PENDING_QUESTIONS

const PENDING_LIMIT_ERROR = `Ya tienes ${MAX_PENDING_QUESTIONS} preguntas esperando respuesta en esta lección.`

// "Preguntar" sin asistente: la pregunta le llega a la chef y queda pendiente hasta que la responda.
export const createQuestion = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      lessonId: z.string(),
      text: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
    }),
  )
  .handler(async ({ data }) => {
    const { session, lesson } = await requireLessonAccess(data.lessonId)
    if (await tooManyPending(session.user.id, lesson.id)) {
      return { error: PENDING_LIMIT_ERROR }
    }
    await prisma.lessonQuestion.create({
      data: { userId: session.user.id, itemId: lesson.id, text: data.text },
    })
    return {}
  })

// "Preguntar" con asistente: responde con lo que se explica en la lección. La pregunta queda
// guardada (ASSISTANT) sin publicarse ni llegar a la chef hasta que la alumna pulse
// "Preguntarle a la chef". Si el asistente falla, la pregunta se guarda igual y se le ofrece
// mandarla a la chef.
export const askAssistant = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      lessonId: z.string(),
      text: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
    }),
  )
  .handler(async ({ data }) => {
    const { session, lesson } = await requireLessonAccess(data.lessonId)
    if (!assistantEnabled())
      return { error: 'El asistente no está disponible.' }
    // El lugar se reserva ANTES de llamar al modelo (y los límites cuentan también las peticiones
    // simultáneas y los fallos): ver `lib/assistant-usage.ts`.
    const slot = await reserveSlot(session.user.id, lesson.id)
    if (!slot.ok) return { error: slot.message }
    let answer: string | null = null
    const spent: { input?: number; output?: number } = {}
    let outcome: 'OK' | 'REFUSED' | 'FAILED' = 'OK'
    try {
      answer = await answerQuestion(lesson.id, data.text, undefined, (u) => {
        spent.input = u.input
        spent.output = u.output
      })
    } catch (error) {
      outcome = error instanceof AssistantRefusal ? 'REFUSED' : 'FAILED'
      console.error('[asistente] No se pudo responder:', error)
    }
    try {
      await finishSlot(slot.id, {
        outcome,
        inputTokens: spent.input,
        outputTokens: spent.output,
      })
    } catch (error) {
      // La reserva queda como "en curso": sigue contando para los límites.
      console.error('[asistente] No se pudo cerrar el registro de uso:', error)
    }
    const question = await prisma.lessonQuestion.create({
      data: {
        userId: session.user.id,
        itemId: lesson.id,
        text: data.text,
        status: 'ASSISTANT',
        assistantAnswer: answer,
      },
    })
    return { id: question.id, answer }
  })

// Una pregunta propia que todavía no responde la chef.
async function ownOpenQuestion(id: string) {
  const session = await readSession(getRequestHeaders())
  if (!session) throw redirect({ to: '/entrar' })
  const question = await prisma.lessonQuestion.findUnique({ where: { id } })
  if (
    !question ||
    question.userId !== session.user.id ||
    (question.status !== 'ASSISTANT' && question.status !== 'PENDING')
  ) {
    throw notFound()
  }
  return question
}

// 👍 "Me sirvió" / 👎 "No me sirvió" a la respuesta del asistente. Se guarda para medir
// qué tan bien responde.
export const voteAnswer = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), vote: z.enum(['UP', 'DOWN']) }))
  .handler(async ({ data }) => {
    const question = await ownOpenQuestion(data.id)
    await requireLessonAccess(question.itemId)
    await prisma.lessonQuestion.update({
      where: { id: question.id },
      data: { vote: data.vote },
    })
  })

// "Preguntarle a la chef": la pregunta que contestó el asistente pasa a la bandeja de la chef.
export const sendToChef = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const question = await ownOpenQuestion(data.id)
    const { session } = await requireLessonAccess(question.itemId)
    if (question.status === 'PENDING') return {}
    if (await tooManyPending(session.user.id, question.itemId)) {
      return { error: PENDING_LIMIT_ERROR }
    }
    await prisma.lessonQuestion.update({
      where: { id: question.id },
      data: { status: 'PENDING' },
    })
    return {}
  })
