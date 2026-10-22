import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { loadLessonTexts } from './lesson-texts'

// Carga el texto de las lecciones de texto (Introducción) desde
// `prisma/data/lecciones-textuales`. Sin `--force` no toca una lección que ya tenga texto;
// con `--force` lo reemplaza (pierde lo editado en el panel). Cargar **después** de rearmar el
// curso con el mapa. Las imágenes de esos textos están en `public/images/lecciones`.
// Uso: pnpm db:import-lesson-texts [--dry] [--force]   (--dry solo muestra qué haría)
const dir = 'prisma/data/lecciones-textuales'
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  const { loaded, kept, missing } = await loadLessonTexts(prisma, dir, {
    dry,
    force,
  })
  console.log(`${dry ? 'Cargaría' : 'Cargadas'}: ${loaded.length}`)
  for (const l of loaded) console.log(`  ${l}`)
  if (kept.length) {
    console.log(`Ya tenían texto (no se tocaron, usa --force): ${kept.length}`)
    for (const k of kept) console.log(`  ${k}`)
  }
  if (missing.length) {
    console.log(`Lecciones que no existen en el curso: ${missing.length}`)
    for (const m of missing) console.log(`  ${m}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
