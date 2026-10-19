import type { SeedItem } from './course-tree'

// Árbol del curso a partir del mapa de videos (`data/mapa-videos.json`, entregado por el cliente):
// una entrada por video con su receta, su tema y su video de Bunny, en el orden correcto del
// curso. Cada video es una lección con el nombre de su tema y su video ya asignado; la estructura
// (bloques y recetas) sale del índice del curso (`data/curso-principal.json`).
//
// Las "unidades" del curso se numeran en el mismo orden que los archivos `.md` del mapa
// (`01-…md` … `19-…md`): las lecciones de Introducción (1 a 7), las recetas (8 a 18) y la
// despedida (19). Una unidad sin ningún video del mapa es una lección de texto.

export type MapEntry = {
  leccion: string
  tema: string | null
  md: string
  bunny_guid: string
  bunny_titulo: string
  duracion_seg: number
}

type Index = {
  modulos: {
    orden: number
    titulo: string
    lecciones?: { orden: number; titulo: string }[]
    recetas?: { orden: number; titulo: string; leccion_receta_texto: boolean }[]
  }[]
}

const byOrder = <T extends { orden: number }>(items: T[]) =>
  [...items].sort((a, b) => a.orden - b.orden)

// "INTRODUCCIÓN Y CONSEJOS BÁSICOS" → "Introducción y consejos básicos".
const sentence = (s: string) => {
  const lower = s.trim().toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// Los videos del mapa sin tema (los de la introducción) toman el nombre de su archivo.
const TITLE_BY_FILE: Record<string, string> = {
  '00-02': 'Materiales básicos',
  '00-03': 'Utensilios',
}

const videoLesson = (e: MapEntry): SeedItem => ({
  kind: 'LESSON',
  title:
    e.tema?.trim() ||
    TITLE_BY_FILE[e.bunny_titulo.slice(0, 5)] ||
    sentence(e.leccion),
  lessonType: 'VIDEO',
  durationSec: e.duracion_seg,
  bunnyVideoId: e.bunny_guid,
})

const unitOf = (md: string) => Number(md.slice(0, 2))

export function courseTreeFromMap(index: Index, map: MapEntry[]): SeedItem[] {
  const byUnit = new Map<number, MapEntry[]>()
  for (const entry of map) {
    const unit = unitOf(entry.md)
    byUnit.set(unit, [...(byUnit.get(unit) ?? []), entry])
  }

  let unit = 0
  return byOrder(index.modulos).map((m) => {
    const children: SeedItem[] = []

    for (const l of byOrder(m.lecciones ?? [])) {
      const entries = byUnit.get(++unit) ?? []
      if (entries.length === 0) {
        // Sin video en el mapa: lección de texto.
        children.push({ kind: 'LESSON', title: l.titulo, lessonType: 'TEXT' })
      } else if (entries.length === 1) {
        children.push({
          ...videoLesson(entries[0]),
          title: sentence(entries[0].leccion),
        })
      } else {
        // Varios videos bajo un mismo nombre (Utensilios básicos): un capítulo con una lección
        // por video.
        children.push({
          kind: 'CHAPTER',
          title: sentence(entries[0].leccion),
          children: entries.map(videoLesson),
        })
      }
    }

    for (const r of byOrder(m.recetas ?? [])) {
      const entries = byUnit.get(++unit) ?? []
      children.push({
        kind: 'CHAPTER',
        title: r.titulo,
        children: [
          ...(r.leccion_receta_texto
            ? [
                {
                  kind: 'LESSON' as const,
                  title: 'Receta',
                  lessonType: 'TEXT' as const,
                },
              ]
            : []),
          ...entries.map(videoLesson),
        ],
      })
    }
    return { kind: 'BLOCK', title: m.titulo, children }
  })
}

const flatten = (items: SeedItem[]): SeedItem[] =>
  items.flatMap((i) => [i, ...flatten(i.children ?? [])])

// Comprobaciones del árbol contra el mapa: qué videos no quedaron en ninguna lección y cuáles
// están en más de una (varias recetas comparten algunos).
export function checkCoverage(tree: SeedItem[], map: MapEntry[]) {
  const used = new Map<string, number>()
  for (const item of flatten(tree)) {
    if (item.bunnyVideoId) {
      used.set(item.bunnyVideoId, (used.get(item.bunnyVideoId) ?? 0) + 1)
    }
  }
  const all = new Set(map.map((e) => e.bunny_guid))
  return {
    missing: [...all].filter((id) => !used.has(id)),
    shared: [...used].filter(([, n]) => n > 1).map(([id]) => id),
    videoLessons: flatten(tree).filter((i) => i.bunnyVideoId).length,
    lessons: flatten(tree).filter((i) => i.kind === 'LESSON').length,
  }
}
