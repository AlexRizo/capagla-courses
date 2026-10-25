import { prisma } from '#/db'
import {
  DEFAULT_GLOBAL_LIMIT,
  OFF_TOPIC_STREAK,
  RESERVATION_TTL_MS,
  decideSlot,
  estimateCostUsd,
  isPaused,
} from '#/lib/assistant-limits'
import type { SlotDecision } from '#/lib/assistant-limits'

// Uso del asistente de IA (solo servidor): reserva el lugar de cada pregunta ANTES de llamar al
// modelo y guarda lo que se gastó. Las reglas de cuánto se permite están en `assistant-limits.ts`.

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000
// Lo que gasta de verdad el tope global: sin los fallos ni lo que el filtro previo descartó.
const SPENT = {
  outcome: { notIn: ['FAILED', 'FILTERED'] as ('FAILED' | 'FILTERED')[] },
}

export async function loadAssistantLimits() {
  const row = await prisma.assistantSettings.findUnique({
    where: { id: 'main' },
  })
  return {
    enabled: row?.enabled ?? true,
    dailyLimit: row?.dailyLimit ?? DEFAULT_GLOBAL_LIMIT,
  }
}

// Reserva el lugar de una pregunta. Va dentro de una transacción con un candado de la base de
// datos (el mismo para todas): las peticiones simultáneas pasan de una en una, así que ninguna
// se salta el conteo, como pasaba al contar, llamar al modelo y recién entonces guardar.
export async function reserveSlot(
  userId: string,
  itemId: string,
): Promise<{ ok: true; id: string } | Extract<SlotDecision, { ok: false }>> {
  return prisma.$transaction(async (tx) => {
    // El candado devuelve `void`, que Prisma no sabe leer: se envuelve para devolver un entero.
    await tx.$queryRaw`select 1 as ok from (select pg_advisory_xact_lock(4210017)) as candado`
    const settings = await tx.assistantSettings.findUnique({
      where: { id: 'main' },
    })
    const now = Date.now()
    const since = (ms: number) => ({ gt: new Date(now - ms) })
    const mine = { userId }
    const counted = { outcome: { not: 'FAILED' as const } }
    const counts = {
      inFlight: await tx.assistantUsage.count({
        where: {
          ...mine,
          outcome: 'RESERVED',
          createdAt: since(RESERVATION_TTL_MS),
        },
      }),
      lastMinute: await tx.assistantUsage.count({
        where: { ...mine, createdAt: since(MINUTE_MS) },
      }),
      userDay: await tx.assistantUsage.count({
        where: { ...mine, ...counted, createdAt: since(DAY_MS) },
      }),
      globalDay: await tx.assistantUsage.count({
        where: { ...SPENT, createdAt: since(DAY_MS) },
      }),
      paused: isPaused(
        await tx.assistantUsage.findMany({
          where: { ...mine, outcome: { notIn: ['RESERVED', 'FAILED'] } },
          orderBy: { createdAt: 'desc' },
          take: OFF_TOPIC_STREAK,
          select: { outcome: true, createdAt: true },
        }),
        now,
      ),
    }
    const decision = decideSlot(
      {
        enabled: settings?.enabled ?? true,
        dailyLimit: settings?.dailyLimit ?? DEFAULT_GLOBAL_LIMIT,
      },
      counts,
    )
    if (!decision.ok) return decision
    const row = await tx.assistantUsage.create({
      data: { userId, itemId, createdAt: new Date(now) },
    })
    return { ok: true as const, id: row.id }
  })
}

// Cierra la reserva con cómo terminó y los tokens que gastó (si el modelo llegó a responder).
export async function finishSlot(
  id: string,
  result: {
    outcome: 'OK' | 'REFUSED' | 'FAILED' | 'OFF_TOPIC' | 'FILTERED'
    inputTokens?: number
    outputTokens?: number
  },
) {
  await prisma.assistantUsage.update({
    where: { id },
    data: {
      outcome: result.outcome,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  })
}

// ¿Pueden las alumnas preguntarle al asistente ahora? Con el interruptor apagado o el tope global
// alcanzado, "Preguntar" va directo a la chef, como cuando no hay clave de IA.
export async function studentsCanAsk() {
  const limits = await loadAssistantLimits()
  if (!limits.enabled) return false
  const globalDay = await prisma.assistantUsage.count({
    where: { ...SPENT, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
  })
  return globalDay < limits.dailyLimit
}

// Lo que se gastó en las últimas 24 horas, para el panel de la chef.
export async function usageSummary() {
  const rows = await prisma.assistantUsage.groupBy({
    by: ['outcome'],
    where: { createdAt: { gt: new Date(Date.now() - DAY_MS) } },
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true },
  })
  const count = (outcome: string) =>
    rows.find((r) => r.outcome === outcome)?._count._all ?? 0
  const inputTokens = rows.reduce(
    (sum, r) => sum + (r._sum.inputTokens ?? 0),
    0,
  )
  const outputTokens = rows.reduce(
    (sum, r) => sum + (r._sum.outputTokens ?? 0),
    0,
  )
  return {
    // Con respuesta del modelo o en curso: lo que cuenta para el tope.
    questions:
      count('OK') + count('REFUSED') + count('OFF_TOPIC') + count('RESERVED'),
    failed: count('FAILED'),
    refused: count('REFUSED'),
    // Preguntas ajenas: las que marcó el modelo y las que descartó el filtro previo.
    offTopic: count('OFF_TOPIC') + count('FILTERED'),
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(inputTokens, outputTokens),
  }
}
