import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import {
  familyOf,
  ingredientLineCost,
  lineUnits,
  premixLineCost,
  premixSummary,
  recipeBreakdown,
} from '#/lib/cost-engine'
import type { EngineIngredient } from '#/lib/cost-engine'
import {
  hourlyRates,
  normalizeTag,
  premixSchema,
  recipeSchema,
  tagKey,
} from '#/lib/cost-recipes'
import { requireTool } from '#/lib/tool-access'
import { loadSettings } from '#/lib/tool-settings'

// Etiquetas, premezclas y recetas de la herramienta de costos. Todo se limita a la dueña
// (`context.userId`): los ids que llegan del formulario se comprueban contra lo suyo.

const n = (v: { toString: () => string } | null) =>
  v === null ? null : Number(v)

export type IngredientRow = {
  id: string
  name: string
  kind: 'INGREDIENT' | 'PACKAGING'
  price: { toString: () => string }
  quantity: { toString: () => string }
  unit: EngineIngredient['unit']
  flexible: boolean
  sampleCount: number | null
  sampleGrams: { toString: () => string } | null
  wasteEnabled: boolean
  yieldPct: number | null
  archivedAt: Date | null
}

export const toEngine = (i: IngredientRow): EngineIngredient => ({
  price: Number(i.price),
  quantity: Number(i.quantity),
  unit: i.unit,
  flexible: i.flexible,
  sampleCount: i.sampleCount,
  sampleGrams: n(i.sampleGrams),
  wasteEnabled: i.wasteEnabled,
  yieldPct: i.yieldPct,
})

// Un ingrediente como lo necesita el navegador para elegirlo y mostrar su costo.
const ingredientOption = (i: IngredientRow) => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  archived: i.archivedAt !== null,
  ...toEngine(i),
})

type PremixRow = {
  yieldQty: { toString: () => string } | null
  yieldUnit: EngineIngredient['unit']
  lines: {
    quantity: { toString: () => string }
    unit: EngineIngredient['unit']
    ingredient: IngredientRow
  }[]
}

// Lo que cuesta y rinde una premezcla (ver `premixSummary`).
const premixMetrics = (p: PremixRow) =>
  premixSummary(
    p.lines.map((l) => ({
      ingredient: toEngine(l.ingredient),
      quantity: Number(l.quantity),
      unit: l.unit,
    })),
    n(p.yieldQty),
    p.yieldUnit,
  )

// ---------------------------------------------------------------- etiquetas

export const getTags = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const tags = await prisma.costTag.findMany({
      where: { userId: context.userId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { recipes: true } } },
    })
    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      recipes: t._count.recipes,
    }))
  })

// Crea la etiqueta, o la devuelve si ya existe con otras mayúsculas (una archivada se restaura).
const upsertTag = createServerOnlyFn(async (userId: string, raw: string) => {
  const name = normalizeTag(raw)
  if (!name) return null
  const existing = (await prisma.costTag.findMany({ where: { userId } })).find(
    (t) => tagKey(t.name) === tagKey(name),
  )
  if (existing) {
    if (existing.archivedAt) {
      await prisma.costTag.update({
        where: { id: existing.id },
        data: { archivedAt: null },
      })
    }
    return existing.id
  }
  return (await prisma.costTag.create({ data: { userId, name } })).id
})

export const createTag = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ name: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => ({
    id: await upsertTag(context.userId, data.name),
  }))

// Una etiqueta en uso no se borra: se archiva para que ninguna receta se rompa.
export const removeTag = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const tag = await prisma.costTag.findFirst({
      where: { id: data.id, userId: context.userId },
      include: { _count: { select: { recipes: true } } },
    })
    if (!tag) throw notFound()
    if (tag._count.recipes > 0) {
      await prisma.costTag.update({
        where: { id: tag.id },
        data: { archivedAt: new Date() },
      })
      return { archived: true as const }
    }
    await prisma.costTag.delete({ where: { id: tag.id } })
    return { archived: false as const }
  })

// --------------------------------------------------------------- premezclas

const premixInclude = {
  lines: {
    orderBy: { position: 'asc' as const },
    include: { ingredient: true },
  },
}

