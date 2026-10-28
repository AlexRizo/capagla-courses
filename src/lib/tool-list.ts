import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { lineUnits } from '#/lib/cost-engine'
import { COST_UNITS } from '#/lib/costs'
import { listRow, manualBase, neededBase } from '#/lib/cost-shopping'
import { requireModule } from '#/lib/tool-access'
import { toEngine } from '#/lib/tool-recipes'
import type { IngredientRow } from '#/lib/tool-recipes'

// Lista de compra de la herramienta de costos. Lo que hay que comprar se calcula de la producción
// (con las recetas, premezclas y empaques de hoy); aquí solo se guarda lo que la alumna decide:
// el orden, el lugar de hoy, "Ya lo tengo", lo comprado y lo agregado a mano. Todo se limita a la
// dueña (`context.userId`).

const NONE = 'none'

// Cuánto hace falta de cada ingrediente para una producción, en la unidad base de como se compra.
const productionNeeds = createServerOnlyFn(
  async (userId: string, productionId: string) => {
    const production = await prisma.costProduction.findFirst({
      where: { id: productionId, userId },
      include: { items: true },
    })
    if (!production) throw notFound()
    const [products, ingredients, premixes] = await Promise.all([
      prisma.costProduct.findMany({
        where: { userId, id: { in: production.items.map((i) => i.productId) } },
        include: { recipes: true, packaging: true },
      }),
      prisma.costIngredient.findMany({ where: { userId } }),
      prisma.costPremix.findMany({
        where: { userId },
        include: { lines: true },
      }),
    ])
    const recipeIds = [
      ...new Set(products.flatMap((p) => p.recipes.map((r) => r.recipeId))),
    ]
    const recipes = await prisma.costRecipe.findMany({
      where: { userId, id: { in: recipeIds } },
      include: { lines: true },
    })
    const ing = new Map(ingredients.map((i) => [i.id, toEngine(i)]))
    const premixById = new Map(premixes.map((p) => [p.id, p]))
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    const productById = new Map(products.map((p) => [p.id, p]))
    const needs = new Map<string, number>()
    const add = (id: string, amount: number | null) => {
      if (amount) needs.set(id, (needs.get(id) ?? 0) + amount)
    }
    const addLine = (
      id: string,
      quantity: number,
      unit: IngredientRow['unit'],
      times: number,
    ) => {
      const e = ing.get(id)
      if (e) add(id, (neededBase(e, quantity, unit) ?? 0) * times)
    }

    for (const item of production.items) {
      const product = productById.get(item.productId)
      if (!product) continue
      for (const r of product.recipes) {
        for (const l of recipeById.get(r.recipeId)?.lines ?? []) {
          const quantity = Number(l.quantity)
          if (l.ingredientId) {
            addLine(l.ingredientId, quantity, l.unit, item.quantity)
          } else if (l.premixId) {
            // Una premezcla se reparte entre sus ingredientes según lo que rinde de verdad.
            const premix = premixById.get(l.premixId)
            const yieldBase = premix?.yieldQty
              ? Number(premix.yieldQty) * familyFactor(premix.yieldUnit)
              : 0
            if (!premix || !yieldBase) continue
            const used = quantity * familyFactor(l.unit)
            for (const pl of premix.lines) {
              addLine(
                pl.ingredientId,
                Number(pl.quantity),
                pl.unit,
                item.quantity * (used / yieldBase),
              )
            }
          }
        }
      }
      for (const p of product.packaging.filter((x) => x.scope === 'WHOLE')) {
        addLine(p.ingredientId, Number(p.quantity), p.unit, item.quantity)
      }
    }
    return {
      needs,
      production,
      summary: production.items.flatMap((i) => {
        const product = productById.get(i.productId)
        return product ? [`${product.name} ×${i.quantity}`] : []
      }),
    }
  },
)

// Factor a la unidad base (g o ml) de una unidad de peso o volumen.
const familyFactor = (unit: IngredientRow['unit']) =>
  unit === 'KG' || unit === 'L' ? 1000 : 1

export const getList = createServerFn()
  .middleware([requireModule('SHOPPING_LIST')])
  .validator(z.object({ productionId: z.string().nullable() }))
  .handler(async ({ data, context }) => {
    const userId = context.userId
    const [list, ingredients, places, produced] = await Promise.all([
      prisma.costList.findFirst({
        where: { userId, productionId: data.productionId },
        include: { entries: true },
      }),
      prisma.costIngredient.findMany({
        where: { userId },
        include: { place: true },
        orderBy: { name: 'asc' },
      }),
      prisma.costPlace.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      data.productionId
        ? productionNeeds(userId, data.productionId)
        : Promise.resolve(null),
    ])
    const entries = new Map(list?.entries.map((e) => [e.ingredientId, e]))
    const placeIds = new Set(places.map((p) => p.id))
    const needs = produced?.needs ?? new Map<string, number>()

    // Entran la lista lo que pide la producción y lo agregado a mano.
    const wanted = ingredients.filter(
      (i) =>
        (needs.get(i.id) ?? 0) > 0 ||
        Number(entries.get(i.id)?.manualAmount ?? 0) > 0,
    )
    const known = wanted
      .filter((i) => entries.has(i.id))
      .sort((a, b) => entries.get(a.id)!.position - entries.get(b.id)!.position)
    const fresh = wanted.filter((i) => !entries.has(i.id))
    const rows = [...known, ...fresh].map((i) => {
      const e = entries.get(i.id)
      const prod = needs.get(i.id) ?? 0
      const manual = Number(e?.manualAmount ?? 0)
      const r = listRow(toEngine(i), prod, manual)
      const fallback = i.placeId && placeIds.has(i.placeId) ? i.placeId : NONE
      const placeKey =
        e?.placeKey && (e.placeKey === NONE || placeIds.has(e.placeKey))
          ? e.placeKey
          : fallback
      return {
        ingredientId: i.id,
        name: i.name,
        kind: i.kind,
        placeKey,
        needLabel: r.needLabel,
        buyLabel: r.buyLabel,
        cost: r.cost,
        origin: { production: prod > 0, manual: manual > 0 },
        manualAmount: manual,
        haveIt: e?.haveIt ?? false,
        bought: e?.bought ?? false,
      }
    })
    return {
      production: produced && {
        id: produced.production.id,
        name: produced.production.name,
        summary: produced.summary,
      },
      rows,
      places: places.map((p) => ({ id: p.id, name: p.name })),
      // Lo que se puede agregar a mano.
      choices: ingredients
        .filter((i) => i.archivedAt === null)
        .map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
          // Piezas primero: la lista de compra de un huevo se cuenta en piezas.
          units: lineUnits(toEngine(i)).sort(
            (a, b) => Number(b === 'PZA') - Number(a === 'PZA'),
          ),
        })),
    }
  })

