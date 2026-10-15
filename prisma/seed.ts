import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Precios en MXN. El curso de costos es un bono gratis según la maqueta
// (su "[valor real]" está sin definir); la promoción escalonada del curso
// principal ($397 → $597 → $897) aún no se modela.
const products = [
  {
    slug: 'postres-navidad',
    name: 'Postres para vender en Navidad',
    kind: 'COURSE',
    priceMxn: 397,
    status: 'PUBLISHED',
  },
  {
    slug: 'calcular-costos',
    name: 'Cómo calcular costos de tus postres',
    kind: 'COURSE',
    priceMxn: 0,
    status: 'DRAFT',
  },
  {
    slug: 'herramienta-costos',
    name: 'Herramienta de costos',
    kind: 'TOOL',
    priceMxn: 200,
    status: 'PUBLISHED',
  },
] as const

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

type SeedItem = {
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON'
  title: string
  isFree?: boolean
  lessonType?: 'VIDEO' | 'TEXT'
  durationSec?: number
  children?: SeedItem[]
}

// Árbol de ejemplo de la maqueta del panel (solo lo que nombra; sin videos
// ni las lecciones que la maqueta no detalla).
const tree: SeedItem[] = [
  {
    kind: 'BLOCK',
    title: 'Introducción',
    isFree: true,
    children: [
      {
        kind: 'LESSON',
        title: 'Introducción y consejos básicos',
        lessonType: 'VIDEO',
        durationSec: 260,
      },
      {
        kind: 'LESSON',
        title: '¿Quién soy?',
        lessonType: 'VIDEO',
        durationSec: 130,
      },
    ],
  },
  {
    kind: 'BLOCK',
    title: 'Postres de snack para Navidad',
    children: [
      {
        kind: 'CHAPTER',
        title: 'Enjambre de chocolate',
        children: [
          { kind: 'LESSON', title: 'Receta', lessonType: 'TEXT' },
          {
            kind: 'LESSON',
            title: 'Preparación',
            lessonType: 'VIDEO',
            durationSec: 1064,
          },
          {
            kind: 'LESSON',
            title: 'Resultado',
            lessonType: 'VIDEO',
            durationSec: 38,
          },
        ],
      },
      { kind: 'CHAPTER', title: 'Turrón de chocolate' },
    ],
  },
  {
    kind: 'BLOCK',
    title: 'Hora de hornear',
    children: [{ kind: 'CHAPTER', title: 'Brownie de cheesecake' }],
  },
]

async function createItems(
  productId: string,
  items: SeedItem[],
  parentId: string | null,
) {
  for (const [position, { children, ...item }] of items.entries()) {
    const created = await prisma.courseItem.create({
      data: { ...item, productId, parentId, position, status: 'PUBLISHED' },
    })
    if (children) await createItems(productId, children, created.id)
  }
}

async function seedCourseTree() {
  const course = await prisma.product.findUniqueOrThrow({
    where: { slug: 'postres-navidad' },
  })
  // Idempotente: no pisa lo que ya se haya editado en el panel.
  if ((await prisma.courseItem.count({ where: { productId: course.id } })) > 0)
    return
  await createItems(course.id, tree, null)
  console.log('✅ árbol de ejemplo de postres-navidad')
}

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    })
  }
  console.log(`✅ ${products.length} productos`)
  await seedAdmin()
  await seedCourseTree()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
