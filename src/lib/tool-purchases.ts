import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { priceChange, purchaseSchema } from '#/lib/cost-purchases'
import { requireModule } from '#/lib/tool-access'

// Registro de compras de la herramienta de costos. Todo se limita a la dueña (`context.userId`).
// Al guardar una compra, el precio de cada ingrediente pasa al que se pagó y se conserva el
// anterior para ver cuánto cambió.

const n = (v: { toString: () => string } | null) =>
  v === null ? null : Number(v)

export const getPurchases = createServerFn()
  .middleware([requireModule('PURCHASES')])
  .handler(async ({ context }) => {
    const [purchases, places] = await Promise.all([
      prisma.costPurchase.findMany({
        where: { userId: context.userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { place: true, items: true },
      }),
      prisma.costPlace.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    return {
      purchases: purchases.map((p) => ({
        id: p.id,
        date: p.date,
        placeId: p.placeId,
        placeName: p.place?.name ?? null,
        ingredients: p.items.length,
        changed: p.items.filter(
          (i) =>
            priceChange(Number(i.previousPrice), Number(i.price)).kind !==
            'SAME',
        ).length,
        total: p.items.reduce((sum, i) => sum + Number(i.price), 0),
      })),
      places: places.map((p) => ({ id: p.id, name: p.name })),
    }
  })

export const getPurchase = createServerFn()
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const row = await prisma.costPurchase.findFirst({
      where: { id: data.id, userId: context.userId },
      include: {
        place: true,
        items: { include: { ingredient: true }, orderBy: { id: 'asc' } },
      },
    })
    if (!row) throw notFound()
    return {
      id: row.id,
      date: row.date,
      placeName: row.place?.name ?? null,
      items: row.items.map((i) => ({
        id: i.id,
        name: i.ingredient.name,
        quantity: Number(i.ingredient.quantity),
        unit: i.ingredient.unit,
        previousPrice: Number(i.previousPrice),
        price: Number(i.price),
        packGrams: n(i.packGrams),
      })),
    }
  })

// Lo que necesita el formulario de una compra: las tiendas y los ingredientes con su último
// precio y las recetas (sin archivar) que cambiarían de costo si ese precio cambia.
export const getPurchaseForm = createServerFn()
  .middleware([requireModule('PURCHASES')])
  .handler(async ({ context }) => {
    const userId = context.userId
    const [places, ingredients, recipes, premixes] = await Promise.all([
      prisma.costPlace.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.costIngredient.findMany({
        where: { userId, archivedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.costRecipe.findMany({
        where: { userId, archivedAt: null },
        include: { lines: { select: { ingredientId: true, premixId: true } } },
      }),
      prisma.costPremix.findMany({
        where: { userId },
        include: { lines: { select: { ingredientId: true } } },
      }),
    ])
    // Qué premezclas lleva cada ingrediente, para contar también las recetas que las usan.
    const premixesOf = new Map<string, Set<string>>()
    for (const p of premixes) {
      for (const l of p.lines) {
        premixesOf.set(
          l.ingredientId,
          (premixesOf.get(l.ingredientId) ?? new Set()).add(p.id),
        )
      }
    }
    const recipesOf = (ingredientId: string) =>
      recipes
        .filter((r) =>
          r.lines.some(
            (l) =>
              l.ingredientId === ingredientId ||
              (l.premixId !== null &&
                premixesOf.get(ingredientId)?.has(l.premixId) === true),
          ),
        )
        .map((r) => r.id)
    return {
      places: places.map((p) => ({ id: p.id, name: p.name })),
      ingredients: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        price: Number(i.price),
        quantity: Number(i.quantity),
        unit: i.unit,
        flexible: i.flexible,
        // Solo lo que se compra por pieza y en número entero se puede pesar por paquete.
        weighable:
          i.flexible &&
          i.unit === 'PZA' &&
          Number.isInteger(Number(i.quantity)),
        packGrams:
          i.sampleCount && i.sampleGrams
            ? Math.round(
                (Number(i.sampleGrams) / i.sampleCount) * Number(i.quantity),
              )
            : null,
        recipeIds: recipesOf(i.id),
      })),
    }
  })

export const savePurchase = createServerFn({ method: 'POST' })
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ values: purchaseSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const when = new Date(`${values.date}T00:00:00.000Z`)
    if (
      Number.isNaN(when.getTime()) ||
      when.toISOString().slice(0, 10) !== values.date
    ) {
      return { error: 'La fecha no es válida.' }
    }
    const ids = values.items.map((i) => i.ingredientId)
    if (new Set(ids).size !== ids.length) {
      return { error: 'Un ingrediente solo puede estar una vez en la compra.' }
    }
    const [place, ingredients] = await Promise.all([
      values.placeId
        ? prisma.costPlace.findFirst({
            where: { id: values.placeId, userId: context.userId },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.costIngredient.findMany({
        where: { userId: context.userId, id: { in: ids }, archivedAt: null },
      }),
    ])
    if (values.placeId && !place) return { error: 'Esa tienda no existe.' }
    if (ingredients.length !== ids.length) {
      return { error: 'Hay un ingrediente que no existe.' }
    }
    const byId = new Map(ingredients.map((i) => [i.id, i]))
    for (const item of values.items) {
      const ing = byId.get(item.ingredientId)!
      const weighable =
        ing.flexible &&
        ing.unit === 'PZA' &&
        Number.isInteger(Number(ing.quantity))
      if (item.packGrams !== null && !weighable) {
        return { error: `${ing.name} no se pesa por paquete.` }
      }
    }
    const created = await prisma.$transaction(async (tx) => {
      const purchase = await tx.costPurchase.create({
        data: {
          userId: context.userId,
          placeId: place?.id ?? null,
          date: when,
          items: {
            create: values.items.map((item) => ({
              ingredientId: item.ingredientId,
              // Lo que costaba al guardar (no lo que mande el navegador).
              previousPrice: byId.get(item.ingredientId)!.price,
              price: item.price,
              packGrams: item.packGrams,
            })),
          },
        },
      })
      for (const item of values.items) {
        const ing = byId.get(item.ingredientId)!
        await tx.costIngredient.update({
          where: { id: ing.id },
          data: {
            price: item.price,
            // Si volvió a pesar el paquete, se actualiza el peso promedio de la pieza.
            ...(item.packGrams !== null
              ? {
                  sampleCount: Number(ing.quantity),
                  sampleGrams: item.packGrams,
                }
              : {}),
          },
        })
      }
      return purchase
    })
    return { id: created.id }
  })
