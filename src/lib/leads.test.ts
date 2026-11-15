import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { saveLead } from '#/lib/leads'
import { resetDb } from '#/test/db'

const email = 'ana@example.com'

beforeEach(async () => {
  await resetDb()
  await prisma.user.create({ data: { id: 'ana', name: 'Ana', email } })
})

const base = { email, userId: 'ana' }

describe('saveLead (clase gratis, H22)', () => {
  it('sin la casilla de novedades guarda el aviso y no las novedades', async () => {
    const lead = await saveLead({ ...base, newsletter: false })
    expect(lead.consentAt).toBeInstanceOf(Date)
    expect(lead.newsletterAt).toBeNull()
  })

  it('con la casilla guarda la fecha', async () => {
    const lead = await saveLead({ ...base, newsletter: true })
    expect(lead.newsletterAt).toBeInstanceOf(Date)
  })

  it('al volver a registrarse: la marca después y no se pierde si luego no la marca', async () => {
    await saveLead({ ...base, newsletter: false })
    const marked = await saveLead({ ...base, newsletter: true })
    expect(marked.newsletterAt).toBeInstanceOf(Date)
    const again = await saveLead({ ...base, newsletter: false })
    expect(again.newsletterAt).toEqual(marked.newsletterAt)
  })
})
