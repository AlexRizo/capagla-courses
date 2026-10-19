import { prisma } from '#/db'

// Vacía todas las tablas (menos las migraciones) entre pruebas.
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'`
  if (tables.length === 0) return
  const list = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`truncate ${list} restart identity cascade`)
}

// Productos como los de la tienda: el curso, uno adicional y la herramienta.
export async function seedCatalog() {
  const course = await prisma.product.create({
    data: {
      slug: 'postres-navidad',
      name: 'Postres de Navidad',
      kind: 'COURSE',
      priceMxn: 897,
      accessDays: 365,
      status: 'PUBLISHED',
    },
  })
  const extra = await prisma.product.create({
    data: {
      slug: 'calcular-costos',
      name: 'Cómo calcular costos',
      kind: 'COURSE',
      priceMxn: 347,
      accessDays: 365,
      status: 'PUBLISHED',
    },
  })
  const tool = await prisma.product.create({
    data: {
      slug: 'herramienta-costos',
      name: 'Herramienta de costos',
      kind: 'TOOL',
      priceMxn: 200,
      accessDays: 365,
      status: 'PUBLISHED',
    },
  })
  return { course, extra, tool }
}
