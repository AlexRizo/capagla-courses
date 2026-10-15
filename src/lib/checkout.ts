import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { courseContents } from '#/lib/course-pages'
import { resolveOffer } from '#/lib/offers'
import { longDate } from '#/lib/promotions'
import { createOrder } from '#/lib/purchases'

// Lo que se vende en el checkout. Con `?promo=` y la promoción vigente (con 1 hora de gracia),
// el curso lleva su precio especial y se suman sus adicionales: cursos incluidos y la
// herramienta como casilla. Sin promoción es solo el curso al precio normal.
export const getCheckoutData = createServerFn()
  .validator(z.object({ promo: z.string().optional() }))
  .handler(async ({ data }) => {
    const offer = await resolveOffer(data.promo, true)
    if (!offer.main.published) throw notFound()
    const line = (p: {
      name: string
      normalMxn: number
      priceMxn: number
    }) => ({
      name: p.name,
      normalMxn: p.normalMxn,
      priceMxn: p.priceMxn,
    })
    const tool = offer.extras.find((e) => !e.isCourse)
    return {
      // El producto principal puede ser cualquier producto (no solo el curso de Navidad).
      course: {
        ...line(offer.main),
        label: offer.main.isCourse ? 'Curso' : 'Herramienta',
        image: offer.main.coverUrl,
        accessDays: offer.main.accessDays,
        recipes: courseContents[offer.main.slug]?.recipes.length ?? null,
      },
      bonuses: offer.extras.filter((e) => e.isCourse).map(line),
      tool: tool ? line(tool) : null,
      special: offer.applied,
      until:
        offer.applied && offer.promotion?.endsAt
          ? longDate(offer.promotion.endsAt)
          : null,
    }
  })

export const startCheckout = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().email(),
      name: z.string().min(1),
      withTool: z.boolean(),
      promo: z.string().optional(),
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
