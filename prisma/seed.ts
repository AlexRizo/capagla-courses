import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'

import { adminCredentials } from './admin-credentials'
import { courseTreeFromMap } from './course-map'
import type { MapEntry } from './course-map'
import { courseTreeFromIndex, createItems } from './course-tree'
import { loadLessonTexts } from './lesson-texts'
import type { VideoName } from './transcript-plan'
import { loadTranscripts } from './transcripts-load'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Productos con los datos de la maqueta. Precios normales en MXN: los especiales ($397, $100...)
// viven en las promociones. El curso de costos usa el $347 que muestra la Home de la maqueta
// (su "[valor real]" en el panel está sin definir) y es borrador hasta que esté terminado.
const products = [
  {
    slug: 'postres-navidad',
    name: 'Postres para vender en Navidad',
    kind: 'COURSE',
    priceMxn: 897,
    status: 'PUBLISHED',
    position: 0,
    description:
      '11 recetas rendidoras con medidas exactas, decoración y consejos para empacar y cobrar.',
    coverUrl: '/images/postres-navidad.jpg',
  },
  {
    slug: 'calcular-costos',
    name: 'Cómo calcular costos de tus postres',
    kind: 'COURSE',
    priceMxn: 347,
    status: 'DRAFT',
    position: 1,
    description: null,
    coverUrl: null,
  },
  {
    slug: 'herramienta-costos',
    name: 'Herramienta de costos',
    kind: 'TOOL',
    priceMxn: 200,
    status: 'PUBLISHED',
    position: 2,
    description:
      'Calcula el costo por porción y el precio sugerido de cada receta.',
    coverUrl: null,
  },
] as const

// Idempotente: no pisa lo editado en el panel (nombre, precio, estado, descripción, portada).
// Solo fija lo estructural (tipo y orden) y rellena la descripción y la portada si faltan.
async function seedProducts() {
  for (const { description, coverUrl, ...product } of products) {
    const { kind, position } = product
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: { kind, position },
      create: product,
    })
    if (description) {
      await prisma.product.updateMany({
        where: { slug: product.slug, description: null },
        data: { description },
      })
    }
    if (coverUrl) {
      await prisma.product.updateMany({
        where: { slug: product.slug, coverUrl: null },
        data: { coverUrl },
      })
    }
  }
  console.log(`✅ ${products.length} productos`)
}

// Administradora: ver `admin-credentials.ts` (en producción exige ADMIN_EMAIL y ADMIN_PASSWORD).
const admin = adminCredentials(process.env)
const localDatabase = admin.local

async function seedAdmin() {
  const user = await prisma.user.upsert({
    where: { email: admin.email },
    update: { role: 'ADMIN' },
    create: {
      id: crypto.randomUUID(),
      email: admin.email,
      name: admin.name,
      emailVerified: true,
      role: 'ADMIN',
    },
  })
  const password = await hashPassword(admin.password)
  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  })
  if (credential) {
    // En desarrollo se restablece la contraseña; en producción no se pisa la que ya cambió.
    if (localDatabase) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password },
      })
    }
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password,
      },
    })
  }
  console.log(`✅ admin ${admin.email}`)
}

// Árbol del curso: estructura del índice de contenido (`prisma/data/curso-principal.json`) con el
// orden y los videos de Bunny del mapa de videos (`prisma/data/mapa-videos.json`, el mismo
// orden y GUID de `bitacora/contenido/UBICACION-VIDEOS.md`), más las transcripciones
// (`prisma/data/transcripciones`). Sin el mapa, solo la estructura del índice.
async function seedCourseTree() {
  const course = await prisma.product.findUniqueOrThrow({
    where: { slug: 'postres-navidad' },
  })
  // Idempotente: no pisa lo que ya se haya editado en el panel (para reemplazarlo:
  // pnpm db:import-course-map).
  if ((await prisma.courseItem.count({ where: { productId: course.id } })) > 0)
    return
  const file = new URL('./data/curso-principal.json', import.meta.url)
  if (!existsSync(file)) {
    console.log('⚠️ sin prisma/data/curso-principal.json: curso sin árbol')
    return
  }
  const index = JSON.parse(readFileSync(file, 'utf8'))
  const mapFile = new URL('./data/mapa-videos.json', import.meta.url)
  if (!existsSync(mapFile)) {
    await createItems(prisma, course.id, courseTreeFromIndex(index), null)
    console.log(
      '✅ árbol de postres-navidad desde el índice (sin mapa de videos)',
    )
    return
  }
  const map = JSON.parse(readFileSync(mapFile, 'utf8')) as (MapEntry &
    VideoName)[]
  await createItems(prisma, course.id, courseTreeFromMap(index, map), null)
  console.log('✅ árbol de postres-navidad con el mapa de videos')

  const dir = fileURLToPath(new URL('./data/transcripciones', import.meta.url))
  if (!existsSync(dir)) return
  const { loaded, skipped, withoutTranscript } = await loadTranscripts(
    prisma,
    dir,
    map,
  )
  console.log(
    `✅ transcripciones: ${loaded.length} archivos cargados` +
      `, ${skipped.length} sin cargar, ${withoutTranscript.length} lecciones con video sin transcripción`,
  )
}

