import type { Prisma } from '@prisma/client'
import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { ingredientLineCost, lineUnits } from '#/lib/cost-engine'
import { productSchema, productSummary } from '#/lib/cost-product'
import { requireTool } from '#/lib/tool-access'
import {
  ingredientChoices,
  loadRecipeCosts,
  toEngine,
} from '#/lib/tool-recipes'
import { loadSettings } from '#/lib/tool-settings'

// Productos de la herramienta de costos: lo que se vende (recetas + empaque + precio). Todo se
// limita a la dueña (`context.userId`); los ids del formulario se comprueban contra lo suyo.

const n = (v: { toString: () => string } | null) =>
  v === null ? null : Number(v)

const include = {
  recipes: { orderBy: { position: 'asc' as const } },
  packaging: {
    orderBy: { position: 'asc' as const },
    include: { ingredient: true },
  },
}

// Un tipo de Prisma (no `typeof prisma`): una referencia a `prisma`, aunque sea de tipos, hace que el
// compilador deje el import de la base de datos en el navegador.
type ProductRow = Prisma.CostProductGetPayload<{ include: typeof include }>

// Lo que cuestan y valen el entero y la rebanada de un producto, con las recetas y ajustes de hoy.
const summarize = createServerOnlyFn(
  (
    p: ProductRow,
    costs: Map<string, Awaited<ReturnType<typeof loadRecipeCosts>>[number]>,
    settings: Awaited<ReturnType<typeof loadSettings>>,
  ) => {
    const packaging = (scope: 'WHOLE' | 'SLICE') =>
      p.packaging
        .filter((l) => l.scope === scope)
        .reduce(
          (sum, l) =>
            sum +
            (ingredientLineCost(
              toEngine(l.ingredient),
              Number(l.quantity),
              l.unit,
            ) ?? 0),
          0,
        )
    return productSummary({
      recipes: p.recipes.map((r) => {
        const c = costs.get(r.recipeId)
        return {
          total: c?.total ?? null,
          ingredients: c?.ingredients ?? 0,
          empty: c?.empty ?? true,
        }
      }),
      packagingWhole: packaging('WHOLE'),
      packagingSlice: packaging('SLICE'),
      sellsSlices: p.sellsSlices,
      slicesPerPiece: p.slicesPerPiece,
      price: n(p.price),
      slicePrice: n(p.slicePrice),
      multiplier: settings.multiplier,
      priceBase: settings.priceBase,
      taxPct: settings.taxPct,
      withTax: p.withTax,
    })
  },
)

export const getProducts = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const [products, costs, settings] = await Promise.all([
      prisma.costProduct.findMany({
        where: { userId: context.userId },
        orderBy: { name: 'asc' },
        include,
      }),
      loadRecipeCosts(context.userId),
      loadSettings(context.userId),
    ])
    const byId = new Map(costs.map((c) => [c.id, c]))
    return products.map((p) => {
      const s = summarize(p, byId, settings)
      return {
        id: p.id,
        name: p.name,
        archived: p.archivedAt !== null,
        recipes: p.recipes.map((r) => byId.get(r.recipeId)?.name ?? '—'),
        slices: p.sellsSlices ? p.slicesPerPiece : null,
        cost: s.incomplete ? null : s.whole.cost,
        price: n(p.price),
        gain: s.whole.margin && {
          amount: s.whole.margin.gain,
          pct: s.whole.margin.gainPct,
        },
        verdict: s.whole.verdict,
        incomplete: s.incomplete,
      }
    })
  })

// Todo lo que necesita el formulario de un producto (nuevo si `id` es null).
export const getProductForm = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const row = data.id
      ? await prisma.costProduct.findFirst({
          where: { id: data.id, userId: context.userId },
          include,
        })
      : null
    if (data.id && !row) throw notFound()
    const keepRecipes = new Set(row?.recipes.map((r) => r.recipeId))
    const keepPackaging = row?.packaging.map((l) => l.ingredientId) ?? []
    const [recipes, packaging, settings] = await Promise.all([
      loadRecipeCosts(context.userId),
      ingredientChoices(context.userId, keepPackaging),
      loadSettings(context.userId),
    ])
    return {
      product: row && {
        id: row.id,
        name: row.name,
        archived: row.archivedAt !== null,
        price: n(row.price),
        sellsSlices: row.sellsSlices,
        slicesPerPiece: row.slicesPerPiece,
        slicePrice: n(row.slicePrice),
        withTax: row.withTax,
        recipes: row.recipes.map((r) => ({
          recipeId: r.recipeId,
          piecesSold: r.piecesSold,
        })),
        packaging: row.packaging.map((l) => ({
          scope: l.scope,
          ingredientId: l.ingredientId,
          quantity: Number(l.quantity),
          unit: l.unit,
        })),
      },
      // Las recetas archivadas solo se ofrecen si el producto ya las usa.
      recipes: recipes.filter((r) => !r.archived || keepRecipes.has(r.id)),
      packaging: packaging.filter((i) => i.kind === 'PACKAGING'),
      settings: {
        multiplier: settings.multiplier,
        priceBase: settings.priceBase,
        taxPct: settings.taxPct,
        sellsAsBusiness: settings.sellsAsBusiness,
      },
    }
  })

