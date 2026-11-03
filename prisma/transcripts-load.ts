import { readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

import type { PrismaClient } from '@prisma/client'

import { parseTranscript } from '../src/lib/transcript'
import { planTranscripts } from './transcript-plan'
import type { VideoName } from './transcript-plan'

// Carga a la base las transcripciones de una carpeta de archivos .vtt, .srt o .txt. La
// asignación a lecciones la decide `transcript-plan.ts`. Lo usan `pnpm db:import-transcripts`
// y el seed. Con `dry` solo dice qué haría. `productSlug` limita la asignación a las lecciones de
// un curso (un título como "Bienvenida" puede repetirse en otro). `keepExisting` no pisa las
// lecciones que ya tienen transcripción: solo rellena las que faltan.
export async function loadTranscripts(
  prisma: PrismaClient,
  dir: string,
  videos: VideoName[],
  {
    dry = false,
    productSlug,
    keepExisting = false,
  }: { dry?: boolean; productSlug?: string; keepExisting?: boolean } = {},
) {
  const lessons = await prisma.courseItem.findMany({
    where: {
      kind: 'LESSON',
      ...(productSlug && { product: { slug: productSlug } }),
    },
    include: { parent: { select: { kind: true, title: true } } },
  })
  const hasTranscript = keepExisting
    ? new Set(
        (
          await prisma.lessonTranscript.findMany({
            where: { itemId: { in: lessons.map((l) => l.id) } },
            select: { itemId: true },
          })
        ).map((t) => t.itemId),
      )
    : new Set<string>()
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
    const pending = lessonIds.filter((id) => !hasTranscript.has(id))
    if (pending.length === 0) {
      skipped.push(`${file} (ya cargada)`)
      continue
    }
    if (!dry) {
      for (const itemId of pending) {
        await prisma.lessonTranscript.upsert({
          where: { itemId },
          create: { itemId, lines },
          update: { lines },
        })
      }
    }
    loaded.push(
      `${file} → ${lines.length} líneas, ${pending.length} lección(es)`,
    )
  }
  return {
    loaded,
    skipped,
    withoutTranscript: plan.withoutTranscript.map((l) => l.title),
  }
}
