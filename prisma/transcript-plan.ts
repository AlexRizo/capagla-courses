import { fold } from '../src/lib/transcript'

// A qué lecciones va cada archivo de transcripción. Es lo que decide `pnpm db:import-transcripts`
// (sin tocar la base: aquí solo se planea, y por eso se puede probar).
//
// Orden para reconocer un archivo por su nombre (sin la extensión):
//  1. Nombre de Vimeo del mapa de videos (`vimeo_nombre`, los archivos del cliente) → su video de
//     Bunny → **todas** las lecciones que lo usan (un video puede estar en varias recetas).
//  2. Id de la lección, GUID del video de Bunny, título de la lección o "Capítulo Lección"
//     (sin tildes ni mayúsculas): solo si es una única lección.
// Lo que no se reconoce con claridad no se carga y se lista con su motivo.

export type PlanLesson = {
  id: string
  title: string
  bunnyVideoId: string | null
  parent?: { kind: string; title: string } | null
}

export type VideoName = { vimeo_nombre: string; bunny_guid: string }

// Transcripciones que NO se cargan (clave: nombre en minúsculas → motivo). Hoy ninguna: la de
// `06-01_BROWNIE_INTRODUCCION` dura 54 s y su video de Bunny (`00-01`) 19 s, y por decisión del
// usuario (2026-10-20) se carga igual. Ver "TRANSCRIPCIONES" en la bitácora.
export const HELD_BACK: Record<string, string> = {}

const key = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function planTranscripts(
  names: string[],
  lessons: PlanLesson[],
  videos: VideoName[],
  held: Record<string, string> = HELD_BACK,
) {
  const byKey = new Map<string, string[]>()
  const add = (k: string, id: string) =>
    byKey.set(key(k), [...(byKey.get(key(k)) ?? []), id])
  for (const l of lessons) {
    add(l.id, l.id)
    if (l.bunnyVideoId) add(l.bunnyVideoId, l.id)
    add(l.title, l.id)
    if (l.parent?.kind === 'CHAPTER') add(`${l.parent.title} ${l.title}`, l.id)
  }
  const guidByVimeo = new Map(
    videos.map((v) => [v.vimeo_nombre.toLowerCase(), v.bunny_guid]),
  )

  const assigned: { name: string; lessonIds: string[] }[] = []
  const skipped: { name: string; reason: string }[] = []
  for (const name of names) {
    const reason = held[name.toLowerCase()]
    if (reason) {
      skipped.push({ name, reason })
      continue
    }
    const guid = guidByVimeo.get(name.toLowerCase())
    if (guid) {
      const ids = lessons
        .filter((l) => l.bunnyVideoId === guid)
        .map((l) => l.id)
      if (ids.length) assigned.push({ name, lessonIds: ids })
      else skipped.push({ name, reason: 'su video no está en ninguna lección' })
      continue
    }
    const ids = [...new Set(byKey.get(key(name)) ?? [])]
    if (ids.length === 1) assigned.push({ name, lessonIds: ids })
    else {
      skipped.push({
        name,
        reason: ids.length ? 'coincide con varias lecciones' : 'sin lección',
      })
    }
  }

  const covered = new Set(assigned.flatMap((a) => a.lessonIds))
  // Lecciones con video a las que el asistente no tendrá qué leer.
  const withoutTranscript = lessons.filter(
    (l) => l.bunnyVideoId && !covered.has(l.id),
  )
  return { assigned, skipped, withoutTranscript }
}
