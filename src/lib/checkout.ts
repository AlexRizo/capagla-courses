import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { COURSE_SLUG, TOOL_SLUG } from '#/lib/catalog'
import { createOrder } from '#/lib/purchases'

export const getCheckoutData = createServerFn().handler(async () => {
  const [course, tool] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { slug: COURSE_SLUG } }),
    prisma.product.findUniqueOrThrow({ where: { slug: TOOL_SLUG } }),
  ])
  return {
    course: { name: course.name, priceMxn: course.priceMxn },
    tool: { priceMxn: tool.priceMxn },
  }
})

export const startCheckout = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().email(),
      name: z.string().min(1),
      withTool: z.boolean(),
    }),
  )
  .handler(async ({ data }) => (await createOrder(data)).id)

export const getOrder = createServerFn()
  .validator(z.object({ orderId: z.string() }))
  .handler(({ data }) =>
    prisma.order.findUniqueOrThrow({
      where: { id: data.orderId },
      include: { items: { include: { product: true } } },
    }),
  )
