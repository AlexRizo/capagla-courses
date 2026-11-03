import { prisma } from '#/db'

// Dónde se usa cada video de Bunny: lecciones y videos de intro de las promociones. Sirve para
// mostrar "Ya en: …" en el selector y para no borrar un video que se está usando.
export async function bunnyVideoUsage() {
  const [lessons, promotions] = await Promise.all([
    prisma.courseItem.findMany({
      where: { bunnyVideoId: { not: null } },
      select: { bunnyVideoId: true, title: true },
    }),
    prisma.promotion.findMany({
      where: { introVideoId: { not: null } },
      select: { introVideoId: true, name: true },
    }),
  ])
  const usage = new Map<string, string>()
  for (const l of lessons) usage.set(l.bunnyVideoId!, l.title)
  for (const p of promotions) {
    if (!usage.has(p.introVideoId!)) {
      usage.set(p.introVideoId!, `intro de la promoción ${p.name}`)
    }
  }
  return usage
}

// null si ninguna lección ni promoción usa el video.
export async function bunnyVideoUsedBy(videoId: string) {
  return (await bunnyVideoUsage()).get(videoId) ?? null
}