export const getPremixes = createServerFn()
  .middleware([requireTool])
  .handler(async ({ context }) => {
    const rows = await prisma.costPremix.findMany({
      where: { userId: context.userId },
      orderBy: { name: 'asc' },
      include: premixInclude,
    })
    return rows.map((p) => {
      const m = premixMetrics(p)
      return {
        id: p.id,
        name: p.name,
        archived: p.archivedAt !== null,
        ingredients: p.lines.length,
        yieldQty: n(p.yieldQty),
        yieldUnit: p.yieldUnit,
        perBulk: m.perBulk,
        bulkUnit: m.bulkUnit,
      }
    })
  })

// Ingredientes que se pueden elegir (los archivados solo si la receta o premezcla ya los usa).
export const ingredientChoices = createServerOnlyFn(
  async (userId: string, keepIds: string[]) => {
    const rows = await prisma.costIngredient.findMany({
      where: {
        userId,
        OR: [{ archivedAt: null }, { id: { in: keepIds } }],
      },
      orderBy: { name: 'asc' },
    })
    return rows.map(ingredientOption)
  },
)

export const getPremix = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const row = data.id
      ? await prisma.costPremix.findFirst({
          where: { id: data.id, userId: context.userId },
          include: {
            ...premixInclude,
            _count: { select: { usedBy: true } },
          },
        })
      : null
    if (data.id && !row) throw notFound()
    const ingredients = await ingredientChoices(
      context.userId,
      row?.lines.map((l) => l.ingredientId) ?? [],
    )
    return {
      premix: row && {
        id: row.id,
        name: row.name,
        archived: row.archivedAt !== null,
        yieldQty: n(row.yieldQty),
        yieldUnit: row.yieldUnit,
        lines: row.lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: Number(l.quantity),
          unit: l.unit,
        })),
        usedBy: row._count.usedBy,
      },
      ingredients,
    }
  })

export const savePremix = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable(), values: premixSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const ids = [...new Set(values.lines.map((l) => l.ingredientId))]
    const owned = await prisma.costIngredient.findMany({
      where: { userId: context.userId, id: { in: ids } },
    })
    if (owned.length !== ids.length) {
      return { error: 'Hay un ingrediente que no existe.' }
    }
    const byId = new Map(owned.map((i) => [i.id, i]))
    for (const l of values.lines) {
      const ing = toEngine(byId.get(l.ingredientId)!)
      if (!lineUnits(ing).includes(l.unit)) {
        return {
          error: `La unidad de ${byId.get(l.ingredientId)!.name} no corresponde a como lo compras.`,
        }
      }
    }
    const lines = values.lines.map((l, position) => ({ ...l, position }))
    const fields = {
      name: values.name,
      yieldQty: values.yieldQty,
      yieldUnit: values.yieldUnit,
    }
    if (data.id) {
      const found = await prisma.costPremix.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true },
      })
      if (!found) throw notFound()
      await prisma.$transaction([
        prisma.costPremixLine.deleteMany({ where: { premixId: data.id } }),
        prisma.costPremix.update({
          where: { id: data.id },
          data: { ...fields, lines: { create: lines } },
        }),
      ])
      return { id: data.id }
    }
    const created = await prisma.costPremix.create({
      data: { ...fields, userId: context.userId, lines: { create: lines } },
    })
    return { id: created.id }
  })

