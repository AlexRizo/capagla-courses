import { prisma } from '#/db'

// Dónde se usa cada video de Bunny: lecciones, videos de intro de las promociones y de las
// páginas de venta (cursos y herramienta). Sirve para
// mostrar "Ya en: …" en el selector y para no borrar un video que se está usando.
export async function bunnyVideoUsage() {
  const [lessons, promotions, products, site] = await Promise.all([
    prisma.courseItem.findMany({
      where: { bunnyVideoId: { not: null } },
      select: { bunnyVideoId: true, title: true },
    }),
    prisma.promotion.findMany({
      where: { introVideoId: { not: null } },
      select: { introVideoId: true, name: true },
    }),
    prisma.product.findMany({
      where: { introVideoId: { not: null } },
      select: { introVideoId: true, name: true },
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ])
  const usage = new Map<string, string>()
  for (const l of lessons) usage.set(l.bunnyVideoId!, l.title)
  for (const p of promotions) {
    if (!usage.has(p.introVideoId!)) {
      usage.set(p.introVideoId!, `intro de la promoción ${p.name}`)
    }
  }
  for (const p of products) {
    if (!usage.has(p.introVideoId!)) {
      usage.set(p.introVideoId!, `intro de la página de ${p.name}`)
    }
  }
  if (site?.toolPageVideoId && !usage.has(site.toolPageVideoId)) {
    usage.set(site.toolPageVideoId, 'página de la herramienta')
  }
  return usage
}

// null si nada usa el video.
export async function bunnyVideoUsedBy(videoId: string) {
  return (await bunnyVideoUsage()).get(videoId) ?? null
}
