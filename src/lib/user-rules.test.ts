import { describe, expect, it } from 'vitest'

import { filterWhere, forbiddenOnSelf, searchWhere } from '#/lib/user-rules'

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