export const setPremixArchived = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costPremix.updateMany({
      where: { id: data.id, userId: context.userId },
      data: { archivedAt: data.archived ? new Date() : null },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// ------------------------------------------------------------------ recetas

// Las premezclas como las necesita una receta para costear lo que usa de ellas.
const premixOptions = createServerOnlyFn(
  async (userId: string, keepIds: string[]) => {
    const rows = await prisma.costPremix.findMany({
      where: {
        userId,
        OR: [{ archivedAt: null }, { id: { in: keepIds } }],
      },
      orderBy: { name: 'asc' },
      include: premixInclude,
    })
    return rows.map((p) => {
      const m = premixMetrics(p)
      return {
        id: p.id,
        name: p.name,
        archived: p.archivedAt !== null,
        family: m.family,
        perBase: m.perBase,
        yieldUnit: p.yieldUnit,
      }
    })
  },
)

type RecipeWithLines = {
  yieldPieces: number | null
  laborHours: { toString: () => string } | null
  ovenHours: { toString: () => string } | null
  includeLabor: boolean
  includeFixed: boolean
  includeWaste: boolean
  wastePct: { toString: () => string } | null
  lines: {
    quantity: { toString: () => string }
    unit: EngineIngredient['unit']
    ingredient: IngredientRow | null
    premixId: string | null
  }[]
}

// Cuánto cuesta hacer una receta con los costos del momento (se calcula siempre al vuelo).
function recipeCost(
  r: RecipeWithLines,
  premixes: Map<
    string,
    { family: 'weight' | 'volume' | 'piece'; perBase: number | null }
  >,
  rates: ReturnType<typeof hourlyRates>,
) {
  let ingredients = 0
  for (const l of r.lines) {
    const quantity = Number(l.quantity)
    if (l.ingredient) {
      ingredients +=
        ingredientLineCost(toEngine(l.ingredient), quantity, l.unit) ?? 0
    } else if (l.premixId) {
      const p = premixes.get(l.premixId)
      if (p) {
        ingredients +=
          premixLineCost(p.perBase, p.family, quantity, l.unit) ?? 0
      }
    }
  }
  return recipeBreakdown({
    ingredients,
    includeWaste: r.includeWaste,
    wastePct: n(r.wastePct),
    includeLabor: r.includeLabor,
    laborHours: n(r.laborHours),
    laborPerHour: rates.laborPerHour,
    includeFixed: r.includeFixed,
    ovenHours: n(r.ovenHours),
    fixedPerHour: rates.fixedPerHour,
    yieldPieces: r.yieldPieces,
  })
}

const recipeInclude = {
  tag: true,
  lines: {
    orderBy: { position: 'asc' as const },
    include: { ingredient: true },
  },
}

// El costo de cada receta de la alumna con lo que tiene hoy (ingredientes, premezclas y ajustes).
// Lo usan la lista de recetas y los productos, que se calculan sobre ellas.
export const loadRecipeCosts = createServerOnlyFn(
  async (userId: string, ids?: string[]) => {
    const [recipes, premixes, settings] = await Promise.all([
      prisma.costRecipe.findMany({
        where: { userId, ...(ids ? { id: { in: ids } } : {}) },
        orderBy: { name: 'asc' },
        include: recipeInclude,
      }),
      prisma.costPremix.findMany({
        where: { userId },
        include: premixInclude,
      }),
      loadSettings(userId),
    ])
    const rates = hourlyRates(settings)
    const premixMap = new Map(
      premixes.map((p) => {
        const m = premixMetrics(p)
        return [p.id, { family: m.family, perBase: m.perBase }] as const
      }),
    )
    return recipes.map((r) => {
      const empty = r.lines.length === 0
      const b = recipeCost(r, premixMap, rates)
      return {
        id: r.id,
        name: r.name,
        tag: r.tag?.name ?? null,
        archived: r.archivedAt !== null,
        yieldPieces: r.yieldPieces,
        empty,
        total: empty ? null : b.total,
        // Solo lo que lleva de ingredientes y premezclas (sin merma, mano de obra ni gasto fijo).
        ingredients: b.ingredients,
        // Lo que suman la mano de obra y el gasto fijo, y las horas de cada uno (para Producción).
        labor: b.labor ?? 0,
        fixed: b.fixed ?? 0,
        laborHours: n(r.laborHours) ?? 0,
        ovenHours: n(r.ovenHours) ?? 0,
      }
    })
  },
)

export const getRecipes = createServerFn()
  .middleware([requireTool])
  .handler(({ context }) => loadRecipeCosts(context.userId))

// Todo lo que necesita el formulario de una receta (nueva si `id` es null).
export const getRecipeForm = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const row = data.id
      ? await prisma.costRecipe.findFirst({
          where: { id: data.id, userId: context.userId },
          include: recipeInclude,
        })
      : null
    if (data.id && !row) throw notFound()
    const keepIngredients =
      row?.lines.flatMap((l) => (l.ingredientId ? [l.ingredientId] : [])) ?? []
    const keepPremixes =
      row?.lines.flatMap((l) => (l.premixId ? [l.premixId] : [])) ?? []
    const [ingredients, premixes, settings, tags] = await Promise.all([
      ingredientChoices(context.userId, keepIngredients),
      premixOptions(context.userId, keepPremixes),
      loadSettings(context.userId),
      prisma.costTag.findMany({
        where: { userId: context.userId, archivedAt: null },
        orderBy: { name: 'asc' },
        select: { name: true },
      }),
    ])
    return {
      recipe: row && {
        id: row.id,
        name: row.name,
        tagName: row.tag?.name ?? '',
        archived: row.archivedAt !== null,
        yieldPieces: row.yieldPieces,
        laborHours: n(row.laborHours),
        ovenHours: n(row.ovenHours),
        includeLabor: row.includeLabor,
        includeFixed: row.includeFixed,
        includeWaste: row.includeWaste,
        wastePct: n(row.wastePct),
        lines: row.lines.map((l) => ({
          kind: l.ingredientId ? ('ingredient' as const) : ('premix' as const),
          refId: (l.ingredientId ?? l.premixId)!,
          quantity: Number(l.quantity),
          unit: l.unit,
        })),
      },
      ingredients,
      premixes,
      rates: hourlyRates(settings),
      tags: tags.map((t) => t.name),
    }
  })

