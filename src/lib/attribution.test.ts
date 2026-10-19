import { describe, expect, it } from 'vitest'

import {
  attributionFromSearch,
  attributionJson,
  groupPurchasesByOrigin,
  parseAttribution,
  stripeMetadata,
} from '#/lib/attribution'
import { parseConsent } from '#/lib/consent'

describe('attributionFromSearch', () => {
  it('toma las etiquetas utm y los clics de Meta y TikTok', () => {
    const a = attributionFromSearch(
      '?utm_source=meta&utm_medium=cpc&utm_campaign=navidad&utm_content=reel1&fbclid=ABC&ttclid=XYZ&otra=1',
      '/navidad',
    )
    expect(a).toMatchObject({
      utm_source: 'meta',
      utm_medium: 'cpc',
      utm_campaign: 'navidad',
      utm_content: 'reel1',
      fbclid: 'ABC',
      ttclid: 'XYZ',
      landing: '/navidad',
    })
    expect(a).not.toHaveProperty('otra')
  })

  it('sin etiquetas devuelve null (no pisa lo guardado)', () => {
    expect(attributionFromSearch('?promo=navidad&x=1', '/')).toBeNull()
    expect(attributionFromSearch('', '/')).toBeNull()
    expect(attributionFromSearch('?utm_source=%20%20', '/')).toBeNull()
  })

  it('recorta los valores largos', () => {
    const a = attributionFromSearch(`?utm_source=${'a'.repeat(500)}`, '/')
    expect(a?.utm_source).toHaveLength(200)
  })
})

describe('parseAttribution', () => {
  it('acepta la cookie bien formada', () => {
    const raw = JSON.stringify({ utm_source: 'tiktok', ttclid: 'T1' })
    expect(parseAttribution(raw)).toEqual({
      utm_source: 'tiktok',
      ttclid: 'T1',
    })
  })

  it('descarta lo que no sea válido, sin lanzar', () => {
    expect(parseAttribution(undefined)).toBeNull()
    expect(parseAttribution('')).toBeNull()
    expect(parseAttribution('no es json')).toBeNull()
    expect(parseAttribution('[1,2]')).toBeNull()
    expect(parseAttribution(JSON.stringify({ utm_source: 5 }))).toBeNull()
    expect(
      parseAttribution(JSON.stringify({ utm_source: 'x'.repeat(201) })),
    ).toBeNull()
    // Solo campos de página o fecha, sin ninguna etiqueta: no cuenta.
    expect(parseAttribution(JSON.stringify({ landing: '/' }))).toBeNull()
  })

  it('ignora campos que no conoce', () => {
    const a = parseAttribution(
      JSON.stringify({ utm_source: 'meta', isAdmin: true }),
    )
    expect(a).toEqual({ utm_source: 'meta' })
  })
})

describe('stripeMetadata', () => {
  it('lleva promoción, campaña y creativo', () => {
    expect(
      stripeMetadata(
        { utm_source: 'meta', utm_campaign: 'nav', utm_content: 'reel1' },
        'navidad',
      ),
    ).toEqual({
      promotion: 'navidad',
      utm_source: 'meta',
      campaign: 'nav',
      creative: 'reel1',
    })
  })

  it('sin atribución ni promoción queda vacío', () => {
    expect(stripeMetadata(null, null)).toEqual({})
  })
})

describe('attributionJson', () => {
  it('solo deja los campos con valor', () => {
    expect(attributionJson({ utm_source: 'meta', fbclid: undefined })).toEqual({
      utm_source: 'meta',
    })
    expect(attributionJson(null)).toBeUndefined()
  })
})

describe('parseConsent', () => {
  it('lee la elección y no inventa una', () => {
    expect(parseConsent('si')).toBe('accepted')
    expect(parseConsent('no')).toBe('rejected')
    expect(parseConsent(undefined)).toBeNull()
    expect(parseConsent('quizás')).toBeNull()
    expect(parseConsent('constructor')).toBeNull()
    expect(parseConsent('__proto__')).toBeNull()
  })
})

describe('groupPurchasesByOrigin', () => {
  const meta = {
    utm_source: 'meta',
    utm_medium: 'paid',
    utm_campaign: 'nav',
    utm_content: 'reel1',
  }

  it('agrupa por fuente, medio, campaña y creativo y suma ingresos', () => {
    const rows = groupPurchasesByOrigin([
      { amountMxn: 397, attribution: meta },
      { amountMxn: 497, attribution: { ...meta, fbclid: 'X' } },
      { amountMxn: 397, attribution: { ...meta, utm_content: 'reel2' } },
      {
        amountMxn: 397,
        attribution: {
          utm_source: 'tiktok',
          utm_medium: 'paid',
          utm_campaign: 'nav',
          utm_content: 'v1',
        },
      },
    ])
    expect(rows).toEqual([
      {
        source: 'meta',
        medium: 'paid',
        campaign: 'nav',
        creative: 'reel1',
        purchases: 2,
        revenueMxn: 894,
      },
      {
        source: 'meta',
        medium: 'paid',
        campaign: 'nav',
        creative: 'reel2',
        purchases: 1,
        revenueMxn: 397,
      },
      {
        source: 'tiktok',
        medium: 'paid',
        campaign: 'nav',
        creative: 'v1',
        purchases: 1,
        revenueMxn: 397,
      },
    ])
  })

  it('las mayúsculas no separan un mismo origen', () => {
    const rows = groupPurchasesByOrigin([
      { amountMxn: 100, attribution: { utm_source: 'Meta' } },
      { amountMxn: 100, attribution: { utm_source: 'meta' } },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].purchases).toBe(2)
  })

  it('las compras sin etiquetas van juntas y al final', () => {
    const rows = groupPurchasesByOrigin([
      { amountMxn: 900, attribution: null },
      { amountMxn: 900, attribution: 'basura' },
      { amountMxn: 50, attribution: { utm_source: 'brevo' } },
    ])
    expect(rows.map((r) => r.source)).toEqual(['brevo', ''])
    expect(rows[1]).toMatchObject({ purchases: 2, revenueMxn: 1800 })
  })

  it('sin compras no hay filas', () => {
    expect(groupPurchasesByOrigin([])).toEqual([])
  })
})
