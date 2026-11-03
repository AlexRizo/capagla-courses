import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { seedTranscripts } from './transcripts-seed'

// Solo las transcripciones de los cursos que ya existen (sin correr el seed completo, que en
// producción pide ADMIN_EMAIL y ADMIN_PASSWORD). Uso: pnpm db:seed-transcripts
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

seedTranscripts(prisma)
  .catch((e) => {
    console.error('❌ Error cargando transcripciones:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
