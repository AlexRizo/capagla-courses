// Árbol del curso tal como lo ve la alumna en el reproductor (sin base de datos).
// Bloque > Capítulo > Lección, o Bloque > Lección. Solo cuenta lo que existe en el árbol:
// las lecciones sueltas fuera de un bloque no se muestran.

type Item = {
  id: string
  parentId: string | null
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON'
  isFree: boolean
  position: number
  title: string
  lessonType: 'VIDEO' | 'TEXT' | null
  durationSec: number | null
}

export type LessonNode = {
  type: 'lesson'
  id: string
  title: string
  // A la derecha del título: "Texto" o la duración ("17:44"); vacío si no hay.
  meta: string
  seen: boolean
}

export type ChapterNode = {
  type: 'chapter'
  id: string
  title: string
  seenCount: number
  lessons: LessonNode[]
}

export type BlockNode = {
  id: string
  title: string
  children: (LessonNode | ChapterNode)[]
}

export const minutes = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

// Solo los bloques gratis y lo que contienen: lo que ve quien aún no compró el curso.
export function onlyFreeBlocks<T extends Item>(items: T[]) {
  const byId = new Map(items.map((i) => [i.id, i]))
  const blockOf = (item: Item) => {
    let current: Item | undefined = item
    while (current && current.kind !== 'BLOCK') {
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return current
  }
  return items.filter((i) => blockOf(i)?.isFree)
}

export function buildPlayerTree(items: Item[], seen: Set<string>) {
  const byParent = new Map<string | null, Item[]>()
  for (const i of [...items].sort((a, b) => a.position - b.position)) {
    byParent.set(i.parentId, [...(byParent.get(i.parentId) ?? []), i])
  }
  const kids = (id: string | null) => byParent.get(id) ?? []

  const lesson = (i: Item): LessonNode => ({
    type: 'lesson',
    id: i.id,
    title: i.title,
    meta:
      i.lessonType === 'TEXT'
        ? 'Texto'
        : i.durationSec
          ? minutes(i.durationSec)
          : '',
    seen: seen.has(i.id),
  })

  const tree: BlockNode[] = kids(null)
    .filter((b) => b.kind === 'BLOCK')
    .map((b) => ({
      id: b.id,
      title: b.title,
      children: kids(b.id).flatMap((c): (LessonNode | ChapterNode)[] => {
        if (c.kind === 'LESSON') return [lesson(c)]
        if (c.kind !== 'CHAPTER') return []
        const lessons = kids(c.id)
          .filter((l) => l.kind === 'LESSON')
          .map(lesson)
        return [
          {
            type: 'chapter',
            id: c.id,
            title: c.title,
            seenCount: lessons.filter((l) => l.seen).length,
            lessons,
          },
        ]
      }),
    }))

  // Lecciones en orden de lectura.
  const order: {
    lesson: LessonNode
    blockId: string
    chapterId: string | null
  }[] = []
  for (const b of tree) {
    for (const c of b.children) {
      if (c.type === 'lesson') {
        order.push({ lesson: c, blockId: b.id, chapterId: null })
      } else {
        for (const l of c.lessons) {
          order.push({ lesson: l, blockId: b.id, chapterId: c.id })
        }
      }
    }
  }
  return { tree, order }
}

// Dónde retomar: la primera lección sin ver; si ya vio todas, la primera.
export function resumeLessonId(order: { lesson: LessonNode }[]) {
  return (order.find((o) => !o.lesson.seen) ?? order[0]).lesson.id
}

// "Lección 2 de 3": su lugar entre las lecciones de su capítulo (o de su bloque si no tiene).
export function lessonPosition(
  order: { lesson: LessonNode; blockId: string; chapterId: string | null }[],
  lessonId: string,
) {
  const index = order.findIndex((o) => o.lesson.id === lessonId)
  const current = order[index]
  const group = order.filter((o) =>
    current.chapterId
      ? o.chapterId === current.chapterId
      : o.blockId === current.blockId && o.chapterId === null,
  )
  return {
    index,
    inGroup: group.findIndex((o) => o.lesson.id === lessonId) + 1,
    groupTotal: group.length,
    previousId: order[index - 1]?.lesson.id ?? null,
    nextId: order[index + 1]?.lesson.id ?? null,
  }
}