export const saveRecipe = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string().nullable(), values: recipeSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const ingredientIds = [
      ...new Set(
        values.lines.filter((l) => l.kind === 'ingredient').map((l) => l.refId),
      ),
    ]
    const premixIds = [
      ...new Set(
        values.lines.filter((l) => l.kind === 'premix').map((l) => l.refId),
      ),
    ]
    const [ingredients, premixes] = await Promise.all([
      prisma.costIngredient.findMany({
        where: { userId: context.userId, id: { in: ingredientIds } },
      }),
      prisma.costPremix.findMany({
        where: { userId: context.userId, id: { in: premixIds } },
      }),
    ])
    if (
      ingredients.length !== ingredientIds.length ||
      premixes.length !== premixIds.length
    ) {
      return { error: 'Hay un ingrediente o una premezcla que no existe.' }
    }
    const ingById = new Map(ingredients.map((i) => [i.id, i]))
    const premixById = new Map(premixes.map((p) => [p.id, p]))
    for (const l of values.lines) {
      if (l.kind === 'ingredient') {
        const ing = ingById.get(l.refId)!
        if (!lineUnits(toEngine(ing)).includes(l.unit)) {
          return {
            error: `La unidad de ${ing.name} no corresponde a como lo compras.`,
          }
        }
      } else {
        const premix = premixById.get(l.refId)!
        if (familyOf(l.unit) !== familyOf(premix.yieldUnit)) {
          return {
            error: `La unidad de ${premix.name} no corresponde a lo que rinde.`,
          }
        }
      }
    }
    const tagId = await upsertTag(context.userId, values.tagName)
    const lines = values.lines.map((l, position) => ({
      position,
      quantity: l.quantity,
      unit: l.unit,
      ingredientId: l.kind === 'ingredient' ? l.refId : null,
      premixId: l.kind === 'premix' ? l.refId : null,
    }))
    const fields = {
      name: values.name,
      tagId,
      yieldPieces: values.yieldPieces,
      laborHours: values.laborHours,
      ovenHours: values.ovenHours,
      includeLabor: values.includeLabor,
      includeFixed: values.includeFixed,
      includeWaste: values.includeWaste,
      wastePct: values.wastePct,
    }
    if (data.id) {
      const found = await prisma.costRecipe.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true },
      })
      if (!found) throw notFound()
      await prisma.$transaction([
        prisma.costRecipeLine.deleteMany({ where: { recipeId: data.id } }),
        prisma.costRecipe.update({
          where: { id: data.id },
          data: { ...fields, lines: { create: lines } },
        }),
      ])
      return { id: data.id }
    }
    const created = await prisma.costRecipe.create({
      data: { ...fields, userId: context.userId, lines: { create: lines } },
    })
    return { id: created.id }
  })

export const setRecipeArchived = createServerFn({ method: 'POST' })
  .middleware([requireTool])
  .validator(z.object({ id: z.string(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await prisma.costRecipe.updateMany({
      where: { id: data.id, userId: context.userId },
      data: { archivedAt: data.archived ? new Date() : null },
    })
    if (result.count === 0) throw notFound()
    return { ok: true as const }
  })

// ------------------------------------------------------- uso de ingredientes

// Cuántas recetas y premezclas (sin archivar) usan un ingrediente: para avisar antes de archivarlo.
export const getIngredientUsage = createServerFn()
  .middleware([requireTool])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const [recipes, premixes] = await Promise.all([
      prisma.costRecipe.count({
        where: {
          userId: context.userId,
          archivedAt: null,
          lines: { some: { ingredientId: data.id } },
        },
      }),
      prisma.costPremix.count({
        where: {
          userId: context.userId,
          archivedAt: null,
          lines: { some: { ingredientId: data.id } },
        },
      }),
    ])
    return { recipes, premixes }
  })
