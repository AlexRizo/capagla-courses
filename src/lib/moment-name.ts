import { parseParts, partAt } from '#/lib/duration'
import type { TranscriptLine } from '#/lib/transcript'

// Nombre automático de un momento guardado: la parte del video en la que va (capítulos
// automáticos o escritos por la chef) y, si la lección no tiene partes, las primeras palabras de
// lo que se dice en ese segundo según la transcripción. Sin ninguna de las dos, "Momento".
// La alumna lo puede cambiar después.
const MAX_WORDS = 6
const MAX_CHARS = 40
// Palabras que no pueden cerrar un nombre cortado a la mitad de la frase ("…hacer nuestra").
const DANGLING = new Set(
  'a al con de del e el en es la las lo los me mi muy nos nuestra nuestras nuestro nuestros o para por que se si su sus te un una y ya'.split(
    ' ',
  ),
)
const EDGE = /^[\s¿?¡!"“”«»'.,;:…\-–—()]+|[\s¿?¡!"“”«»'.,;:…\-–—()]+$/g

export function momentName(
  videoParts: string | null,
  lines: TranscriptLine[],
  seconds: number,
) {
  const part = partAt(parseParts(videoParts), seconds)
  if (part) return part.title

  // Sin minutos (texto plano) no se sabe qué se dice en ese segundo.
  if (!lines.some((l) => l.t > 0)) return 'Momento'
  const line = lines
    .filter((l) => l.t <= seconds)
    .reduce<TranscriptLine | null>((a, l) => (!a || l.t >= a.t ? l : a), null)
  if (!line) return 'Momento'

  const words = line.x.replace(EDGE, '').split(/\s+/).slice(0, MAX_WORDS)
  // Si todo son enlaces se deja como está.
  while (
    words.length > 1 &&
    DANGLING.has(words.at(-1)!.replace(EDGE, '').toLowerCase())
  ) {
    words.pop()
  }
  let text = ''
  for (const word of words) {
    if (`${text} ${word}`.trim().length > MAX_CHARS) break
    text = `${text} ${word}`.trim()
  }
  text = text.replace(EDGE, '')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Momento'
}
