// Duración de un video como "m:ss" (o "h:mm:ss") y en segundos.
export function formatDuration(sec: number | null) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// Devuelve los segundos, o null si el texto no tiene el formato.
export function parseDuration(text: string) {
  const match = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/.exec(text.trim())
  if (!match) return null
  const [, h, m, s] = match
  return (h ? Number(h) : 0) * 3600 + Number(m) * 60 + Number(s)
}

// "Partes del video": una por línea, "minuto título" (ej. "2:10 Derretir el chocolate").
// Se valida al guardar; las líneas vacías se ignoran.
export function normalizeParts(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const valid = lines.every((l) => {
    const [time = '', ...title] = l.split(/\s+/)
    return parseDuration(time) !== null && title.join(' ').length > 0
  })
  return valid && lines.length <= 100 ? lines.join('\n') : null
}

export type VideoPart = { seconds: number; title: string }

// Las partes guardadas ("2:10 Mezcla" por línea) como lista ordenada por minuto.
export function parseParts(text: string | null): VideoPart[] {
  if (!text) return []
  return text
    .split('\n')
    .flatMap((line) => {
      const [time = '', ...title] = line.trim().split(/\s+/)
      const seconds = parseDuration(time)
      return seconds === null || title.length === 0
        ? []
        : [{ seconds, title: title.join(' ') }]
    })
    .sort((a, b) => a.seconds - b.seconds)
}

// La parte en la que va el video: la última que ya empezó.
export function partAt(parts: VideoPart[], seconds: number) {
  return parts.filter((p) => p.seconds <= seconds).at(-1)
}

// Minuto de reproducción como "7:12" (o "1:02:03"); acepta decimales y los trunca.
export function clock(sec: number) {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
