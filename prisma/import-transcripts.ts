import 'dotenv/config'

import { existsSync, readFileSync } from 'node:fs'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import type { VideoName } from './transcript-plan'
import { loadTranscripts } from './transcripts-load'

// Carga las transcripciones de las lecciones desde una carpeta de archivos .vtt, .srt o .txt
// (los subtítulos de Bunny, texto plano o los archivos del cliente). La asignación a lecciones
// la decide `transcript-plan.ts`: por el nombre de Vimeo del mapa de videos (a todas las
// lecciones que usan ese video) o por id, GUID, título o "Capítulo Lección". Lo que no se
// asigna con claridad no se carga y se lista al final, igual que las lecciones con video que
// se quedan sin transcripción. Cargar **después** de rearmar el curso con el mapa.
// Uso: pnpm db:import-transcripts <carpeta> [--dry]   (--dry solo muestra qué haría)
const MAP = 'prisma/data/mapa-videos.json'
const dir = process.argv[2]
const dry = process.argv.includes('--dry')
if (!dir) throw new Error('Uso: pnpm db:import-transcripts <carpeta> [--dry]')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  const videos: VideoName[] = existsSync(MAP)
    ? JSON.parse(readFileSync(MAP, 'utf8'))
    : []
  const { loaded, skipped, withoutTranscript } = await loadTranscripts(
    prisma,
    dir,
    videos,
    { dry },
  )
  console.log(`${dry ? 'Cargaría' : 'Cargadas'}: ${loaded.length}`)
  for (const l of loaded) console.log(`  ${l}`)
  if (skipped.length) {
    console.log(`Sin cargar: ${skipped.length}`)
    for (const s of skipped) console.log(`  ${s}`)
  }
  if (withoutTranscript.length) {
    console.log(
      `Lecciones con video y sin transcripción: ${withoutTranscript.length}`,
    )
    for (const t of withoutTranscript) console.log(`  ${t}`)
  }
}

main().finally(() => prisma.$disconnect())
