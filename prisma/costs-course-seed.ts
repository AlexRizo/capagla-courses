import { existsSync, readFileSync } from 'node:fs'

import type { PrismaClient } from '@prisma/client'

import { createItems } from './course-tree'
import type { SeedItem } from './course-tree'

// Árbol del curso de costos (`prisma/data/curso-costos.json`): 3 bloques y 8 lecciones de video,
// con el video de Bunny y la duración de cada una (los mismos del curso armado en desarrollo).
// Los videos ya están en la biblioteca de Bunny; el seed solo guarda sus identificadores, nunca
// sube nada. Idempotente como el del curso principal: si el curso ya tiene lecciones no se toca
// (no pisa lo editado en el panel). Las transcripciones las carga `seedTranscripts`.
export async function seedCostsCourseTree(
  prisma: PrismaClient,
  file = new URL('./data/curso-costos.json', import.meta.url),
) {
  const course = await prisma.product.findUnique({
    where: { slug: 'calcular-costos' },
  })
  if (!course) return
  if ((await prisma.courseItem.count({ where: { productId: course.id } })) > 0)
    return
  if (!existsSync(file)) {
    console.log(
      '⚠️ sin prisma/data/curso-costos.json: curso de costos sin árbol',
    )
    return
  }
  const tree = JSON.parse(readFileSync(file, 'utf8')) as SeedItem[]
  await createItems(prisma, course.id, tree, null)
  console.log('✅ árbol de calcular-costos')
}
