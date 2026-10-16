import { existsSync, readFileSync } from 'node:fs'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'

import { courseTreeFromIndex, createItems } from './course-tree'

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

// Administradora de desarrollo (no hay registro: las cuentas nacen al comprar).
const admin = { email: 'dev@alowee.com', name: 'Admin', password: 'Passwd123+' }

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
    await prisma.account.update({
      where: { id: credential.id },
      data: { password },
    })
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

// Árbol del curso desde el índice de contenido (`contenido/curso-principal.json`).
async function seedCourseTree() {
  const course = await prisma.product.findUniqueOrThrow({
    where: { slug: 'postres-navidad' },
  })
  // Idempotente: no pisa lo que ya se haya editado en el panel (para reemplazarlo: pnpm db:import-course).
  if ((await prisma.courseItem.count({ where: { productId: course.id } })) > 0)
    return
  const file = new URL('../../contenido/curso-principal.json', import.meta.url)
  if (!existsSync(file)) {
    console.log('⚠️ sin contenido/curso-principal.json: curso sin árbol')
    return
  }
  const tree = courseTreeFromIndex(JSON.parse(readFileSync(file, 'utf8')))
  await createItems(prisma, course.id, tree, null)
  console.log('✅ árbol de postres-navidad desde el índice de contenido')
}

// Promoción de la maqueta del panel: precios del editor de ejemplo (curso $397, curso de
// costos gratis, herramienta $100). Sin fecha de inicio (la maqueta pone "[inicio]"); termina
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
      name: 'Anuncio: 3 cursos en 1',
      endsAt: new Date('2026-11-18T05:59:00Z'),
      products: {
        create: [
          {
            productId: await bySlug('postres-navidad'),
            position: 0,
            priceMxn: 897,
          },
          {
            productId: await bySlug('calcular-costos'),
            position: 1,
            priceMxn: 0,
          },
          {
            productId: await bySlug('herramienta-costos'),
            position: 2,
            priceMxn: 100,
          },
        ],
      },
    },
  })
  console.log('✅ promoción /navidad')
}

async function main() {
  await seedProducts()
  await seedAdmin()
  await seedCourseTree()
  await seedPromotion()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
