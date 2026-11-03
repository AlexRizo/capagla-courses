import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { PrismaClient } from '@prisma/client'

import type { VideoName } from './transcript-plan'
import { loadTranscripts } from './transcripts-load'

// Transcripciones de los dos cursos que ya existen. Corre en cada seed y con
// `pnpm db:seed-transcripts`; es idempotente y **no pisa** lo que ya esté cargado (solo rellena las
// lecciones sin transcripción; para reemplazar a propósito: `pnpm db:import-transcripts`).
// Los cursos nuevos se suben a mano.
//  - postres-navidad: `prisma/data/transcripciones` (.vtt con minutos), por el nombre de Vimeo del
//    mapa de videos.
//  - calcular-costos: `prisma/data/transcripciones-costos` (.txt sin minutos, el guion), por el
//    título de la lección. El curso se arma a mano en el panel: si aún no tiene las lecciones, no
//    pasa nada, se vuelve a correr cuando estén.
const COURSES = [
  { slug: 'postres-navidad', dir: './data/transcripciones', useMap: true },
  {
    slug: 'calcular-costos',
    dir: './data/transcripciones-costos',
    useMap: false,
  },
]

export async function seedTranscripts(prisma: PrismaClient) {
  const mapFile = new URL('./data/mapa-videos.json', import.meta.url)
  const map: VideoName[] = existsSync(mapFile)
    ? JSON.parse(readFileSync(mapFile, 'utf8'))
    : []
  for (const { slug, dir, useMap } of COURSES) {
    const folder = fileURLToPath(new URL(dir, import.meta.url))
    if (!existsSync(folder)) continue
    const { loaded, skipped } = await loadTranscripts(
      prisma,
      folder,
      useMap ? map : [],
      { productSlug: slug, keepExisting: true },
    )
    console.log(
      `✅ transcripciones de ${slug}: ${loaded.length} cargadas, ${skipped.length} sin cargar`,
    )
    for (const s of skipped) console.log(`   · ${s}`)
  }
}
