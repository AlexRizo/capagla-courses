// Solo servidor: nada del navegador importa este archivo (si un módulo que importa el navegador
// exportara esta función, Prisma terminaría en el bundle del cliente).
import { prisma } from '#/db'
import { buildPlayerTree, onlyFreeItems } from '#/lib/player-tree'

// La clase gratis es el primer bloque gratis de un curso publicado: su primera lección es donde
// aterriza quien se registra. Sin bloque gratis (o sin lecciones) no hay clase gratis.
export async function findFreeLesson() {
  const courses = await prisma.product.findMany({
    where: { kind: 'COURSE', status: 'PUBLISHED' },
    orderBy: { position: 'asc' },
  })
  for (const course of courses) {
    const items = await prisma.courseItem.findMany({
      where: { productId: course.id },
    })
    const { order } = buildPlayerTree(onlyFreeItems(items), new Set())
    if (order.length) return { slug: course.slug, lessonId: order[0].lesson.id }
  }
  return null
}
