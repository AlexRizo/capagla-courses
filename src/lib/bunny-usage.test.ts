import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { bunnyVideoUsage, bunnyVideoUsedBy } from '#/lib/bunny-usage'
import { resetDb, seedCatalog } from '#/test/db'

const LESSON_VIDEO = 'c338cb44-3ce0-471a-a1da-6c450b1af7c4'
const INTRO_VIDEO = 'e56ef22f-0e3a-43e7-a944-8c3e107a6406'
const FREE_VIDEO = '11111111-2222-3333-4444-555555555555'

// Qué videos de Bunny están en uso (para no borrarlos desde el selector del panel).
describe('uso de los videos de Bunny', () => {
  beforeEach(async () => {
    await resetDb()
    const { course } = await seedCatalog()
    await prisma.courseItem.create({
      data: {
        productId: course.id,
        kind: 'LESSON',
        position: 0,
        title: 'El dinero que no ves',
        bunnyVideoId: LESSON_VIDEO,
      },
    })
    await prisma.promotion.create({
      data: { slug: 'navidad', name: 'Navidad', introVideoId: INTRO_VIDEO },
    })
  })

  it('un video de una lección dice cuál lo usa', async () => {
    expect(await bunnyVideoUsedBy(LESSON_VIDEO)).toBe('El dinero que no ves')
  })

  it('el video de intro de una promoción también cuenta como usado', async () => {
    expect(await bunnyVideoUsedBy(INTRO_VIDEO)).toBe(
      'intro de la promoción Navidad',
    )
  })

  it('un video que nadie usa se puede borrar', async () => {
    expect(await bunnyVideoUsedBy(FREE_VIDEO)).toBeNull()
    expect((await bunnyVideoUsage()).size).toBe(2)
  })
})
