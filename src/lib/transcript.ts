// Transcripción de una lección: una lista de líneas con el segundo en que empiezan.
export type TranscriptLine = { t: number; x: string }

// "1:05" / "1:02:03" (como se ven en el panel).
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// "00:01:05.500", "01:05,500" o "1:05" → segundos.
function toSeconds(stamp: string) {
  const parts = stamp.trim().replace(',', '.').split(':').map(Number)
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    return null
  }
  return parts.reduce((total, p) => total * 60 + p, 0)
}

const CUE = /^(\S+)\s+-->\s+\S+/
const TAGS = /<[^>]+>/g

// Lee WebVTT o SRT (lo que da Bunny y casi cualquier herramienta de subtítulos): una línea por
// bloque de subtítulo, con el texto en una sola línea. Sin marcas de tiempo, es texto plano:
// un párrafo por línea, sin minuto (t = 0).
export function parseTranscript(source: string): TranscriptLine[] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines: TranscriptLine[] = []
  let cue: { t: number; parts: string[] } | null = null
  const flush = () => {
    const x = cue?.parts.join(' ').replace(/\s+/g, ' ').trim()
    if (cue && x) lines.push({ t: cue.t, x })
    cue = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const match = CUE.exec(line)
    if (match) {
      flush()
      const t = toSeconds(match[1])
      if (t !== null) cue = { t, parts: [] }
    } else if (!line) {
      flush()
    } else if (cue) {
      cue.parts.push(line.replace(TAGS, ''))
    }
  }
  flush()
  if (lines.length > 0) return lines

  // Sin marcas de tiempo: texto plano.
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(WEBVTT|NOTE|\d+)$/.test(l))
    .map((x) => ({ t: 0, x }))
}

// Sin tildes ni mayúsculas, para buscar.
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Texto para el asistente: cada línea con su minuto, hasta `maxChars` (las lecciones largas se
// recortan por el final, no por en medio).
export function transcriptText(lines: TranscriptLine[], maxChars = 24_000) {
  const hasTime = lines.some((l) => l.t > 0)
  let out = ''
  for (const l of lines) {
    const next = hasTime ? `[${clock(l.t)}] ${l.x}\n` : `${l.x}\n`
    if (out.length + next.length > maxChars) break
    out += next
  }
  return out.trim()
}
