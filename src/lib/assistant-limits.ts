// Límites de gasto del asistente de IA. Reglas puras (sin base de datos): `assistant-usage.ts`
// cuenta y reserva, y aquí se decide si una pregunta puede pasar.

// Preguntas al asistente por alumna en 24 horas.
export const DAILY_ASSISTANT_LIMIT = 15
// Preguntas por minuto de una alumna (cuenta también los fallos) y una a la vez.
export const BURST_PER_MINUTE = 5
// Tope global por defecto: preguntas en 24 horas, sumando a todas las alumnas.
export const DEFAULT_GLOBAL_LIMIT = 2000
export const MIN_GLOBAL_LIMIT = 10
export const MAX_GLOBAL_LIMIT = 100_000
// Una reserva sin terminar (el servidor se cayó a la mitad) deja de contar como "en curso" a
// los 3 minutos: el modelo tarda 60 s como máximo y el SDK reintenta 2 veces.
export const RESERVATION_TTL_MS = 3 * 60 * 1000

const OFF =
  'El asistente no está disponible por ahora. Puedes mandarle tu pregunta a la chef.'

export type SlotCounts = {
  // Reservas de esta alumna que siguen en curso.
  inFlight: number
  // Preguntas de esta alumna en el último minuto, con cualquier resultado.
  lastMinute: number
  // Preguntas de esta alumna en 24 horas, sin las fallidas.
  userDay: number
  // Preguntas de todas en 24 horas, sin las fallidas.
  globalDay: number
}

export type SlotDecision =
  | { ok: true }
  | {
      ok: false
      reason: 'off' | 'global' | 'busy' | 'rate' | 'daily'
      message: string
    }

// ¿Puede esta alumna preguntar ahora? Se revisa en este orden: el interruptor y el tope global
// (no dependen de ella), luego su ráfaga y por último su tope diario.
export function decideSlot(
  settings: { enabled: boolean; dailyLimit: number },
  counts: SlotCounts,
): SlotDecision {
  if (!settings.enabled) return { ok: false, reason: 'off', message: OFF }
  if (counts.globalDay >= settings.dailyLimit) {
    return { ok: false, reason: 'global', message: OFF }
  }
  if (counts.inFlight > 0) {
    return {
      ok: false,
      reason: 'busy',
      message: 'Espera a que termine tu pregunta anterior.',
    }
  }
  if (counts.lastMinute >= BURST_PER_MINUTE) {
    return {
      ok: false,
      reason: 'rate',
      message: 'Vas muy rápido: espera un minuto para preguntar de nuevo.',
    }
  }
  if (counts.userDay >= DAILY_ASSISTANT_LIMIT) {
    return {
      ok: false,
      reason: 'daily',
      message:
        'Llegaste al límite de preguntas al asistente por hoy. Puedes mandarle tu pregunta a la chef.',
    }
  }
  return { ok: true }
}

// Claude Haiku 5.5, dólares por millón de tokens (prompts de hasta 100 mil tokens, como los del
// asistente). Solo para estimar el gasto en el panel: la factura real es la de Anthropic.
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5 }

export function estimateCostUsd(inputTokens: number, outputTokens: number) {
  return (
    (inputTokens * PRICE_PER_MTOK.input +
      outputTokens * PRICE_PER_MTOK.output) /
    1_000_000
  )
}
