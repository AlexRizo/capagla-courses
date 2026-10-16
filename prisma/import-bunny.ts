import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Asigna a cada lección el video de Bunny que le corresponde (y su duración real) leyendo la
// biblioteca. Solo las correspondencias claras, de una lección con un video: el resto se
// lista al final para decidirlo (lecciones con varios videos, y la introducción).
// Uso: pnpm db:import-bunny   (necesita BUNNY_LIBRARY_ID y BUNNY_API_KEY)
const COURSE = 'postres-navidad'

// Prefijo del nombre del archivo ("06-03-1_brownie…") → [capítulo o bloque, lección].
const MAP: Record<string, [string, string]> = {
  '01-01': ['Enjambre de chocolate', 'Preparación'],
  '01-02': ['Enjambre de chocolate', 'Resultado'],
  '02-01': ['Turrón de chocolate', 'Preparación'],
  '02-02': ['Turrón de chocolate', 'Resultado'],
  '03-01': ['Cupcake', 'Procedimiento'],
  '03-04': ['Cupcake', 'Chantilly artesanal'],
  '04-01-01': ['Lunch Box Cake', 'Ingredientes'],
  '04-01-02': ['Lunch Box Cake', 'Jarabe'],
  '04-01-03': ['Lunch Box Cake', 'Betún de mantequilla'],
  '04-02': ['Lunch Box Cake', 'Desmoldar panes'],
  '05-01': ['Blondie', 'Preparación'],
  '05-02': ['Blondie', 'Decoración'],
  '06-01': ['Brownie de cheesecake', 'Intro'],
  '06-02': ['Brownie de cheesecake', 'Materiales'],
  '06-03': ['Brownie de cheesecake', 'Utensilios'],
  '06-03-1': ['Brownie de cheesecake', 'Preparación'],
  '06-04': ['Brownie de cheesecake', 'Ingredientes'],
  '06-06': ['Brownie de cheesecake', 'Base'],
  '06-07': ['Brownie de cheesecake', 'Capa de cheesecake'],
  '06-09': ['Brownie de cheesecake', 'Final'],
  '07-01': ['Roles de canela', 'Intro'],
  '07-02': ['Roles de canela', 'Ingredientes'],
  '07-03': ['Roles de canela', 'Procedimiento'],
  '07-06': ['Roles de canela', 'Final'],
  '08-01': ['Galleta Red Velvet', 'Masa'],
  '08-02': ['Galleta Red Velvet', 'Relleno'],
  '08-03': ['Galleta Red Velvet', 'Horneado'],
  '09-01': ['Galleta de jengibre', 'Masa'],
  '09-02': ['Galleta de jengibre', 'Corte'],
  '09-04': ['Galleta de jengibre', 'Decorado (28 min)'],
  '10-01': ['Galleta de mantequilla', 'Masa'],
  '10-02': ['Galleta de mantequilla', 'Explicación'],
  '10-03': ['Galleta de mantequilla', 'Horneado'],
  '10-04': ['Galleta de mantequilla', 'Decorado con royal icing (46 min)'],
  '11-01': ['Alfajores', 'Preparación'],
  '11-02': ['Alfajores', 'Horneado'],
  '11-03': ['Alfajores', 'Decorado'],
  '12-01': ['Despedida', 'Despedida'],
}

const library = process.env.BUNNY_LIBRARY_ID
const key = process.env.BUNNY_API_KEY
if (!library || !key)
  throw new Error('Faltan BUNNY_LIBRARY_ID y BUNNY_API_KEY.')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

type Video = { guid: string; title: string; length: number; status: number }

async function allVideos() {
  const videos: Video[] = []
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${library}/videos?page=${page}&itemsPerPage=100&orderBy=title`,
      { headers: { AccessKey: key!, accept: 'application/json' } },
    )
    if (!response.ok) throw new Error(`Bunny respondió ${response.status}.`)
    const body = (await response.json()) as {
      items: Video[]
      totalItems: number
    }
    videos.push(...body.items)
    if (videos.length >= body.totalItems || body.items.length === 0) break
  }
  return videos
}

const prefixOf = (title: string) =>
  /^(\d+(?:-\d+)*)(?:_|-[a-z])/.exec(title)?.[1]

const course = await prisma.product.findUniqueOrThrow({
  where: { slug: COURSE },
})
const lessons = await prisma.courseItem.findMany({
  where: { productId: course.id, kind: 'LESSON' },
  include: { parent: true },
})

const videos = await allVideos()
const used = new Set<string>()
const pending: string[] = []
let assigned = 0

for (const video of videos) {
  const prefix = prefixOf(video.title)
  const target = prefix ? MAP[prefix] : undefined
  if (!target) {
    pending.push(`${video.title} (${Math.round(video.length)} s)`)
    continue
  }
  const matches = lessons.filter(
    (l) => l.title === target[1] && l.parent?.title === target[0],
  )
  if (matches.length !== 1 || video.status !== 4) {
    pending.push(
      `${video.title}: ${matches.length !== 1 ? `${matches.length} lecciones "${target.join(' › ')}"` : 'aún no está terminado'}`,
    )
    continue
  }
  await prisma.courseItem.update({
    where: { id: matches[0].id },
    data: {
      bunnyVideoId: video.guid,
      durationSec: Math.round(video.length),
    },
  })
  used.add(matches[0].id)
  assigned++
}

console.log(
  `Videos en Bunny: ${videos.length}. Asignados a una lección: ${assigned}.`,
)
console.log(`Sin lección asignada (${pending.length}):`)
for (const line of pending) console.log(`  - ${line}`)
const without = lessons.filter(
  (l) => l.lessonType === 'VIDEO' && !used.has(l.id),
)
console.log(`Lecciones de video sin video (${without.length}):`)
for (const l of without) console.log(`  - ${l.parent?.title} › ${l.title}`)
await prisma.$disconnect()
