import { describe, expect, it } from 'vitest'

import {
  GRACE_MS,
  fromLocalInput,
  normalizeSlug,
  promotionApplies,
  promotionStatus,
  toLocalInput,
} from '#/lib/promotions'

const d = (iso: string) => new Date(iso)
const promo = {
  paused: false,
  startsAt: d('2026-10-16T06:00:00Z'),
  endsAt: d('2026-11-18T05:59:00Z'),
}

describe('promotionApplies', () => {
  it('aplica dentro de las fechas', () => {
    expect(promotionApplies(promo, d('2026-11-01T12:00:00Z'))).toBe(true)
  })
  it('no aplica antes de empezar ni sin fecha de inicio', () => {
    expect(promotionApplies(promo, d('2026-10-15T12:00:00Z'))).toBe(false)
    expect(
      promotionApplies({ ...promo, startsAt: null }, d('2026-11-01T12:00:00Z')),
    ).toBe(false)
  })
  it('no aplica pausada', () => {
    expect(
      promotionApplies({ ...promo, paused: true }, d('2026-11-01T12:00:00Z')),
    ).toBe(false)
  })
  it('sin fecha de fin no termina', () => {
    expect(
      promotionApplies({ ...promo, endsAt: null }, d('2030-01-01T00:00:00Z')),
    ).toBe(true)
  })
  it('después del fin solo aplica con la hora de gracia', () => {
    const after = new Date(promo.endsAt.getTime() + 30 * 60 * 1000)
    expect(promotionApplies(promo, after)).toBe(false)
    expect(promotionApplies(promo, after, GRACE_MS)).toBe(true)
    const late = new Date(promo.endsAt.getTime() + GRACE_MS + 1000)
    expect(promotionApplies(promo, late, GRACE_MS)).toBe(false)
  })
})

describe('promotionStatus', () => {
  it('distingue pausada, programada, activa y terminada', () => {
    expect(promotionStatus({ ...promo, paused: true })).toBe('Pausada')
    expect(promotionStatus(promo, d('2026-10-01T00:00:00Z'))).toBe('Programada')
    expect(promotionStatus(promo, d('2026-11-01T00:00:00Z'))).toBe('Activa')
    expect(promotionStatus(promo, d('2026-12-01T00:00:00Z'))).toBe('Terminada')
  })
})

describe('normalizeSlug', () => {
  it('limpia mayúsculas y la diagonal inicial', () => {
    expect(normalizeSlug('/Navidad-Final')).toBe('navidad-final')
  })
  it('rechaza URLs inválidas o reservadas', () => {
    expect(normalizeSlug('admin')).toBeNull()
    expect(normalizeSlug('mis-cursos')).toBeNull()
    expect(normalizeSlug('con espacios')).toBeNull()
    expect(normalizeSlug('a/b')).toBeNull()
    expect(normalizeSlug('')).toBeNull()
  })
})

describe('fechas en hora de México', () => {
  it('ida y vuelta del campo datetime-local', () => {
    const date = fromLocalInput('2026-11-17T23:59')
    expect(date).toBeInstanceOf(Date)
    expect(toLocalInput(date as Date)).toBe('2026-11-17T23:59')
  })
  it('vacío es null e inválido es undefined', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('mañana')).toBeUndefined()
  })
})
