import { describe, expect, it } from 'vitest'

import { LEGAL, LEGAL_DOCS } from '#/lib/legal'

describe('textos legales', () => {
  const docs = Object.values(LEGAL_DOCS)

  it('hay cuatro documentos y cada uno trae título, introducción y secciones', () => {
    expect(docs.map((d) => d.slug).sort()).toEqual([
      'cookies',
      'devoluciones',
      'privacidad',
      'terminos',
    ])
    for (const d of docs) {
      expect(d.title).not.toBe('')
      expect(d.intro).not.toBe('')
      expect(d.sections.length).toBeGreaterThan(2)
    }
  })

  it('sin encabezados, párrafos ni viñetas repetidos (se usan como key de React)', () => {
    for (const d of docs) {
      const headings = d.sections.map((s) => s.heading)
      expect(new Set(headings).size).toBe(headings.length)
      for (const s of d.sections) {
        const texts = [...(s.paragraphs ?? []), ...(s.items ?? [])]
        expect(new Set(texts).size).toBe(texts.length)
        expect(s.paragraphs?.length || s.items?.length).toBeTruthy()
      }
    }
  })

  it('el aviso de privacidad nombra al responsable, el correo y los derechos ARCO', () => {
    const text = JSON.stringify(LEGAL_DOCS.privacidad)
    expect(text).toContain(LEGAL.responsable)
    expect(text).toContain(LEGAL.email)
    expect(text).toContain('ARCO')
  })

  it('la política de devoluciones dice que un reembolso total retira el acceso', () => {
    expect(JSON.stringify(LEGAL_DOCS.devoluciones)).toContain(
      'reembolso total retira el acceso',
    )
  })
})
