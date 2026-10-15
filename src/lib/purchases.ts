import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import {
  COURSE_SLUG,
  FREE_COURSE_SLUG,
  TOOL_BUMP_PRICE_MXN,
  TOOL_SLUG,
} from '#/lib/catalog'

// Curso + curso de costos gratis (bono) + herramienta si se marcó la casilla.
export async function createOrder(input: {
  email: string
  name: string
  withTool: boolean
}) {
  const slugs = [
    COURSE_SLUG,
    FREE_COURSE_SLUG,
    ...(input.withTool ? [TOOL_SLUG] : []),
  ]
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const items = slugs.map((slug) => {
    const product = bySlug.get(slug)
    if (!product) throw new Error(`Producto no encontrado: ${slug}`)
    const amountMxn =
      slug === COURSE_SLUG
        ? product.priceMxn
        : slug === TOOL_SLUG
          ? TOOL_BUMP_PRICE_MXN
          : 0
    return { productId: product.id, amountMxn }
  })

  return prisma.order.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      amountMxn: items.reduce((sum, item) => sum + item.amountMxn, 0),
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
