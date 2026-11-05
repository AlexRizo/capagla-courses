import { describe, expect, it } from 'vitest'

import { buildCoursePage } from '#/lib/course-landing'
import type { Offer } from '#/lib/offers'

const product = (
  slug: string,
  name: string,
  normalMxn: number,
  priceMxn = normalMxn,
  isCourse = true,
) => ({
  productId: slug,
  slug,
  name,
  isCourse,
  published: true,
  coverUrl: null,
  accessDays: 365,
  normalMxn,
  priceMxn,
})

const promotion = {
  id: 'p1',
  slug: 'redes',
  introTitle: null,
  introText: null,
  endsAt: null,
}

describe('buildCoursePage: curso de costeo', () => {
  it('enlace simple: precio normal, sin la oferta gratis y con sus preguntas', () => {
    const page = buildCoursePage({
      promotion: null,
      applied: false,
      main: product('calcular-costos', 'Aprende a Costear', 347),
      extras: [],
    })
    if (page?.layout !== 'costing')
      throw new Error('debe ser el diseño de costeo')
    expect(page.free).toBe(false)
    expect(page.tool).toBeNull()
    expect(page.priceMxn).toBe(347)
    expect(page.strike).toBe('')
    expect(page.faq).toHaveLength(6)
    expect(page.faq.at(-1)?.a).toBe(
      'Tienes acceso por 1 año a partir de tu compra.',
    )
  })

  it('promoción gratis: precio normal tachado, herramienta opcional y preguntas de la promoción', () => {
    const offer: Offer = {
      promotion,
      applied: true,
      main: product('calcular-costos', 'Aprende a Costear', 347, 0),
      extras: [
        product(
          'herramienta-costos',
          'Herramienta de costos · Completo',
          399,
          100,
          false,
        ),
      ],
    }
    const page = buildCoursePage(offer)
    if (page?.layout !== 'costing')
      throw new Error('debe ser el diseño de costeo')
    expect(page.free).toBe(true)
    expect(page.priceMxn).toBe(0)
    expect(page.strike).toBe('$347 MXN')
    expect(page.tool).toEqual({
      name: 'Herramienta de costos · Completo',
      old: '$399 MXN',
      now: '$100 MXN',
    })
    expect(page.faq).toHaveLength(8)
    expect(page.faq[0].q).toBe('¿Por qué el curso es gratis?')
    expect(page.promoSlug).toBe('redes')
  })

  it('promoción gratis sin herramienta: solo la tarjeta del curso', () => {
    const page = buildCoursePage({
      promotion,
      applied: true,
      main: product('calcular-costos', 'Aprende a Costear', 347, 0),
      extras: [],
    })
    if (page?.layout !== 'costing')
      throw new Error('debe ser el diseño de costeo')
    expect(page.free).toBe(true)
    expect(page.tool).toBeNull()
  })

  it('promoción que ya no aplica: se ve como el enlace simple', () => {
    const page = buildCoursePage({
      promotion,
      applied: false,
      main: product('calcular-costos', 'Aprende a Costear', 347),
      extras: [],
    })
    if (page?.layout !== 'costing')
      throw new Error('debe ser el diseño de costeo')
    expect(page.free).toBe(false)
    expect(page.tool).toBeNull()
    expect(page.priceMxn).toBe(347)
  })

  it('el título y el texto de la promoción reemplazan los del curso', () => {
    const page = buildCoursePage({
      promotion: {
        ...promotion,
        introTitle: 'Costea gratis',
        introText: 'Solo hoy',
      },
      applied: true,
      main: product('calcular-costos', 'Aprende a Costear', 347, 0),
      extras: [],
    })
    expect(page?.title).toBe('Costea gratis')
    expect(page?.intro).toBe('Solo hoy')
  })
})

describe('buildCoursePage: curso de recetas', () => {
  it('habla de 365 días de acceso, no de pago único', () => {
    const page = buildCoursePage({
      promotion: null,
      applied: false,
      main: product('postres-navidad', 'Postres para vender en Navidad', 897),
      extras: [],
    })
    if (page?.layout !== 'recipes')
      throw new Error('debe ser el diseño de recetas')
    expect(page.priceNote).toBe('acceso a 365 días')
    expect(page.promo).toBeNull()
  })

  it('con promoción vigente lista los adicionales', () => {
    const page = buildCoursePage({
      promotion: { ...promotion, endsAt: new Date('2026-11-18T05:59:00Z') },
      applied: true,
      main: product(
        'postres-navidad',
        'Postres para vender en Navidad',
        897,
        397,
      ),
      extras: [product('calcular-costos', 'Aprende a Costear', 347, 0)],
    })
    if (page?.layout !== 'recipes')
      throw new Error('debe ser el diseño de recetas')
    expect(page.priceNote).toContain(
      'acceso a 365 días · precio especial hasta el',
    )
    expect(page.promo?.offers[0]).toMatchObject({
      tag: 'CURSO ADICIONAL',
      title: 'Aprende a Costear',
      now: 'Gratis',
    })
  })

  it('un curso sin página de venta no tiene landing', () => {
    expect(
      buildCoursePage({
        promotion: null,
        applied: false,
        main: product('otro-curso', 'Otro', 100),
        extras: [],
      }),
    ).toBeNull()
  })
})
