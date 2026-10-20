import Anthropic from '@anthropic-ai/sdk'

import type { TextModel } from '#/lib/assistant'

// Claude como modelo del asistente de las preguntas (solo servidor). `getTextModel` de
// `lib/assistant.ts` lo usa cuando hay `ANTHROPIC_API_KEY`.
//
// SIEMPRE Claude Haiku 5.5 (decisión del usuario, 2026-10-20: nunca Sonnet ni Opus), y por eso
// el modelo no se configura: ni variable de entorno ni opción. Es el modelo más barato (≈ $0.10
// de entrada y $0.50 de salida por millón de tokens con prompts de hasta 100 mil tokens; arriba
// de eso el precio sube) y alcanza para responder con lo que dice la lección. Un filtro de
// seguridad puede negarse y no hay modelo de respaldo: la alumna puede mandar la pregunta a la chef.
export const ASSISTANT_MODEL = 'claude-haiku-5-5'

// En los modelos actuales el razonamiento está siempre activo y cuenta contra `max_tokens`. El
// asistente pide pocos tokens (≈ la mitad de los caracteres que permite la respuesta), así que
// se suma margen para pensar: sin él, el modelo podría gastar todo en razonar y no dejar texto.
// El límite de largo de la respuesta lo sigue poniendo la instrucción y `answerQuestion`.
const THINKING_HEADROOM = 4000

export class AssistantRefusal extends Error {}

export function anthropicTextModel(options: {
  apiKey: string
  // Solo para una clave que no está atada a un workspace.
  workspaceId?: string
  // Solo pruebas: otra dirección en lugar de api.anthropic.com.
  baseURL?: string
}): TextModel {
  const client = new Anthropic({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.workspaceId
      ? { 'anthropic-workspace-id': options.workspaceId }
      : undefined,
    // Una pregunta que tarda más de un minuto no sirve en pantalla; el SDK reintenta 2 veces
    // los errores de red, de límite de uso y del servidor.
    timeout: 60_000,
  })

  return async ({ system, user, maxTokens }) => {
    try {
      const response = await client.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: maxTokens + THINKING_HEADROOM,
        system,
        messages: [{ role: 'user', content: user }],
        // Responder con lo que dice la lección no necesita razonar a fondo: es más rápido y barato.
        output_config: { effort: 'low' },
      })
      // Un filtro de seguridad puede negarse (HTTP 200 con este motivo): no hay respuesta.
      if (response.stop_reason === 'refusal') {
        throw new AssistantRefusal(
          `El modelo no respondió (${response.stop_details?.category ?? 'sin categoría'}).`,
        )
      }
      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim()
      if (!text) {
        throw new Error(
          `El modelo no devolvió texto (motivo de paro: ${response.stop_reason}).`,
        )
      }
      return text
    } catch (error) {
      // Solo el tipo de fallo: nunca la pregunta ni la lección.
      const detail =
        error instanceof Anthropic.APIError
          ? `HTTP ${error.status}`
          : error instanceof Error
            ? error.message
            : 'error desconocido'
      console.error(`[asistente] No se pudo generar la respuesta: ${detail}`)
      throw error
    }
  }
}
