import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { loadLessonResources } from './lesson-resources'

// Agrega a las lecciones sus enlaces de descarga: el PDF de cada receta (lección "Receta") y el
// recetario general (solo en la Introducción). No repite los que ya tienen. Con `--replace-text`
// quita además el texto de las lecciones "Receta" (el PDF lo reemplaza; pierde lo editado en el
// panel). Cargar **después** de rearmar el curso con el mapa.
// Uso: pnpm db:import-lesson-resources [--dry] [--replace-text]
const dry = process.argv.includes('--dry')
const replaceText = process.argv.includes('--replace-text')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  const { added, present, missing } = await loadLessonResources(prisma, {
    dry,
    replaceText,
  })
  console.log(`${dry ? 'Agregaría a' : 'Agregados a'}: ${added.length}`)
  for (const a of added) console.log(`  ${a}`)
  if (present.length) {
    console.log(`Ya tenían sus enlaces: ${present.length}`)
    for (const p of present) console.log(`  ${p}`)
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
