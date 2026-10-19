import type { PrismaClient } from '@prisma/client'

// Árbol del curso a partir del índice de contenido (`contenido/curso-principal.json`).
// Módulo → Bloque; receta → Capítulo; y sus lecciones: "Receta" (texto) si la receta lo trae
// y un video por cada tema. Lo que el índice no dice no se inventa: sin URL de video, sin
// duración por video (solo hay el total de la receta) y sin el texto de la receta.

export type SeedItem = {
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON'
  title: string
  isFree?: boolean
  lessonType?: 'VIDEO' | 'TEXT'
  durationSec?: number
  // Video de la biblioteca de Bunny (solo lecciones de video).
  bunnyVideoId?: string
  children?: SeedItem[]
}

type Index = {
  curso: { id: string }
  modulos: {
    orden: number
    titulo: string
    videos_cantidad?: number
    duracion_seg?: number
    lecciones?: { orden: number; titulo: string }[]
    recetas?: {
      orden: number
      titulo: string
      temas: string[]
      leccion_receta_texto: boolean
    }[]
  }[]
}

const byOrder = <T extends { orden: number }>(items: T[]) =>
  [...items].sort((a, b) => a.orden - b.orden)

export function courseTreeFromIndex(index: Index): SeedItem[] {
  return byOrder(index.modulos).map((m) => {
    const children: SeedItem[] = []
    const lessons = byOrder(m.lecciones ?? [])
    // Un módulo de un solo video (Despedida): la duración del módulo es la de su lección.
    const single = lessons.length === 1 && m.videos_cantidad === 1
    for (const l of lessons) {
      children.push({
        kind: 'LESSON',
        title: l.titulo,
        lessonType: 'VIDEO',
        durationSec: single ? m.duracion_seg : undefined,
      })
    }
    for (const r of byOrder(m.recetas ?? [])) {
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
          ...r.temas.map((tema) => ({
            kind: 'LESSON' as const,
            title: tema,
            lessonType: 'VIDEO' as const,
          })),
        ],
      })
    }
    return { kind: 'BLOCK', title: m.titulo, children }
  })
}

type Db = Pick<PrismaClient, 'courseItem'>

export async function createItems(
  db: Db,
  productId: string,
  items: SeedItem[],
  parentId: string | null,
) {
  for (const [position, { children, ...item }] of items.entries()) {
    const created = await db.courseItem.create({
      data: { ...item, productId, parentId, position, status: 'PUBLISHED' },
    })
    if (children) await createItems(db, productId, children, created.id)
  }
}
