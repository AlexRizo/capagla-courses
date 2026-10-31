import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { inPublicList, visibleQuestionsWhere } from '#/lib/question-visibility'
import { resetDb } from '#/test/db'

let itemId: string
const user = (id: string) =>
  prisma.user.create({
    data: { id, name: id, email: `${id}@example.com` },
  })

beforeEach(async () => {
  await resetDb()
  const product = await prisma.product.create({
    data: {
      slug: 'curso',
      name: 'Curso',
      kind: 'COURSE',
      priceMxn: 100,
    },
  })
  const item = await prisma.courseItem.create({
    data: {
      productId: product.id,
      kind: 'LESSON',
      position: 0,
      title: 'Lección',
    },
  })
  itemId = item.id
  await Promise.all([user('ana'), user('beto')])
  const q = (
    userId: string,
    text: string,
    status: 'ASSISTANT' | 'PENDING' | 'ANSWERED' | 'HIDDEN',
    assistantAnswer: string | null = null,
  ) =>
    prisma.lessonQuestion.create({
      data: { userId, itemId, text, status, assistantAnswer },
    })
  await q('ana', 'ana-ia', 'ASSISTANT', 'respuesta ia')
  await q('ana', 'ana-ia-sin-respuesta', 'ASSISTANT')
  await q('ana', 'ana-pendiente', 'PENDING', 'respuesta ia')
  await q('ana', 'ana-respondida', 'ANSWERED', 'respuesta ia')
  await q('ana', 'ana-oculta', 'HIDDEN', 'respuesta ia')
})

const seen = async (userId: string, preview = false) => {
  const rows = await prisma.lessonQuestion.findMany({
    where: visibleQuestionsWhere(itemId, userId, preview),
  })
  return rows.map((r) => r.text).sort()
}

describe('preguntas públicas de una lección', () => {
  it('otra alumna ve lo respondido y lo que contestó el asistente, no lo pendiente', async () => {
    expect(await seen('beto')).toEqual(['ana-ia', 'ana-respondida'])
  })

  it('quien preguntó ve además lo suyo sin responder, pero no lo oculto', async () => {
    expect(await seen('ana')).toEqual([
      'ana-ia',
      'ana-ia-sin-respuesta',
      'ana-pendiente',
      'ana-respondida',
    ])
  })

  it('la vista previa solo muestra lo que respondió la chef', async () => {
    expect(await seen('beto', true)).toEqual(['ana-respondida'])
  })

  it('lo propio que solo contestó el asistente va al historial, no a la lista pública', () => {
    const own = { status: 'ASSISTANT' as const, userId: 'ana' }
    expect(inPublicList(own, 'ana')).toBe(false)
    expect(inPublicList(own, 'beto')).toBe(true)
    expect(inPublicList({ status: 'PENDING', userId: 'ana' }, 'ana')).toBe(true)
    expect(inPublicList({ status: 'ANSWERED', userId: 'ana' }, 'ana')).toBe(
      true,
    )
  })
})
