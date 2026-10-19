import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseTranscript } from '#/lib/transcript'

// Las transcripciones corregidas que se cargan a la plataforma (`prisma/data/transcripciones`).
// Vienen de una transcripción automática que se revisó contra el recetario: aquí se comprueba que
// sigan completas y que no vuelvan los errores que ya se corrigieron.
const DIR = 'prisma/data/transcripciones'
const files = readdirSync(DIR).filter((f) => f.endsWith('.vtt'))
const text = (f: string) => readFileSync(`${DIR}/${f}`, 'utf8')
const map = JSON.parse(
  readFileSync('prisma/data/mapa-videos.json', 'utf8'),
) as {
  vimeo_nombre: string
}[]

describe('transcripciones corregidas', () => {
  it('hay una por cada video del mapa (más las dos de la biblioteca anterior)', () => {
    const names = new Set(
      files.map((f) => f.replace(/\.vtt$/, '').toLowerCase()),
    )
    const missing = map.filter((m) => !names.has(m.vimeo_nombre.toLowerCase()))
    expect(missing).toEqual([])
    expect(files).toHaveLength(52)
  })

  it('todas se leen, traen minutos que no retroceden y no tienen caracteres dañados', () => {
    for (const f of files) {
      const raw = text(f)
      expect(raw.startsWith('WEBVTT'), f).toBe(true)
      expect(raw, f).not.toMatch(/�|Ã|Â/)
      const lines = parseTranscript(raw)
      expect(lines.length, f).toBeGreaterThan(0)
      const times = lines.map((l) => l.t)
      expect(times, f).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it('traen 2 330 líneas en total (la revisión no agregó ni quitó subtítulos)', () => {
    const total = files.reduce((n, f) => n + parseTranscript(text(f)).length, 0)
    expect(total).toBe(2330)
  })

  it('no vuelven los errores de oído ya corregidos', () => {
    const all = files.map(text).join('\n')
    const banned: [RegExp, string][] = [
      [/\bno es picada\b|\bnues picada\b/i, 'nuez picada'],
      [/\broza inflado\b/i, 'arroz inflado'],
      [/\bcampes de chocolate\b/i, 'enjambres de chocolate'],
      [/\bGladys\b|\bAparecio\b/, 'Gladis Aparicio'],
      [/\bMacy-Clay\b/i, 'mise en place'],
      [/\bdulla/i, 'duya'],
      [/\bgraj/i, 'gragea'],
      [/\bvet[uúoó]n\b|\bbet[oó]n\b/i, 'betún'],
      [/\bg[ei]ngibre\b|\bgingive\b/i, 'jengibre'],
      [/\blaunch box\b/i, 'lunch box'],
      [/\bsernid/i, 'cernida'],
      [/\bm[ao]scavado\b/i, 'mascabado'],
      [/\bRoyal (Lies|Eyes)\b|\broyalize\b/i, 'Royal Ice'],
      [/\bEncapagla\b/, 'En Capagla'],
    ]
    for (const [rx, right] of banned) {
      expect(all.match(rx), `quedó un error de "${right}"`).toBeNull()
    }
  })

  it('los ingredientes quedan como en el recetario', () => {
    const get = (prefix: string) =>
      text(files.find((f) => f.startsWith(prefix))!)
    expect(get('01-01')).toContain('100 gramos de nuez picada')
    expect(get('01-01')).toContain('50 gramos de arroz inflado sabor chocolate')
    expect(get('05-01')).toContain('150 gramos de nuez picada')
    expect(get('06-04')).toContain('110 gramos de nuez picada')
    expect(get('08-01')).toContain('20 gramos de cocoa en polvo')
    expect(get('06-01')).toContain('Gladis Aparicio')
  })
})
