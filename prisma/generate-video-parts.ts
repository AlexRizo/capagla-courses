import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { anthropicTextModel } from '../src/lib/assistant-model'
import { estimateCostUsd } from '../src/lib/assistant-limits'
import { formatDuration } from '../src/lib/duration'
import type { TranscriptLine } from '../src/lib/transcript'
import {
  MIN_SECONDS_FOR_PARTS,
  partsPrompt,
  readGeneratedParts,
} from '../src/lib/video-parts'

// Capítulos automáticos: genera las "Partes del video" de cada lección a partir de su
// transcripción con Claude Haiku 5.5 (unos centavos en total). Solo toca lecciones con
// transcripción con minutos y **sin partes escritas** (lo que la chef escribió a mano no se
// pisa) y videos de al menos 2 minutos; con --force reemplaza también las que ya tienen.
// Cargar las transcripciones antes (`pnpm db:import-transcripts`). Con --dry no guarda nada y
// muestra lo que guardaría. Usa la base de DATABASE_URL: para producción, correrlo con la de
// Railway. La clave sale del .env y nunca se imprime.
// Uso: pnpm db:generate-video-parts [--dry] [--force]
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY en el .env.')
const model = anthropicTextModel({
  apiKey,
  workspaceId: process.env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined,
})

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  const lessons = await prisma.courseItem.findMany({
    where: {
      kind: 'LESSON',
      transcript: { isNot: null },
      ...(force ? {} : { OR: [{ videoParts: null }, { videoParts: '' }] }),
    },
    include: { transcript: true },
    orderBy: [{ productId: 'asc' }, { position: 'asc' }],
  })

  const spent = { input: 0, output: 0 }
  // Las lecciones que comparten video comparten capítulos: una sola llamada por video.
  const byVideo = new Map<string, string | null>()
  let saved = 0
  const skipped: string[] = []

  for (const lesson of lessons) {
    const lines = (lesson.transcript?.lines ?? []) as TranscriptLine[]
    const end = Math.max(0, ...lines.map((l) => l.t))
    const duration = lesson.durationSec ?? end
    if (end === 0) {
      skipped.push(`${lesson.title}: la transcripción no tiene minutos`)
      continue
    }
    if (duration < MIN_SECONDS_FOR_PARTS) {
      skipped.push(
        `${lesson.title}: dura ${formatDuration(duration)}, no lleva capítulos`,
      )
      continue
    }

    const key = lesson.bunnyVideoId ?? lesson.id
    if (!byVideo.has(key)) {
      const { system, user } = partsPrompt(lesson.title, duration, lines)
      let parts: string | null = null
      try {
        const answer = await model({
          system,
          user,
          maxTokens: 600,
          onUsage: (u) => {
            spent.input += u.input
            spent.output += u.output
          },
        })
        parts = readGeneratedParts(answer, lines, duration)
      } catch {
        // El modelo ya registró el motivo; la lección se lista abajo.
      }
      byVideo.set(key, parts)
    }

    const parts = byVideo.get(key)
    if (!parts) {
      skipped.push(`${lesson.title}: el modelo no dio capítulos válidos`)
      continue
    }
    console.log(`\n${lesson.title} (${formatDuration(duration)})\n${parts}`)
    if (!dry) {
      await prisma.courseItem.update({
        where: { id: lesson.id },
        data: { videoParts: parts },
      })
    }
    saved++
  }

  console.log(
    `\n${dry ? 'Guardaría' : 'Guardadas'}: ${saved} lección(es) de ${lessons.length} sin partes.`,
  )
  if (skipped.length) {
    console.log(`Sin capítulos: ${skipped.length}`)
    for (const s of skipped) console.log(`  ${s}`)
  }
  console.log(
    `Tokens: ${spent.input} de entrada y ${spent.output} de salida (≈ $${estimateCostUsd(spent.input, spent.output).toFixed(4)}).`,
  )
}

main().finally(() => prisma.$disconnect())
