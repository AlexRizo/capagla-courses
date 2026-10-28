import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { loadTier } from '#/lib/tool-access'
import {
  ADMIN_TIER,
  FULL_TIER,
  atLimit,
  bestTier,
  hasModule,
  limitMessage,
} from '#/lib/tool-tiers'
import type { ToolModuleKey, ToolTierInfo } from '#/lib/tool-tiers'
import { countItems, limitError } from '#/lib/tool-usage'
import { resetDb } from '#/test/db'

const basico: ToolTierInfo = {
  name: 'Básico',
  rank: 1,
  itemLimit: 150,
  quoteDays: 90,
  modules: [],
}

describe('reglas de los niveles', () => {
  it('el básico no abre ningún módulo extra y el completo abre los cuatro', () => {
    expect(hasModule(basico, 'PRODUCTION')).toBe(false)
    expect(hasModule(basico, 'QUOTES')).toBe(false)
    for (const m of FULL_TIER.modules)
      expect(hasModule(FULL_TIER, m)).toBe(true)
    expect(FULL_TIER.modules).toHaveLength(4)
  })

  it('con varias inscripciones cuenta el nivel más alto', () => {
    expect(bestTier([basico, FULL_TIER])?.name).toBe('Completo')
    expect(bestTier([FULL_TIER, basico])?.name).toBe('Completo')
    expect(bestTier([])).toBeNull()
  })

  it('el límite se alcanza al llegar al número, no antes', () => {
    expect(atLimit(149, basico)).toBe(false)
    expect(atLimit(150, basico)).toBe(true)
    expect(limitMessage(basico)).toMatch(/150 elementos/)
  })

  it('la administradora lo tiene todo y sin tope práctico', () => {
    expect(ADMIN_TIER.modules).toHaveLength(4)
    expect(atLimit(5000, ADMIN_TIER)).toBe(false)
  })
})

describe('nivel y uso de una alumna', () => {
  beforeEach(resetDb)

  async function setup() {
    const user = await prisma.user.create({
      data: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        emailVerified: true,
      },
    })
    const tool = (
      slug: string,
      rank: number,
      limit: number,
      modules: ToolModuleKey[],
    ) =>
      prisma.product.create({
        data: {
          slug,
          name: slug,
          kind: 'TOOL',
          priceMxn: 100,
          status: 'PUBLISHED',
          tier: { create: { rank, itemLimit: limit, modules } },
        },
      })
    return { user, tool }
  }

  const later = () => new Date(Date.now() + 86_400_000)

  it('sin inscripción a una herramienta no hay nivel', async () => {
    const { user } = await setup()
    expect(await loadTier(user.id, 'USER')).toBeNull()
  })

  it('con el básico vigente: sus módulos y su límite', async () => {
    const { user, tool } = await setup()
    const product = await tool('basico', 1, 150, [])
    await prisma.enrollment.create({
      data: { userId: user.id, productId: product.id, expiresAt: later() },
    })
    const tier = await loadTier(user.id, 'USER')
    expect(tier?.rank).toBe(1)
    expect(tier?.itemLimit).toBe(150)
    expect(tier?.modules).toEqual([])
  })

  it('con el básico y el completo vigentes, manda el completo', async () => {
    const { user, tool } = await setup()
    const b = await tool('basico', 1, 150, [])
    const c = await tool('completo', 2, 1000, ['QUOTES'])
    for (const p of [b, c]) {
      await prisma.enrollment.create({
        data: { userId: user.id, productId: p.id, expiresAt: later() },
      })
    }
    expect((await loadTier(user.id, 'USER'))?.rank).toBe(2)
  })

  it('un nivel vencido ya no cuenta', async () => {
    const { user, tool } = await setup()
    const product = await tool('basico', 1, 150, [])
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        productId: product.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    expect(await loadTier(user.id, 'USER')).toBeNull()
  })

  it('una administradora siempre tiene acceso', async () => {
    const { user } = await setup()
    expect((await loadTier(user.id, 'ADMIN'))?.name).toBe('Administradora')
  })

  it('un producto sin nivel se trata como el completo', async () => {
    const { user } = await setup()
    const product = await prisma.product.create({
      data: {
        slug: 'sin-nivel',
        name: 'Sin nivel',
        kind: 'TOOL',
        priceMxn: 200,
        status: 'PUBLISHED',
      },
    })
    await prisma.enrollment.create({
      data: { userId: user.id, productId: product.id, expiresAt: later() },
    })
    const tier = await loadTier(user.id, 'USER')
    expect(tier?.modules).toHaveLength(4)
    expect(tier?.itemLimit).toBe(1000)
  })

  it('cuenta ingredientes, premezclas, recetas, productos y cotizaciones sin archivar', async () => {
    const { user } = await setup()
    const base = { userId: user.id }
    await prisma.costIngredient.createMany({
      data: [
        { ...base, name: 'Harina', price: 13, quantity: 1000, unit: 'G' },
        {
          ...base,
          name: 'Vieja',
          price: 1,
          quantity: 1,
          unit: 'G',
          archivedAt: new Date(),
        },
      ],
    })
    expect(await countItems(user.id)).toBe(1)
    await prisma.costProduct.create({ data: { ...base, name: 'Pastel' } })
    expect(await countItems(user.id)).toBe(2)
  })

  it('al llegar al límite avisa; con lugar no', async () => {
    const { user } = await setup()
    await prisma.costProduct.create({ data: { userId: user.id, name: 'A' } })
    expect(await limitError(user.id, { ...basico, itemLimit: 2 })).toBeNull()
    await prisma.costProduct.create({ data: { userId: user.id, name: 'B' } })
    expect(await limitError(user.id, { ...basico, itemLimit: 2 })).toMatch(
      /límite de 2 elementos/,
    )
  })
})
