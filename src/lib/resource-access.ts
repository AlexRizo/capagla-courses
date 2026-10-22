import { prisma } from '#/db'
import { onlyFreeItems } from '#/lib/player-tree'

// ¿Puede esta sesión bajar un recurso de capítulo o lección? Lo mismo que comprueba el
// reproductor: la admin entra siempre; una alumna, con el curso publicado y su acceso vigente
// o, si no, solo a lo que está dentro de un bloque o capítulo gratis.
export async function canReadResource(
  session: { user: { id: string; role?: string | null } },
  resource: { itemId: string; item: { productId: string } },
) {
  if (session.user.role === 'ADMIN') return true

  const { productId } = resource.item
  const course = await prisma.product.findUnique({ where: { id: productId } })
  if (course?.status !== 'PUBLISHED') return false

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_productId: { userId: session.user.id, productId } },
  })
  if (enrollment && enrollment.expiresAt > new Date()) return true

  const items = await prisma.courseItem.findMany({ where: { productId } })
  return onlyFreeItems(items).some((i) => i.id === resource.itemId)
}
