import { describe, expect, it } from 'vitest'

import { tooManyAttempts } from '#/lib/rate-limit'

describe('tooManyAttempts', () => {
  it('por defecto deja 5 intentos por clave', () => {
    const key = `prueba-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(tooManyAttempts(key)).toBe(false)
    expect(tooManyAttempts(key)).toBe(true)
  })

  it('acepta su propio tope (20 registros por IP en la clase gratis)', () => {
    const key = `ip-${Math.random()}`
    for (let i = 0; i < 20; i++) {
      expect(tooManyAttempts(key, 20, 60_000)).toBe(false)
    }
    expect(tooManyAttempts(key, 20, 60_000)).toBe(true)
  })
})
