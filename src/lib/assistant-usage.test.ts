import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { BURST_PER_MINUTE, DAILY_ASSISTANT_LIMIT } from '#/lib/assistant-limits'
import {
  finishSlot,
  reserveSlot,
  studentsCanAsk,
  usageSummary,
} from '#/lib/assistant-usage'
import { resetDb } from '#/test/db'

// Reservar el lugar de una pregunta contra la base de pruebas (nunca habla con Claude): aquí se
// comprueba, sobre todo, que las peticiones simultáneas no se salten los límites.
const MIN = 60 * 1000
const HOUR = 60 * MIN

const user = (id: string) =>
  prisma.user.create({ data: { id, name: id, email: `${id}@ejemplo.test` } })

type Outcome = 'RESERVED' | 'OK' | 'REFUSED' | 'FAILED'
const seed = (
  userId: string,
  count: number,
  ago: number,
  outcome: Outcome = 'OK',
) =>
  prisma.assistantUsage.createMany({
    data: Array.from({ length: count }, () => ({
      userId,
      itemId: 'leccion-1',
      outcome,
      createdAt: new Date(Date.now() - ago),
    })),
  })

const setLimits = (data: { enabled?: boolean; dailyLimit?: number }) =>
  prisma.assistantSettings.upsert({
    where: { id: 'main' },
    create: { id: 'main', ...data },
    update: data,
  })

const reasonOf = (r: Awaited<ReturnType<typeof reserveSlot>>) =>
  r.ok ? 'ok' : r.reason

beforeEach(async () => {
  await resetDb()
  await user('ana')
})

describe('reserveSlot: peticiones simultáneas', () => {
  it('40 peticiones a la vez de la misma alumna: solo una pasa y el resto espera', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, () => reserveSlot('ana', 'leccion-1')),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => reasonOf(r) === 'busy')).toHaveLength(39)
    expect(await prisma.assistantUsage.count()).toBe(1)
  })

  it('el tope global es exacto aunque pidan 12 alumnas distintas a la vez', async () => {
    await setLimits({ dailyLimit: 5 })
    for (let i = 0; i < 12; i++) await user(`u${i}`)
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveSlot(`u${i}`, 'leccion-1')),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(5)
    expect(results.filter((r) => reasonOf(r) === 'global')).toHaveLength(7)
    expect(await prisma.assistantUsage.count()).toBe(5)
  })

  it('alumnas distintas no se estorban entre sí', async () => {
    for (let i = 0; i < 20; i++) await user(`u${i}`)
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => reserveSlot(`u${i}`, 'leccion-1')),
    )
    expect(results.every((r) => r.ok)).toBe(true)
  })
})

describe('reserveSlot: ráfaga y tope diario por alumna', () => {
  it('terminada la anterior caben 5 por minuto y la sexta espera', async () => {
    for (let i = 0; i < BURST_PER_MINUTE; i++) {
      const slot = await reserveSlot('ana', 'leccion-1')
      expect(slot.ok).toBe(true)
      if (slot.ok) await finishSlot(slot.id, { outcome: 'OK' })
    }
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('rate')
  })

  it('una reserva en curso bloquea; ya terminada, no', async () => {
    const first = await reserveSlot('ana', 'leccion-1')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('busy')
    if (first.ok) await finishSlot(first.id, { outcome: 'OK' })
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
  })

  it('una reserva abandonada (el servidor se cayó) deja de bloquear a los 3 minutos', async () => {
    await seed('ana', 1, 10 * MIN, 'RESERVED')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
  })

  it('los fallos cuentan para el minuto, no para el día', async () => {
    await seed('ana', BURST_PER_MINUTE, 20 * 1000, 'FAILED')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('rate')
    await resetDb()
    await user('ana')
    await seed('ana', 40, 2 * HOUR, 'FAILED')
    await seed('ana', DAILY_ASSISTANT_LIMIT - 1, 2 * HOUR, 'OK')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
  })

  it('15 al día: la siguiente espera, y otra alumna no se afecta', async () => {
    await user('beto')
    await seed('ana', DAILY_ASSISTANT_LIMIT, 2 * HOUR)
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('daily')
    expect(reasonOf(await reserveSlot('beto', 'leccion-1'))).toBe('ok')
  })

  it('las rechazadas por el modelo sí cuentan para el día', async () => {
    await seed('ana', DAILY_ASSISTANT_LIMIT, 2 * HOUR, 'REFUSED')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('daily')
  })

  it('lo de hace más de 24 horas ya no cuenta', async () => {
    await seed('ana', DAILY_ASSISTANT_LIMIT, 25 * HOUR)
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
  })
})

