import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { RENEWAL_DISCOUNT_PCT } from '#/lib/catalog'
import { canRenew, renewalPrice } from '#/lib/offers'
import {
  AlreadyOwnedError,
  completeOrder,
  createOrder,
  failOrder,
  refundOrder,
} from '#/lib/purchases'
import { resetDb, seedCatalog } from '#/test/db'

const DAY = 24 * 60 * 60 * 1000
const buyer = { email: 'Ana@Test.com ', name: ' Ana ' }

let catalog: Awaited<ReturnType<typeof seedCatalog>>

beforeEach(async () => {
  await resetDb()
  catalog = await seedCatalog()
})

// Promoción vigente: curso principal a $397; adicional a $0 (regalo); herramienta a $100.
async function seedPromotion(over: { paused?: boolean; endsAt?: Date } = {}) {
  const now = Date.now()
  return prisma.promotion.create({
    data: {
      slug: 'navidad',
      name: 'Navidad',
      startsAt: new Date(now - DAY),
      endsAt: over.endsAt ?? new Date(now + DAY),
      paused: over.paused ?? false,
      products: {
        create: [
          { productId: catalog.course.id, priceMxn: 397, position: 0 },
          { productId: catalog.extra.id, priceMxn: 0, position: 1 },
          { productId: catalog.tool.id, priceMxn: 100, position: 2 },
        ],
      },
    },
  })
}

describe('createOrder', () => {
  it('sin promoción cobra el precio normal del curso, nada más', async () => {
    const order = await createOrder({ ...buyer, withTool: true })
    expect(order.amountMxn).toBe(897)
    expect(order.email).toBe('ana@test.com')
    expect(order.name).toBe('Ana')
    expect(order.promotionId).toBeNull()
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    })
    expect(items).toHaveLength(1)
  })

  it('con promoción vigente usa los precios especiales y el curso adicional va siempre', async () => {
    const promo = await seedPromotion()
    const order = await createOrder({
      ...buyer,
      withTool: false,
      promo: 'navidad',
    })
    expect(order.amountMxn).toBe(397)
    expect(order.promotionId).toBe(promo.id)
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    })
    // Curso principal + curso adicional (regalo); la herramienta no, porque no se marcó.
    expect(items.map((i) => i.amountMxn).sort()).toEqual([0, 397])
  })

  it('la herramienta solo se cobra si se marcó la casilla', async () => {
    await seedPromotion()
    const order = await createOrder({
      ...buyer,
      withTool: true,
      promo: 'navidad',
    })
    expect(order.amountMxn).toBe(497)
  })

  it('con la promoción pausada o terminada cobra el precio normal, pero la atribuye', async () => {
    const paused = await seedPromotion({ paused: true })
    const a = await createOrder({ ...buyer, withTool: true, promo: 'navidad' })
    expect(a.amountMxn).toBe(897)
    expect(a.promotionId).toBe(paused.id)

    await resetDb()
    catalog = await seedCatalog()
    await seedPromotion({ endsAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
    const b = await createOrder({ ...buyer, withTool: true, promo: 'navidad' })
    expect(b.amountMxn).toBe(897)
  })

  it('una hora después del fin todavía respeta el precio de la promoción', async () => {
    await seedPromotion({ endsAt: new Date(Date.now() - 30 * 60 * 1000) })
    const order = await createOrder({
      ...buyer,
      withTool: false,
      promo: 'navidad',
    })
    expect(order.amountMxn).toBe(397)
  })

  it('no vende un curso en borrador', async () => {
    await prisma.product.update({
      where: { id: catalog.course.id },
      data: { status: 'DRAFT' },
    })
    await expect(createOrder({ ...buyer, withTool: false })).rejects.toThrow(
      'no está a la venta',
    )
  })

  it('rechaza cobrar otra vez a quien ya tiene el acceso vigente', async () => {
    const first = await createOrder({ ...buyer, withTool: false })
    await completeOrder(first.id)
    await expect(createOrder({ ...buyer, withTool: false })).rejects.toThrow(
      AlreadyOwnedError,
    )
  })

  it('con el acceso vencido sí se puede comprar de nuevo', async () => {
    const first = await createOrder({ ...buyer, withTool: false })
    await completeOrder(first.id)
    await prisma.enrollment.updateMany({
      data: { expiresAt: new Date(Date.now() - DAY) },
    })
    const again = await createOrder({ ...buyer, withTool: false })
    expect(again.amountMxn).toBe(897)
  })
})

describe('renovación', () => {
  it('cuesta el 85% menos del precio normal', () => {
    expect(RENEWAL_DISCOUNT_PCT).toBe(85)
    expect(renewalPrice(897)).toBe(135)
  })

  it('se puede renovar con 30 días o menos, o vencido', () => {
    const now = new Date('2026-10-18T12:00:00Z')
    const inDays = (n: number) => new Date(now.getTime() + n * DAY)
    expect(canRenew(inDays(31), now)).toBe(false)
    expect(canRenew(inDays(30), now)).toBe(true)
    expect(canRenew(inDays(5), now)).toBe(true)
    expect(canRenew(inDays(-10), now)).toBe(true)
  })

  it('la orden de renovación cobra el precio de renovación y suma los días', async () => {
    const first = await createOrder({ ...buyer, withTool: false })
    await completeOrder(first.id)
    const soon = new Date(Date.now() + 10 * DAY)
    await prisma.enrollment.updateMany({ data: { expiresAt: soon } })

    const order = await createOrder({
      ...buyer,
      withTool: true,
      renew: 'postres-navidad',
    })
    expect(order.amountMxn).toBe(135)
    expect(order.renewal).toBe(true)
    await completeOrder(order.id)
    const enrollment = await prisma.enrollment.findFirstOrThrow()
    const expected = soon.getTime() + 365 * DAY
    expect(Math.abs(enrollment.expiresAt.getTime() - expected)).toBeLessThan(
      5000,
    )
  })

  it('no se puede renovar con más de 30 días de acceso', async () => {
    const first = await createOrder({ ...buyer, withTool: false })
    await completeOrder(first.id)
    await expect(
      createOrder({ ...buyer, withTool: false, renew: 'postres-navidad' }),
    ).rejects.toThrow('No se puede renovar.')
  })

  it('quien nunca lo compró no puede renovar', async () => {
    await expect(
      createOrder({ ...buyer, withTool: false, renew: 'postres-navidad' }),
    ).rejects.toThrow('No se puede renovar.')
  })
})