// Texto de las lecciones de texto (Introducción y la "Receta" de cada capítulo), desde
// `prisma/data/lecciones-textuales`. Idempotente: no pisa una lección que ya tenga texto (para
// reemplazarlo: pnpm db:import-lesson-texts --force).
async function seedLessonTexts() {
  const dir = fileURLToPath(
    new URL('./data/lecciones-textuales', import.meta.url),
  )
  if (!existsSync(dir)) return
  const { loaded, kept, missing } = await loadLessonTexts(prisma, dir)
  console.log(
    `✅ textos de lecciones: ${loaded.length} cargados, ${kept.length} ya tenían texto, ${missing.length} sin lección`,
  )
}

// Promoción de la maqueta del panel: precios del editor de ejemplo (curso $397,
// herramienta $100; el curso de costos gratis se quitó, ver `seedFinalPromotion`). Sin fecha de inicio (la maqueta pone "[inicio]"); termina
// el 17 de noviembre al final del día en America/Mexico_City (UTC-6). La segunda promoción
// de la lista (`/navidad-final`) no se siembra: la maqueta no define su contenido.
async function seedPromotion() {
  // Idempotente: no pisa lo que ya se haya editado en el panel.
  if (await prisma.promotion.findUnique({ where: { slug: 'navidad' } })) return
  const bySlug = async (slug: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { slug } })).id
  await prisma.promotion.create({
    data: {
      slug: 'navidad',
      name: 'Anuncio: Navidad',
      // Del 16 de octubre 00:00 al 17 de noviembre 23:59, hora de Ciudad de México (UTC-6).
      startsAt: new Date('2026-10-16T06:00:00Z'),
      endsAt: new Date('2026-11-18T05:59:00Z'),
      products: {
        create: [
          {
            productId: await bySlug('postres-navidad'),
            position: 0,
            priceMxn: 397,
          },
          {
            productId: await bySlug('herramienta-costos'),
            position: 1,
            priceMxn: 100,
          },
        ],
      },
    },
  })
  console.log('✅ promoción /navidad')
}

// Segunda promoción de la maqueta ("última semana"): precios de la "fecha 2" (curso $597,
// herramienta con 25%). El curso de costos gratis (decisión del cliente, 2026-10-16) se quitó de
// las dos promociones el 2026-10-20 porque el curso aún no está terminado; se agrega de nuevo
// en el panel (Promociones) cuando lo esté.
async function seedFinalPromotion() {
  if (await prisma.promotion.findUnique({ where: { slug: 'navidad-final' } })) {
    return
  }
  const bySlug = async (slug: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { slug } })).id
  await prisma.promotion.create({
    data: {
      slug: 'navidad-final',
      name: 'Anuncio: Navidad (última semana)',
      // Del 18 de noviembre 00:00 al 30 de noviembre 23:59, hora de Ciudad de México (UTC-6).
      startsAt: new Date('2026-11-18T06:00:00Z'),
      endsAt: new Date('2026-12-01T05:59:00Z'),
      products: {
        create: [
          {
            productId: await bySlug('postres-navidad'),
            position: 0,
            priceMxn: 597,
          },
          {
            productId: await bySlug('herramienta-costos'),
            position: 1,
            priceMxn: 150,
          },
        ],
      },
    },
  })
  console.log('✅ promoción /navidad-final')
}

async function main() {
  await seedProducts()
  await seedAdmin()
  await seedCourseTree()
  await seedLessonTexts()
  await seedPromotion()
  await seedFinalPromotion()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
