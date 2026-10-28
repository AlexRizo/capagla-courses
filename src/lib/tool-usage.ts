import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { requireTool } from '#/lib/tool-access'
import { atLimit, limitMessage } from '#/lib/tool-tiers'
import type { ToolTierInfo } from '#/lib/tool-tiers'

// Cuántos elementos guarda una alumna: ingredientes, premezclas, recetas y productos (sin
// archivar) y cotizaciones. Las producciones y las listas de compra no cuentan: se borran solas.
export const countItems = createServerOnlyFn(async (userId: string) => {
  const live = { userId, archivedAt: null }
  const [ingredients, premixes, recipes, products, quotes] = await Promise.all([
    prisma.costIngredient.count({ where: live }),
    prisma.costPremix.count({ where: live }),
    prisma.costRecipe.count({ where: live }),
    prisma.costProduct.count({ where: live }),
    prisma.costQuote.count({ where: { userId } }),
  ])
  return ingredients + premixes + recipes + products + quotes
})

// Antes de crear algo nuevo: el mensaje si ya llegó al límite de su nivel, o null si hay lugar.
export const limitError = createServerOnlyFn(
  async (userId: string, tier: ToolTierInfo) =>
    atLimit(await countItems(userId), tier) ? limitMessage(tier) : null,
)

// Para el marco de la herramienta: su nivel y cuánto lleva guardado.
export const getToolUsage = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => ({
    tier: context.tier,
    used: await countItems(context.userId),
  }))
