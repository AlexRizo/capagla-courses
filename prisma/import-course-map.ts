import 'dotenv/config'

import { readFileSync } from 'node:fs'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { checkCoverage, courseTreeFromMap } from './course-map'
import type { MapEntry } from './course-map'
import { createItems } from './course-tree'
import type { SeedItem } from './course-tree'

// Rearma el curso con el mapa de videos (`prisma/data/mapa-videos.json`): una lección por video,
// con su tema como nombre y su video de Bunny ya asignado, en el orden del mapa. REEMPLAZA el
// árbol del curso (como `db:import-course`).
// Uso: pnpm db:import-course-map [--dry] [--force]
//   --dry    solo muestra el árbol y las comprobaciones, sin tocar la base.
//   --force  reemplaza aunque haya avance de alumnas, momentos, preguntas o transcripciones
//            (se borrarían junto con sus lecciones).
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')

const index = JSON.parse(
  readFileSync('prisma/data/curso-principal.json', 'utf8'),
)
const map = JSON.parse(
  readFileSync('prisma/data/mapa-videos.json', 'utf8'),
) as MapEntry[]
const tree = courseTreeFromMap(index, map)

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function print(items: SeedItem[], depth = 0) {
  for (const i of items) {
    const pad = '  '.repeat(depth)
    if (i.kind === 'LESSON') {
      const tag = i.bunnyVideoId ? '▶' : i.lessonType === 'TEXT' ? '¶' : '·'
      console.log(
        `${pad}${tag} ${i.title}${i.durationSec ? `  (${clock(i.durationSec)})` : ''}`,
      )
    } else {
      console.log(`${pad}${i.kind === 'BLOCK' ? '■' : '▸'} ${i.title}`)
      print(i.children ?? [], depth + 1)
    }
  }
}

print(tree)
const cover = checkCoverage(tree, map)
console.log(
  `\n${cover.lessons} lecciones (${cover.videoLessons} con video, ▶ video · ¶ texto) · ` +
    `videos sin lección: ${cover.missing.length} · videos en más de una lección: ${cover.shared.length}`,
)
if (cover.missing.length)
  throw new Error('Quedaron videos del mapa sin lección.')
if (dry) {
  console.log('\n(--dry: no se tocó la base)')
  process.exit(0)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const course = await prisma.product.findUniqueOrThrow({
  where: { slug: index.curso.id },
})

const [progress, moments, questions, transcripts] = await Promise.all([
  prisma.lessonProgress.count({ where: { item: { productId: course.id } } }),
  prisma.lessonMoment.count({ where: { item: { productId: course.id } } }),
  prisma.lessonQuestion.count({ where: { item: { productId: course.id } } }),
  prisma.lessonTranscript.count({ where: { item: { productId: course.id } } }),
])
if (progress + moments + questions + transcripts > 0 && !force) {
  throw new Error(
    `Reemplazar el árbol borraría avance (${progress}), momentos (${moments}), preguntas (${questions}) y transcripciones (${transcripts}). Usa --force si es lo que quieres.`,
  )
}

await prisma.$transaction(
  async (tx) => {
    // Lo que ya se decidió en el panel se conserva: los bloques gratis (por nombre).
    const free = new Set(
      (
        await tx.courseItem.findMany({
          where: { productId: course.id, kind: 'BLOCK', isFree: true },
          select: { title: true },
        })
      ).map((b) => b.title),
    )
    await tx.courseItem.deleteMany({ where: { productId: course.id } })
    await createItems(
      tx,
      course.id,
      tree.map((b) => ({ ...b, isFree: free.has(b.title) })),
      null,
    )
  },
  { timeout: 60_000 },
)
console.log(`\n✅ ${course.slug}: curso rearmado con el mapa de videos.`)
await prisma.$disconnect()
