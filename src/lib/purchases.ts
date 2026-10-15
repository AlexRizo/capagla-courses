import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { resolveOffer } from '#/lib/offers'

// Orden con lo que dice la oferta del momento (precios del servidor, nunca del cliente):
// el curso, los cursos adicionales de la promoción y la herramienta si se marcó la casilla.
// Guarda la promoción de origen para atribuir la compra, aunque ya no aplique su precio.
export async function createOrder(input: {
  email: string
  name: string
  withTool: boolean
  promo?: string
}) {
  const offer = await resolveOffer(input.promo, true)
  if (!offer.main.published) throw new Error('El curso no está a la venta.')
  const items = [
    offer.main,
    ...offer.extras.filter((e) => e.isCourse || input.withTool),
  ].map((p) => ({ productId: p.productId, amountMxn: p.priceMxn }))

  return prisma.order.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      amountMxn: items.reduce((sum, item) => sum + item.amountMxn, 0),
      promotionId: offer.promotion?.id,
      items: { create: items },
    },
  })
}

// Es lo que luego disparará el webhook de Stripe. Idempotente: si la orden ya
// está pagada no hace nada.
export async function completeOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  })
  if (order.status === 'PAID') return order

  const ctx = await auth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(order.email)
  const user =
    existing?.user ??
    (await ctx.internalAdapter.createUser(
      { email: order.email, name: order.name, emailVerified: true },
      { method: 'purchase' },
    ))

  const [paid] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: new Date(), userId: user.id },
    }),
    ...order.items.map((item) => {
      // Días de acceso del producto desde la compra; recomprar reinicia el plazo.
      const expiresAt = new Date(
        Date.now() + item.product.accessDays * 24 * 60 * 60 * 1000,
      )
      return prisma.enrollment.upsert({
        where: {
          userId_productId: { userId: user.id, productId: item.productId },
        },
        create: { userId: user.id, productId: item.productId, expiresAt },
        update: { expiresAt },
      })
    }),
  ])

  await auth.api.signInMagicLink({
    body: { email: order.email, callbackURL: '/mis-cursos' },
    headers: new Headers(),
  })

  return paid
}

export async function failOrder(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'FAILED' },
  })
}