// Guarda lo que la alumna decidió de cada renglón, en el orden en que está. Lo agregado a mano no
// lo manda el navegador: se conserva lo que ya hay.
export const saveListState = createServerFn({ method: 'POST' })
  .middleware([requireModule('SHOPPING_LIST')])
  .validator(
    z.object({
      productionId: z.string().nullable(),
      entries: z
        .array(
          z.object({
            ingredientId: z.string().min(1),
            placeKey: z.string().nullable(),
            haveIt: z.boolean(),
            bought: z.boolean(),
          }),
        )
        .max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    const ids = data.entries.map((e) => e.ingredientId)
    const [owned, places] = await Promise.all([
      prisma.costIngredient.count({
        where: { userId: context.userId, id: { in: [...new Set(ids)] } },
      }),
      prisma.costPlace.findMany({
        where: { userId: context.userId },
        select: { id: true },
      }),
    ])
    if (owned !== new Set(ids).size) {
      return { error: 'Hay un ingrediente que no existe.' }
    }
    // La lista se crea al guardar por primera vez, y solo si lo que llega es válido.
    const list = await ensureList(context.userId, data.productionId)
    const current = await prisma.costListEntry.findMany({
      where: { listId: list.id },
    })
    const placeIds = new Set(places.map((p) => p.id))
    const manual = new Map(current.map((e) => [e.ingredientId, e.manualAmount]))
    const rows = data.entries.map((e, position) => ({
      listId: list.id,
      ingredientId: e.ingredientId,
      position,
      placeKey:
        e.placeKey && (e.placeKey === NONE || placeIds.has(e.placeKey))
          ? e.placeKey
          : null,
      haveIt: e.haveIt,
      bought: e.bought,
      manualAmount: manual.get(e.ingredientId) ?? 0,
    }))
    await prisma.$transaction([
      prisma.costListEntry.deleteMany({ where: { listId: list.id } }),
      prisma.costListEntry.createMany({ data: rows }),
    ])
    return { ok: true as const }
  })

// La lista de la producción (o la directa) se crea al guardar algo por primera vez.
const ensureList = createServerOnlyFn(
  async (userId: string, productionId: string | null) => {
    if (productionId) {
      const own = await prisma.costProduction.count({
        where: { id: productionId, userId },
      })
      if (!own) throw notFound()
    }
    const found = await prisma.costList.findFirst({
      where: { userId, productionId },
    })
    return found ?? prisma.costList.create({ data: { userId, productionId } })
  },
)

// "Agregar a la lista": la cantidad que hace falta de un ingrediente (en kg, g, ml, l o piezas),
// por si necesita algo que no sale de la producción. No se redondea a paquetes.
export const addManualItem = createServerFn({ method: 'POST' })
  .middleware([requireModule('SHOPPING_LIST')])
  .validator(
    z.object({
      productionId: z.string().nullable(),
      ingredientId: z.string().min(1),
      quantity: z.number().positive('Escribe una cantidad.').max(1_000_000),
      unit: z.enum(COST_UNITS),
    }),
  )
  .handler(async ({ data, context }) => {
    const ingredient = await prisma.costIngredient.findFirst({
      where: { id: data.ingredientId, userId: context.userId },
    })
    if (!ingredient) return { error: 'Ese ingrediente no existe.' }
    const amount = manualBase(toEngine(ingredient), data.quantity, data.unit)
    if (amount === null) {
      return { error: 'Esa unidad no sirve para este ingrediente.' }
    }
    const list = await ensureList(context.userId, data.productionId)
    const last = await prisma.costListEntry.aggregate({
      where: { listId: list.id },
      _max: { position: true },
    })
    await prisma.costListEntry.upsert({
      where: {
        listId_ingredientId: {
          listId: list.id,
          ingredientId: data.ingredientId,
        },
      },
      create: {
        listId: list.id,
        ingredientId: data.ingredientId,
        position: (last._max.position ?? -1) + 1,
        manualAmount: amount,
      },
      update: { manualAmount: { increment: amount } },
    })
    return { ok: true as const }
  })

export const removeManualItem = createServerFn({ method: 'POST' })
  .middleware([requireModule('SHOPPING_LIST')])
  .validator(
    z.object({ productionId: z.string().nullable(), ingredientId: z.string() }),
  )
  .handler(async ({ data, context }) => {
    const list = await prisma.costList.findFirst({
      where: { userId: context.userId, productionId: data.productionId },
    })
    if (!list) throw notFound()
    await prisma.costListEntry.updateMany({
      where: { listId: list.id, ingredientId: data.ingredientId },
      data: { manualAmount: 0 },
    })
    return { ok: true as const }
  })