describe('reserveSlot: interruptor y tope global', () => {
  it('sin configuración guardada está encendido con tope de 2,000', async () => {
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
    expect(await studentsCanAsk()).toBe(true)
  })

  it('apagado, nadie pregunta y la pantalla ya no ofrece al asistente', async () => {
    await setLimits({ enabled: false })
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('off')
    expect(await studentsCanAsk()).toBe(false)
    expect(await prisma.assistantUsage.count()).toBe(0)
  })

  it('al llegar al tope global bloquea a todas; los fallos no cuentan', async () => {
    await user('beto')
    await setLimits({ dailyLimit: 10 })
    await seed('beto', 10, 2 * HOUR, 'FAILED')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('ok')
    await resetDb()
    await user('ana')
    await user('beto')
    await setLimits({ dailyLimit: 10 })
    await seed('beto', 10, 2 * HOUR, 'OK')
    expect(reasonOf(await reserveSlot('ana', 'leccion-1'))).toBe('global')
    expect(await studentsCanAsk()).toBe(false)
  })

  it('el mensaje de un bloqueo ofrece mandarla a la chef', async () => {
    await setLimits({ enabled: false })
    const r = await reserveSlot('ana', 'leccion-1')
    expect(!r.ok && r.message).toContain('chef')
  })
})

describe('finishSlot y usageSummary', () => {
  it('guarda cómo terminó y los tokens', async () => {
    const slot = await reserveSlot('ana', 'leccion-1')
    if (!slot.ok) throw new Error('debía pasar')
    await finishSlot(slot.id, {
      outcome: 'OK',
      inputTokens: 4600,
      outputTokens: 270,
    })
    const row = await prisma.assistantUsage.findUniqueOrThrow({
      where: { id: slot.id },
    })
    expect(row).toMatchObject({
      outcome: 'OK',
      inputTokens: 4600,
      outputTokens: 270,
      itemId: 'leccion-1',
      userId: 'ana',
    })
  })

  it('el resumen suma las últimas 24 horas y estima el gasto', async () => {
    await prisma.assistantUsage.createMany({
      data: [
        {
          userId: 'ana',
          itemId: 'l',
          outcome: 'OK',
          inputTokens: 4600,
          outputTokens: 270,
        },
        {
          userId: 'ana',
          itemId: 'l',
          outcome: 'REFUSED',
          inputTokens: 4600,
          outputTokens: 10,
        },
        { userId: 'ana', itemId: 'l', outcome: 'FAILED' },
        {
          userId: 'ana',
          itemId: 'l',
          outcome: 'OK',
          inputTokens: 99999,
          outputTokens: 99999,
          createdAt: new Date(Date.now() - 30 * HOUR),
        },
      ],
    })
    const s = await usageSummary()
    expect(s.questions).toBe(2)
    expect(s.failed).toBe(1)
    expect(s.refused).toBe(1)
    expect(s.inputTokens).toBe(9200)
    expect(s.outputTokens).toBe(280)
    expect(s.costUsd).toBeCloseTo((9200 * 0.1 + 280 * 0.5) / 1_000_000, 8)
  })

  it('sin uso el resumen es cero', async () => {
    expect(await usageSummary()).toEqual({
      questions: 0,
      failed: 0,
      refused: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    })
  })
})