export const saveProduct = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable(), values: productSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const recipeIds = values.recipes.map((r) => r.recipeId)
    if (new Set(recipeIds).size !== recipeIds.length) {
      return { error: 'Una receta solo puede estar una vez en el producto.' }
    }
    const ingredientIds = [
      ...new Set(values.packaging.map((p) => p.ingredientId)),
    ]
    const [recipes, ingredients] = await Promise.all([
      prisma.costRecipe.findMany({
        where: { userId: context.userId, id: { in: recipeIds } },
      }),
      prisma.costIngredient.findMany({
        where: { userId: context.userId, id: { in: ingredientIds } },
      }),
    ])
    if (
      recipes.length !== recipeIds.length ||
      ingredients.length !== ingredientIds.length
    ) {
      return { error: 'Hay una receta o un empaque que no existe.' }
    }
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    for (const r of values.recipes) {
      const yieldPieces = recipeById.get(r.recipeId)!.yieldPieces
      if (yieldPieces && r.piecesSold > yieldPieces) {
        return {
          error: `${recipeById.get(r.recipeId)!.name} rinde ${yieldPieces}: no puedes vender más piezas.`,
        }
      }
    }
    const byId = new Map(ingredients.map((i) => [i.id, i]))
    for (const p of values.packaging) {
      const ing = byId.get(p.ingredientId)!
      if (ing.kind !== 'PACKAGING') {
        return { error: `${ing.name} no es un empaque.` }
      }
      if (!lineUnits(toEngine(ing)).includes(p.unit)) {
        return {
          error: `La unidad de ${ing.name} no corresponde a como lo compras.`,
        }
      }
    }
    // El múltiplo vive en Ajustes: si se cambió aquí, se guarda allá.
    if (values.multiplier !== null) {
      await prisma.costSettings.upsert({
        where: { userId: context.userId },
        create: { userId: context.userId, multiplier: values.multiplier },
        update: { multiplier: values.multiplier },
      })
    }
    const fields = {
      name: values.name,
      price: values.price,
      sellsSlices: values.sellsSlices,
      slicesPerPiece: values.slicesPerPiece,
      slicePrice: values.slicePrice,
      withTax: values.withTax,
    }
    const recipeRows = values.recipes.map((r, position) => ({ ...r, position }))
    const packagingRows = values.packaging.map((p, position) => ({
      ...p,
      position,
    }))
    if (data.id) {
      const found = await prisma.costProduct.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true },
      })
      if (!found) throw notFound()
      await prisma.$transaction([
        prisma.costProductRecipe.deleteMany({ where: { productId: data.id } }),
        prisma.costProductPackaging.deleteMany({
          where: { productId: data.id },
        }),
        prisma.costProduct.update({
          where: { id: data.id },
          data: {
            ...fields,
            recipes: { create: recipeRows },
            packaging: { create: packagingRows },
          },
        }),
      ])
      return { id: data.id }
    }
    const created = await prisma.costProduct.create({
      data: {
        ...fields,
        userId: context.userId,
        recipes: { create: recipeRows },
        packaging: { create: packagingRows },
      },
    })
    return { id: created.id }
  })

export const setProductArchived = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costProduct.updateMany({
      where: { id: data.id, userId: context.userId },
      data: { archivedAt: data.archived ? new Date() : null },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// Cuántos productos (sin archivar) usan una receta: para avisar antes de archivarla.
export const getRecipeUsage = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => ({
    products: await prisma.costProduct.count({
      where: {
        userId: context.userId,
        archivedAt: null,
        recipes: { some: { recipeId: data.id } },
      },
    }),
  }))
