import { describe, expect, it } from 'vitest'

import {
  BURST_PER_MINUTE,
  DAILY_ASSISTANT_LIMIT,
  decideSlot,
  estimateCostUsd,
} from '#/lib/assistant-limits'
import type { SlotCounts } from '#/lib/assistant-limits'

const on = { enabled: true, dailyLimit: 2000 }
const none: SlotCounts = {
  inFlight: 0,
  lastMinute: 0,
  userDay: 0,
  globalDay: 0,
}
const reason = (settings: typeof on, counts: Partial<SlotCounts>) => {
  const d = decideSlot(settings, { ...none, ...counts })
  return d.ok ? 'ok' : d.reason
}

describe('decideSlot', () => {
  it('sin nada en contra, deja pasar', () => {
    expect(reason(on, {})).toBe('ok')
  })

  it('el interruptor apagado bloquea a todas', () => {
    expect(reason({ ...on, enabled: false }, {})).toBe('off')
  })

  it('el tope global bloquea justo al llegar a él', () => {
    expect(reason(on, { globalDay: 1999 })).toBe('ok')
    expect(reason(on, { globalDay: 2000 })).toBe('global')
    expect(reason({ ...on, dailyLimit: 10 }, { globalDay: 10 })).toBe('global')
  })

  it('una pregunta a la vez', () => {
    expect(reason(on, { inFlight: 1 })).toBe('busy')
  })

  it('máximo 5 por minuto', () => {
    expect(BURST_PER_MINUTE).toBe(5)
    expect(reason(on, { lastMinute: 4 })).toBe('ok')
    expect(reason(on, { lastMinute: 5 })).toBe('rate')
  })

  it('máximo 15 al día por alumna', () => {
    expect(DAILY_ASSISTANT_LIMIT).toBe(15)
    expect(reason(on, { userDay: 14 })).toBe('ok')
    expect(reason(on, { userDay: 15 })).toBe('daily')
  })

  it('el orden: interruptor, tope global, en curso, minuto y día', () => {
    const all = { inFlight: 1, lastMinute: 9, userDay: 99, globalDay: 5000 }
    expect(reason({ ...on, enabled: false }, all)).toBe('off')
    expect(reason(on, all)).toBe('global')
    expect(reason(on, { ...all, globalDay: 0 })).toBe('busy')
    expect(reason(on, { ...all, globalDay: 0, inFlight: 0 })).toBe('rate')
    expect(
      reason(on, { ...all, globalDay: 0, inFlight: 0, lastMinute: 0 }),
    ).toBe('daily')
  })

  it('todo mensaje de bloqueo ofrece o sugiere un camino a la alumna', () => {
    for (const counts of [
      { globalDay: 2000 },
      { inFlight: 1 },
      { lastMinute: 5 },
      { userDay: 15 },
    ]) {
      const d = decideSlot(on, { ...none, ...counts })
      expect(d.ok).toBe(false)
      if (!d.ok) expect(d.message.length).toBeGreaterThan(20)
    }
    const off = decideSlot({ ...on, enabled: false }, none)
    expect(!off.ok && off.message).toContain('chef')
  })
})

describe('estimateCostUsd', () => {
  it('una pregunta típica (4,600 tokens de entrada y 270 de salida) cuesta ≈ $0.0006', () => {
    expect(estimateCostUsd(4600, 270)).toBeCloseTo(0.000595, 6)
  })

  it('sin tokens no cuesta nada', () => {
    expect(estimateCostUsd(0, 0)).toBe(0)
  })
})
