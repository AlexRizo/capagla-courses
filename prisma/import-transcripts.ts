import 'dotenv/config'

import { readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { fold, parseTranscript } from '../src/lib/transcript'

// Carga las transcripciones de las lecciones desde una carpeta de archivos .vtt, .srt o .txt
// (los subtítulos de Bunny, o texto plano). Cada archivo se asigna a una lección por su nombre
// (sin la extensión), en este orden: id de la lección, GUID del video de Bunny, "Capítulo -
// Lección" o el título de la lección (sin tildes ni mayúsculas). Lo que no se asigna con
// claridad (nombre repetido o desconocido) no se carga y se lista al final.
// Uso: pnpm db:import-transcripts <carpeta> [--dry]   (--dry solo muestra qué haría)
const dir = process.argv[2]
const dry = process.argv.includes('--dry')
if (!dir) throw new Error('Uso: pnpm db:import-transcripts <carpeta> [--dry]')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const key = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

async function main() {
  const lessons = await prisma.courseItem.findMany({
    where: { kind: 'LESSON' },
    include: { parent: { select: { kind: true, title: true } } },
  })
  const byKey = new Map<string, string[]>()
  const add = (k: string, id: string) =>
    byKey.set(key(k), [...(byKey.get(key(k)) ?? []), id])
  for (const l of lessons) {
    add(l.id, l.id)
    if (l.bunnyVideoId) add(l.bunnyVideoId, l.id)
    add(l.title, l.id)
    if (l.parent?.kind === 'CHAPTER') add(`${l.parent.title} ${l.title}`, l.id)
  }

  const files = readdirSync(dir).filter((f) =>
    ['.vtt', '.srt', '.txt'].includes(extname(f).toLowerCase()),
  )
  const loaded: string[] = []
  const skipped: string[] = []
  for (const file of files) {
    const name = basename(file, extname(file))
    const ids = [...new Set(byKey.get(key(name)) ?? [])]
    if (ids.length !== 1) {
      skipped.push(
        `${file} (${ids.length ? 'coincide con varias' : 'sin lección'})`,
      )
      continue
    }
    const lines = parseTranscript(readFileSync(join(dir, file), 'utf8'))
    if (lines.length === 0) {
      skipped.push(`${file} (vacío)`)
      continue
    }
    if (!dry) {
      await prisma.lessonTranscript.upsert({
        where: { itemId: ids[0] },
        create: { itemId: ids[0], lines },
        update: { lines },
      })
    }
    loaded.push(`${file} → ${lines.length} líneas`)
  }
  console.log(`${dry ? 'Cargaría' : 'Cargadas'}: ${loaded.length}`)
  for (const l of loaded) console.log(`  ${l}`)
  if (skipped.length) {
    console.log(`Sin cargar: ${skipped.length}`)
    for (const s of skipped) console.log(`  ${s}`)
  }
}

main().finally(() => prisma.$disconnect())
