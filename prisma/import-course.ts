import 'dotenv/config'
import { readFileSync } from 'node:fs'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { courseTreeFromIndex, createItems } from './course-tree'
import type { SeedItem } from './course-tree'

// Carga el índice del curso (`prisma/data/curso-principal.json`) en la base y REEMPLAZA el árbol
// del curso (bloques, capítulos y lecciones, con sus notas, recursos y avances).
// Uso: pnpm db:import-course [ruta del json]
const file = process.argv[2] ?? 'prisma/data/curso-principal.json'
const index = JSON.parse(readFileSync(file, 'utf8'))
const tree = courseTreeFromIndex(index)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const count = (items: SeedItem[]): Record<SeedItem['kind'], number> =>
  items.reduce(
    (acc, i) => {
      acc[i.kind]++
      for (const k of Object.entries(count(i.children ?? []))) {
        acc[k[0] as SeedItem['kind']] += k[1]
      }
      return acc
    },
    { BLOCK: 0, CHAPTER: 0, LESSON: 0 },
  )

const course = await prisma.product.findUniqueOrThrow({
  where: { slug: index.curso.id },
})

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

const n = count(tree)
console.log(
  `✅ ${course.slug}: ${n.BLOCK} bloques, ${n.CHAPTER} capítulos, ${n.LESSON} lecciones`,
)
await prisma.$disconnect()
