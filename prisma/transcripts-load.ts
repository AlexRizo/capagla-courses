import { readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

import type { PrismaClient } from '@prisma/client'

import { parseTranscript } from '../src/lib/transcript'
import { planTranscripts } from './transcript-plan'
import type { VideoName } from './transcript-plan'

// Carga a la base las transcripciones de una carpeta de archivos .vtt, .srt o .txt. La
// asignación a lecciones la decide `transcript-plan.ts`. Lo usan `pnpm db:import-transcripts`
// y el seed. Con `dry` solo dice qué haría.
export async function loadTranscripts(
  prisma: PrismaClient,
  dir: string,
  videos: VideoName[],
  { dry = false } = {},
) {
  const lessons = await prisma.courseItem.findMany({
    where: { kind: 'LESSON' },
    include: { parent: { select: { kind: true, title: true } } },
  })
  const files = new Map(
    readdirSync(dir)
      .filter((f) =>
        ['.vtt', '.srt', '.txt'].includes(extname(f).toLowerCase()),
      )
      .map((f) => [basename(f, extname(f)), f]),
  )
  const plan = planTranscripts([...files.keys()], lessons, videos)

  const loaded: string[] = []
  const skipped = plan.skipped.map((s) => `${files.get(s.name)} (${s.reason})`)
  for (const { name, lessonIds } of plan.assigned) {
    const file = files.get(name)!
    const lines = parseTranscript(readFileSync(join(dir, file), 'utf8'))
    if (lines.length === 0) {
      skipped.push(`${file} (vacío)`)
      continue
    }
    if (!dry) {
      for (const itemId of lessonIds) {
        await prisma.lessonTranscript.upsert({
          where: { itemId },
          create: { itemId, lines },
          update: { lines },
        })
      }
    }
    loaded.push(
      `${file} → ${lines.length} líneas, ${lessonIds.length} lección(es)`,
    )
  }
  return {
    loaded,
    skipped,
    withoutTranscript: plan.withoutTranscript.map((l) => l.title),
  }
}
