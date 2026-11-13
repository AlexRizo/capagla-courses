import { describe, expect, it } from 'vitest'

import {
  SECOND_TIER_MESSAGE,
  filterWhere,
  forbiddenOnSelf,
  grantableProducts,
  includedCourseExpiry,
  searchWhere,
  secondTierError,
} from '#/lib/user-rules'

describe('forbiddenOnSelf', () => {
  it('no deja a una administradora cambiarse el rol, suspenderse ni borrarse', () => {
    for (const action of ['role', 'suspend', 'delete'] as const) {
      expect(forbiddenOnSelf('a', 'a', action)).toMatch(/tu propi/)
    }
  })

  it('sobre otra cuenta no bloquea nada', () => {
    for (const action of ['role', 'suspend', 'delete'] as const) {
      expect(forbiddenOnSelf('a', 'b', action)).toBeNull()
    }
  })
})

describe('filterWhere', () => {
  it('cada filtro arma su condición', () => {
    expect(filterWhere('todos')).toEqual({})
    expect(filterWhere('admin')).toEqual({ role: 'ADMIN' })
    expect(filterWhere('alumnas')).toEqual({ role: 'STUDENT' })
    expect(filterWhere('suspendidas')).toEqual({ suspendedAt: { not: null } })
  })
})

describe('searchWhere', () => {
  it('vacío o solo espacios no filtra', () => {
    expect(searchWhere('')).toEqual({})
    expect(searchWhere('   ')).toEqual({})
  })

  it('busca por nombre o correo sin distinguir mayúsculas', () => {
    expect(searchWhere(' Ana ')).toEqual({
      OR: [
        { name: { contains: 'Ana', mode: 'insensitive' } },
        { email: { contains: 'Ana', mode: 'insensitive' } },
      ],
    })
  })
})

describe('niveles de la herramienta al dar acceso a mano', () => {
  const products = [
    { id: 'navidad', kind: 'COURSE' as const },
    { id: 'costeo', kind: 'COURSE' as const },
    { id: 'basico', kind: 'TOOL' as const },
    { id: 'completo', kind: 'TOOL' as const },
  ]

  it('sin herramienta se ofrecen los dos niveles', () => {
    const ids = grantableProducts(products, [
      { productId: 'navidad', kind: 'COURSE' },
    ]).map((p) => p.id)
    expect(ids).toEqual(['costeo', 'basico', 'completo'])
  })

  it('con un nivel (aunque esté vencido) no se ofrece el otro', () => {
    const ids = grantableProducts(products, [
      { productId: 'basico', kind: 'TOOL' },
    ]).map((p) => p.id)
    expect(ids).toEqual(['navidad', 'costeo'])
  })

  it('el servidor rechaza un segundo nivel, no un curso', () => {
    expect(secondTierError('TOOL', ['COURSE', 'TOOL'])).toBe(
      SECOND_TIER_MESSAGE,
    )
    expect(secondTierError('TOOL', ['COURSE'])).toBeNull()
    expect(secondTierError('COURSE', ['TOOL'])).toBeNull()
  })
})

describe('includedCourseExpiry', () => {
  const tool = new Date('2027-11-12T00:00:00Z')

  it('sin el curso, lo da con el vencimiento de la herramienta', () => {
    expect(includedCourseExpiry(tool)).toEqual(tool)
  })

  it('si el curso vence antes, lo alarga', () => {
    expect(
      includedCourseExpiry(tool, new Date('2027-01-01T00:00:00Z')),
    ).toEqual(tool)
  })

  it('si el curso vence después o igual, no lo toca', () => {
    expect(
      includedCourseExpiry(tool, new Date('2028-01-01T00:00:00Z')),
    ).toBeNull()
    expect(includedCourseExpiry(tool, tool)).toBeNull()
  })
})
