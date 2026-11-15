import { describe, expect, it } from 'vitest'

import { csvCell, leadsCsv, sourceLabel } from '#/lib/sales-rules'

describe('sourceLabel', () => {
  it('junta fuente, campaña y anuncio', () => {
    expect(
      sourceLabel({
        utm_source: 'facebook',
        utm_campaign: 'navidad',
        utm_content: 'video-2',
        fbclid: 'x',
      }),
    ).toBe('facebook · navidad · video-2')
  })

  it('sin etiquetas usa el clic de Meta o TikTok', () => {
    expect(sourceLabel({ fbclid: 'abc' })).toBe('Meta (clic)')
    expect(sourceLabel({ ttclid: 'abc' })).toBe('TikTok (clic)')
  })

  it('sin atribución o con datos raros es directo', () => {
    expect(sourceLabel(null)).toBe('Directo')
    expect(sourceLabel('basura')).toBe('Directo')
    expect(sourceLabel({ landing: '/navidad' })).toBe('Directo')
  })
})

describe('csv', () => {
  it('escapa comas, comillas y fórmulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('normal')).toBe('normal')
  })

  it('leadsCsv: EMAIL primero y fechas de México', () => {
    const csv = leadsCsv([
      {
        email: 'ana@ejemplo.com',
        // 2:00 UTC del 16 = 20:00 del 15 en México.
        createdAt: new Date('2026-11-16T02:00:00Z'),
        newsletterAt: null,
        attribution: { utm_source: 'tiktok' },
      },
    ])
    expect(csv).toBe(
      'EMAIL,REGISTRO,ACEPTA_CORREOS,FECHA_ACEPTA_CORREOS,ORIGEN\r\n' +
        'ana@ejemplo.com,2026-11-15,no,,tiktok\r\n',
    )
  })
})
