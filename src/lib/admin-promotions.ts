import { Prisma } from '@prisma/client'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { courseContents } from '#/lib/course-pages'
import { env } from '#/env'
import { getBunnyVideo } from '#/lib/bunny'
import { requireAdmin } from '#/lib/guards'
import { promotionTestKey } from '#/lib/offers'
import {
  MAX_PROMOTION_PRODUCTS,
  fromLocalInput,
  normalizeSlug,
  promotionStatus,
  toLocalInput,
  vigency,
} from '#/lib/promotions'

// Listado de promociones del panel (modo pro).
// Visitas no se miden todavía (la pantalla las deja en "—"); ventas = órdenes pagadas.
export const getAdminPromotions = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const [promotions, sales] = await Promise.all([
      prisma.promotion.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: [
          { startsAt: { sort: 'asc', nulls: 'first' } },
          { createdAt: 'asc' },
        ],
      }),
      prisma.order.groupBy({
        by: ['promotionId'],
        where: { status: 'PAID', promotionId: { not: null } },
        _count: true,
      }),
    ])
    const salesBy = new Map(sales.map((s) => [s.promotionId, s._count]))
    const now = new Date()
    return promotions.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      products: p._count.products,
      vigency: vigency(p.startsAt, p.endsAt),
      status: promotionStatus(p, now),
      sales: salesBy.get(p.id) ?? 0,
    }))
  })

// Editor de una promoción: sus datos, sus productos y los productos que se pueden elegir.
export const getAdminPromotion = createServerFn()
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [promotion, catalog, paid] = await Promise.all([
      prisma.promotion.findUnique({
        where: { id: data.id },
        include: { products: { orderBy: { position: 'asc' } } },
      }),
      prisma.product.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
      prisma.order.aggregate({
        where: { status: 'PAID', promotionId: data.id },
        _count: true,
        _sum: { amountMxn: true },
      }),
    ])
    if (!promotion) throw notFound()

    return {
      id: promotion.id,
      name: promotion.name,
      slug: promotion.slug,
      status: promotionStatus(promotion),
      paused: promotion.paused,
      startsAt: toLocalInput(promotion.startsAt),
      endsAt: toLocalInput(promotion.endsAt),
      introTitle: promotion.introTitle ?? '',
      introText: promotion.introText ?? '',
      introVideoId: promotion.introVideoId,
      purchases: paid._count,
      revenueMxn: paid._sum.amountMxn ?? 0,
      baseUrl: env.BETTER_AUTH_URL.replace(/\/$/, ''),
      testKey: promotionTestKey(promotion.id),
      slots: promotion.products.map((p) => ({
        productId: p.productId,
        price: String(p.priceMxn),
      })),
      catalog: catalog.map((p) => ({
        id: p.id,
        name: p.name,
        isCourse: p.kind === 'COURSE',
        // La landing de una promoción usa la página de venta de su producto principal.
        hasPage: p.slug in courseContents,
        normalPriceMxn: p.priceMxn,
      })),
    }
  })

const NEW_NAME = 'Nueva promoción'
const NEW_SLUG = 'nueva-promocion'

// Crea una promoción con el primer curso publicado como principal y la abre en el editor.
export const createPromotion = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .handler(async () => {
    const course = await prisma.product.findFirst({
      where: { kind: 'COURSE', status: 'PUBLISHED' },
      orderBy: { name: 'asc' },
    })
    if (!course) return { error: 'Primero publica un curso.' }

    const taken = new Set(
      (
        await prisma.promotion.findMany({
          where: { slug: { startsWith: NEW_SLUG } },
          select: { slug: true },
        })
      ).map((p) => p.slug),
    )
    let slug = NEW_SLUG
    for (let n = 2; taken.has(slug); n++) slug = `${NEW_SLUG}-${n}`

    const created = await prisma.promotion.create({
      data: {
        slug,
        name: NEW_NAME,
        products: {
          create: {
            productId: course.id,
            position: 0,
            priceMxn: course.priceMxn,
          },
        },
      },
    })
    return { id: created.id }
  })

// Guarda datos, intro y productos. El cliente manda los productos en orden (el primero es
// el principal, que puede ser cualquier producto); el servidor comprueba que existan y que no se repitan.
export const updatePromotion = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(120),
      slug: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      introTitle: z.string().trim().max(200),
      introText: z.string().trim().max(1000),
      // Video de intro: id de Bunny; vacío lo quita.
      introVideoId: z.string().trim(),
      products: z
        .array(
          z.object({
            productId: z.string(),
            priceMxn: z.coerce.number().int().min(0).max(1_000_000),
          }),
        )
        .min(1)
        .max(MAX_PROMOTION_PRODUCTS),
    }),
  )
  .handler(async ({ data }) => {
    const slug = normalizeSlug(data.slug)
    if (!slug) {
      return {
        error:
          'La URL solo puede tener letras minúsculas, números y guiones, y no puede ser una ruta que ya existe.',
      }
    }
    const startsAt = fromLocalInput(data.startsAt)
    const endsAt = fromLocalInput(data.endsAt)
    if (startsAt === undefined || endsAt === undefined) {
      return { error: 'Revisa las fechas.' }
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      return { error: 'La promoción debe terminar después de empezar.' }
    }

    if (
      data.introVideoId &&
      !(await getBunnyVideo(data.introVideoId).catch(() => null))
    ) {
      return { error: 'Ese video no está en la biblioteca de Bunny.' }
    }

    const ids = data.products.map((p) => p.productId)
    if (new Set(ids).size !== ids.length) {
      return { error: 'Un producto no puede repetirse en la promoción.' }
    }
    const found = await prisma.product.findMany({ where: { id: { in: ids } } })
    if (found.length !== ids.length) return { error: 'Producto no encontrado.' }

    try {
      await prisma.$transaction([
        prisma.promotionProduct.deleteMany({ where: { promotionId: data.id } }),
        prisma.promotion.update({
          where: { id: data.id },
          data: {
            name: data.name,
            slug,
            startsAt,
            endsAt,
            introTitle: data.introTitle || null,
            introText: data.introText || null,
            introVideoId: data.introVideoId || null,
            products: {
              create: data.products.map((p, position) => ({ ...p, position })),
            },
          },
        }),
      ])
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return { error: 'Esa URL ya la usa otra promoción.' }
      }
      throw e
    }
    return {}
  })

// "Pausar promoción" / "Reanudar promoción".
export const setPromotionPaused = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string(), paused: z.boolean() }))
  .handler(async ({ data }) => {
    await prisma.promotion.update({
      where: { id: data.id },
      data: { paused: data.paused },
    })
  })
