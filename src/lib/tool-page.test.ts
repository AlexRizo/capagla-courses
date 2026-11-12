import { describe, expect, it } from 'vitest'

import type { Offer } from '#/lib/offers'
import { buildToolPage } from '#/lib/tool-page'

const tiers = [
  {
    slug: 'herramienta-costos',
    name: 'Herramienta de costos · Completo',
    priceMxn: 569,
    rank: 2,
    itemLimit: 1000,
  },
  {
    slug: 'herramienta-costos-basico',
    name: 'Herramienta de costos · Básico',
    priceMxn: 429,
    rank: 1,
    itemLimit: 150,
  },
]

describe('buildToolPage', () => {
  it('página base: niveles ordenados, precio normal y checkout de cada uno', () => {
    const page = buildToolPage(tiers, '/cursos/calcular-costos')
    expect(page.plans.map((p) => p.name)).toEqual(['Básico', 'Completo'])
    expect(page.fromMxn).toBe(429)
    expect(page.plans[1]).toMatchObject({
      priceMxn: 569,
      strikeMxn: null,
      href: '/checkout?producto=herramienta-costos',
    })
    expect(page.title).toBe('¿Cuánto te queda de verdad por cada postre?')
  })

  it('promoción con el Completo: su precio especial con el normal tachado; el Básico igual', () => {
    const offer = {
      promotion: {
        id: 'p',
        slug: 'herramienta-buen-fin',
        introTitle: 'Título de la promoción',
        introText: null,
        endsAt: null,
      },
      applied: true,
      main: { slug: 'herramienta-costos', normalMxn: 569, priceMxn: 399 },
      extras: [],
    } as unknown as Offer
    const page = buildToolPage(tiers, null, offer)
    expect(page.title).toBe('Título de la promoción')
    expect(page.fromMxn).toBe(399)
    expect(page.plans[1]).toMatchObject({
      priceMxn: 399,
      strikeMxn: 569,
      note: 'Precio especial.',
      href: '/checkout?promo=herramienta-buen-fin',
    })
    expect(page.plans[0].href).toBe(
      '/checkout?producto=herramienta-costos-basico',
    )
  })

  it('fuera de fechas la promoción muestra el precio normal, sin tachar', () => {
    const offer = {
      promotion: {
        id: 'p',
        slug: 'x',
        introTitle: null,
        introText: null,
        endsAt: null,
      },
      applied: false,
      main: { slug: 'herramienta-costos', normalMxn: 569, priceMxn: 569 },
      extras: [],
    } as unknown as Offer
    const plan = buildToolPage(tiers, null, offer).plans[1]
    expect(plan).toMatchObject({ priceMxn: 569, strikeMxn: null, note: null })
  })
})