describe('completeOrder', () => {
  it('crea la cuenta, inscribe por los días de acceso y marca la orden pagada', async () => {
    await seedPromotion()
    const order = await createOrder({
      ...buyer,
      withTool: true,
      promo: 'navidad',
    })
    await completeOrder(order.id)

    const paid = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    })
    expect(paid.status).toBe('PAID')
    expect(paid.userId).toBeTruthy()
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'ana@test.com' },
    })
    expect(user.role).toBe('STUDENT')
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.id },
    })
    expect(enrollments).toHaveLength(3)
    for (const e of enrollments) {
      expect(
        Math.abs(e.expiresAt.getTime() - (Date.now() + 365 * DAY)),
      ).toBeLessThan(5000)
    }
  })

  it('es idempotente: completarla dos veces no suma días ni duplica', async () => {
    const order = await createOrder({ ...buyer, withTool: false })
    await completeOrder(order.id)
    const before = await prisma.enrollment.findFirstOrThrow()
    await completeOrder(order.id)
    const after = await prisma.enrollment.findMany()
    expect(after).toHaveLength(1)
    expect(after[0].expiresAt).toEqual(before.expiresAt)
  })

  it('a la vez (webhook y /gracias) solo inscribe una vez', async () => {
    const order = await createOrder({ ...buyer, withTool: false })
    await Promise.all([completeOrder(order.id), completeOrder(order.id)])
    expect(await prisma.enrollment.count()).toBe(1)
    expect(await prisma.user.count()).toBe(1)
  })

  it('una cuenta de clase gratis toma el nombre real al comprar', async () => {
    await prisma.user.create({
      data: {
        id: 'u1',
        email: 'ana@test.com',
        name: 'ana',
        emailVerified: true,
      },
    })
    const order = await createOrder({ ...buyer, withTool: false })
    await completeOrder(order.id)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'u1' } })
    expect(user.name).toBe('Ana')
    expect(await prisma.user.count()).toBe(1)
  })

  it('una orden reembolsada no se vuelve a completar', async () => {
    const order = await createOrder({ ...buyer, withTool: false })
    await completeOrder(order.id)
    await refundOrder(order.id)
    await completeOrder(order.id)
    expect(await prisma.enrollment.count()).toBe(0)
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe('REFUNDED')
  })
})

describe('failOrder', () => {
  it('marca fallida una orden pendiente pero no una ya pagada', async () => {
    const pending = await createOrder({ ...buyer, withTool: false })
    await failOrder(pending.id)
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: pending.id } }))
        .status,
    ).toBe('FAILED')

    const other = await createOrder({
      email: 'otra@test.com',
      name: 'Otra',
      withTool: false,
    })
    await completeOrder(other.id)
    await failOrder(other.id)
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: other.id } }))
        .status,
    ).toBe('PAID')
  })
})

describe('refundOrder', () => {
  it('un reembolso total quita el acceso a todo lo que incluía la orden', async () => {
    await seedPromotion()
    const order = await createOrder({
      ...buyer,
      withTool: true,
      promo: 'navidad',
    })
    await completeOrder(order.id)
    expect(await prisma.enrollment.count()).toBe(3)
    await refundOrder(order.id)
    expect(await prisma.enrollment.count()).toBe(0)
    const refunded = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    })
    expect(refunded.status).toBe('REFUNDED')
    expect(refunded.refundedAt).toBeTruthy()
  })

  it('es idempotente', async () => {
    const order = await createOrder({ ...buyer, withTool: false })
    await completeOrder(order.id)
    await refundOrder(order.id)
    await refundOrder(order.id)
    expect(await prisma.enrollment.count()).toBe(0)
  })

  it('reembolsar una renovación conserva el acceso pero quita los días que sumó', async () => {
    const first = await createOrder({ ...buyer, withTool: false })
    await completeOrder(first.id)
    const soon = new Date(Date.now() + 10 * DAY)
    await prisma.enrollment.updateMany({ data: { expiresAt: soon } })
    const renewal = await createOrder({
      ...buyer,
      withTool: false,
      renew: 'postres-navidad',
    })
    await completeOrder(renewal.id)

    await refundOrder(renewal.id)
    const enrollment = await prisma.enrollment.findFirstOrThrow()
    expect(
      Math.abs(enrollment.expiresAt.getTime() - soon.getTime()),
    ).toBeLessThan(5000)
  })

  it('no borra el progreso de las lecciones', async () => {
    const order = await createOrder({ ...buyer, withTool: false })
    await completeOrder(order.id)
    const user = await prisma.user.findFirstOrThrow()
    const lesson = await prisma.courseItem.create({
      data: {
        productId: catalog.course.id,
        kind: 'LESSON',
        title: 'Lección',
        position: 0,
      },
    })
    await prisma.lessonProgress.create({
      data: { userId: user.id, itemId: lesson.id },
    })
    await refundOrder(order.id)
    expect(await prisma.lessonProgress.count()).toBe(1)
  })
})
