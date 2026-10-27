import { describe, expect, it } from 'vitest'

import { parseParts } from '#/lib/duration'
import {
  MIN_SECONDS_FOR_PARTS,
  partsPrompt,
  readGeneratedParts,
} from '#/lib/video-parts'

// Capítulos automáticos: la respuesta del modelo se limpia y se valida antes de guardarse.
const lines = [0, 20, 61, 125, 190, 250, 300].map((t) => ({
  t,
  x: `línea ${t}`,
}))

describe('readGeneratedParts', () => {
  it('lee "m:ss Título", pega cada minuto a una línea de la transcripción y empieza en 0:00', () => {
    const out = readGeneratedParts(
      '0:03 Ingredientes\n2:03 Mezclar la masa\n4:08 Hornear',
      lines,
      320,
    )
    expect(out).toBe('0:00 Ingredientes\n2:05 Mezclar la masa\n4:10 Hornear')
    expect(parseParts(out)).toHaveLength(3)
  })

  it('tolera viñetas, corchetes, negritas y punto final', () => {
    const out = readGeneratedParts(
      '- [0:00] **Ingredientes**\n* 1:01 – Mezclar.\n3:10: "Hornear"',
      lines,
      320,
    )
    expect(out).toBe('0:00 Ingredientes\n1:01 Mezclar\n3:10 Hornear')
  })

  it('ignora lo que no es un capítulo y lo que cae fuera del video', () => {
    const out = readGeneratedParts(
      'Aquí están los capítulos:\n0:00 Inicio\n1:01 Mezclar\n9:00 Después del final',
      lines,
      320,
    )
    expect(out).toBe('0:00 Inicio\n1:01 Mezclar')
  })

  it('descarta capítulos a menos de 30 segundos del anterior', () => {
    const out = readGeneratedParts('0:00 A\n0:20 B\n1:01 C', lines, 320)
    expect(out).toBe('0:00 A\n1:01 C')
  })

  it('devuelve null con menos de 2 capítulos, sin transcripción con minutos o con basura', () => {
    expect(readGeneratedParts('0:00 Solo uno', lines, 320)).toBeNull()
    expect(
      readGeneratedParts('No puedo ayudar con eso.', lines, 320),
    ).toBeNull()
    expect(readGeneratedParts('0:00 A\n1:01 B', [], 320)).toBeNull()
  })

  it('rechaza más de 12 capítulos o títulos largos', () => {
    const many = Array.from({ length: 13 }, (_, i) => `${i * 30}`)
    const dense = many.map((t) => ({ t: Number(t), x: 'x' }))
    const text = many
      .map(
        (t) =>
          `${Math.floor(Number(t) / 60)}:${String(Number(t) % 60).padStart(2, '0')} Parte ${t}`,
      )
      .join('\n')
    expect(readGeneratedParts(text, dense, 400)).toBeNull()
    expect(
      readGeneratedParts(`0:00 ${'a'.repeat(61)}\n1:01 B`, lines, 320),
    ).toBeNull()
  })
})

describe('partsPrompt', () => {
  it('lleva el título, la duración y la transcripción con sus minutos', () => {
    const { system, user } = partsPrompt('Procedimiento', 320, lines)
    expect(system).toContain('0:00')
    expect(user).toContain('Lección: Procedimiento')
    expect(user).toContain('Duración: 5:20')
    expect(user).toContain('[2:05] línea 125')
  })

  it('los videos de menos de 2 minutos no llevan capítulos', () => {
    expect(MIN_SECONDS_FOR_PARTS).toBe(120)
  })
})
