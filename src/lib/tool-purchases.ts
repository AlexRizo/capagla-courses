import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import type { Prisma } from '@prisma/client'

import {
  priceAfterEditing,
  priceAfterRemoving,
  priceChange,
  purchaseEditSchema,
  purchaseSchema,
} from '#/lib/cost-purchases'
import { requireModule } from '#/lib/tool-access'

// Registro de compras de la herramienta de costos. Todo se limita a la dueña (`context.userId`).
// Al guardar una compra, el precio de cada ingrediente pasa al que se pagó y se conserva el
// anterior para ver cuánto cambió.

// "2026-10-13" → ese día a las 00:00 UTC, o null si no existe (31 de febrero).
function parseDay(value: string) {
  const when = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(when.getTime()) ||
    when.toISOString().slice(0, 10) !== value
    ? null
    : when
}

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
    const later = await laterIngredients(prisma, context.userId, row)
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
        // Si se borra la compra, el precio al que vuelve el ingrediente (null: no cambia).
        revertTo: priceAfterRemoving({
          latest: !later.has(i.ingredientId),
          current: Number(i.ingredient.price),
          paid: Number(i.price),
          previous: Number(i.previousPrice),
        }),
      })),
    }
  })

// Ingredientes de una compra que se volvieron a comprar después (en otra compra registrada más
// tarde): en esos, la compra ya no es la que dejó el precio como está.
async function laterIngredients(
  db: Prisma.TransactionClient,
  userId: string,
  purchase: { id: string; createdAt: Date },
) {
  const rows = await db.costPurchaseItem.findMany({
    where: {
      purchase: {
        userId,
        id: { not: purchase.id },
        createdAt: { gt: purchase.createdAt },
      },
      ingredient: { purchaseItems: { some: { purchaseId: purchase.id } } },
    },
    select: { ingredientId: true },
  })
  return new Set(rows.map((r) => r.ingredientId))
}

// Borra una compra. Si era la que dejó el precio de un ingrediente como está, ese precio vuelve
// al que tenía antes (ver `priceAfterRemoving`). El peso del paquete no vuelve: no se guarda el
// anterior.
export const deletePurchase = createServerFn({ method: 'POST' })
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const done = await prisma.$transaction(async (tx) => {
      const row = await tx.costPurchase.findFirst({
        where: { id: data.id, userId: context.userId },
        include: { items: { include: { ingredient: true } } },
      })
      if (!row) return false
      const later = await laterIngredients(tx, context.userId, row)
      for (const i of row.items) {
        const to = priceAfterRemoving({
          latest: !later.has(i.ingredientId),
          current: Number(i.ingredient.price),
          paid: Number(i.price),
          previous: Number(i.previousPrice),
        })
        if (to !== null) {
          await tx.costIngredient.update({
            where: { id: i.ingredientId },
            data: { price: to },
          })
        }
      }
      await tx.costPurchase.delete({ where: { id: row.id } })
      return true
    })
    return done ? {} : { error: 'Esa compra ya no existe.' }
  })

// Lo que necesita el formulario para corregir una compra: la compra con sus renglones y, por
// renglón, si es la compra más reciente de ese ingrediente (solo entonces cambia su precio).
export const getPurchaseEdit = createServerFn()
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const row = await prisma.costPurchase.findFirst({
      where: { id: data.id, userId: context.userId },
      include: {
        items: { include: { ingredient: true }, orderBy: { id: 'asc' } },
      },
    })
    if (!row) throw notFound()
    const [later, form] = await Promise.all([
      laterIngredients(prisma, context.userId, row),
      loadFormData(context.userId),
    ])
    return {
      places: form.places,
      purchase: {
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        placeId: row.placeId,
        items: row.items.map((i) => {
          const ing = i.ingredient
          const latest = !later.has(i.ingredientId)
          return {
            itemId: i.id,
            name: ing.name,
            quantity: Number(ing.quantity),
            unit: ing.unit,
            weighable:
              ing.flexible &&
              ing.unit === 'PZA' &&
              Number.isInteger(Number(ing.quantity)),
            previousPrice: Number(i.previousPrice),
            price: Number(i.price),
            packGrams: n(i.packGrams),
            // Esta compra dejó el precio como está: corregirla cambia el precio del ingrediente.
            applies:
              latest && Math.abs(Number(ing.price) - Number(i.price)) < 0.005,
            recipeIds: form.recipesOf(i.ingredientId),
          }
        }),
      },
    }
  })

// Corrige una compra: tienda, día, lo que se pagó y el peso del paquete; los renglones que no
// vienen se quitan. El precio de un ingrediente solo cambia si esta compra es la que lo dejó como
// está (ver `priceAfterEditing` y `priceAfterRemoving`); si no, solo se corrige el historial.
export const updatePurchase = createServerFn({ method: 'POST' })
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ id: z.string(), values: purchaseEditSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const when = parseDay(values.date)
    if (!when) return { error: 'La fecha no es válida.' }
    const ids = values.items.map((i) => i.itemId)
    if (new Set(ids).size !== ids.length) {
      return { error: 'Un ingrediente solo puede estar una vez en la compra.' }
    }
    const place = values.placeId
      ? await prisma.costPlace.findFirst({
          where: { id: values.placeId, userId: context.userId },
          select: { id: true },
        })
      : null
    if (values.placeId && !place) return { error: 'Esa tienda no existe.' }

    return prisma.$transaction(async (tx) => {
      const row = await tx.costPurchase.findFirst({
        where: { id: data.id, userId: context.userId },
        include: { items: { include: { ingredient: true } } },
      })
      if (!row) return { error: 'Esa compra ya no existe.' }
      const byId = new Map(row.items.map((i) => [i.id, i]))
      if (ids.some((id) => !byId.has(id))) {
        return { error: 'Hay un ingrediente que ya no está en la compra.' }
      }
      const kept = new Map(values.items.map((v) => [v.itemId, v]))
      // Todo se revisa antes de escribir: un error a la mitad no debe dejar la compra a medias.
      for (const v of values.items) {
        const ing = byId.get(v.itemId)!.ingredient
        const weighable =
          ing.flexible &&
          ing.unit === 'PZA' &&
          Number.isInteger(Number(ing.quantity))
        if (v.packGrams !== null && !weighable) {
          return { error: `${ing.name} no se pesa por paquete.` }
        }
      }
      const later = await laterIngredients(tx, context.userId, row)

      for (const item of row.items) {
        const ing = item.ingredient
        const latest = !later.has(item.ingredientId)
        const edit = kept.get(item.id)
        if (!edit) {
          const to = priceAfterRemoving({
            latest,
            current: Number(ing.price),
            paid: Number(item.price),
            previous: Number(item.previousPrice),
          })
          if (to !== null) {
            await tx.costIngredient.update({
              where: { id: ing.id },
              data: { price: to },
            })
          }
          await tx.costPurchaseItem.delete({ where: { id: item.id } })
          continue
        }
        const to = priceAfterEditing({
          latest,
          current: Number(ing.price),
          paid: Number(item.price),
          newPaid: edit.price,
        })
        // Si volvió a pesar el paquete en la compra más reciente, se actualiza el peso promedio.
        const newPack =
          latest &&
          edit.packGrams !== null &&
          edit.packGrams !== n(item.packGrams)
        if (to !== null || newPack) {
          await tx.costIngredient.update({
            where: { id: ing.id },
            data: {
              ...(to !== null ? { price: to } : {}),
              ...(newPack
                ? {
                    sampleCount: Number(ing.quantity),
                    sampleGrams: edit.packGrams,
                  }
                : {}),
            },
          })
        }
        await tx.costPurchaseItem.update({
          where: { id: item.id },
          data: { price: edit.price, packGrams: edit.packGrams },
        })
      }
      await tx.costPurchase.update({
        where: { id: row.id },
        data: { placeId: place?.id ?? null, date: when },
      })
      return { id: row.id }
    })
  })

// Lo que necesita el formulario de una compra: las tiendas y los ingredientes con su último
// precio y las recetas (sin archivar) que cambiarían de costo si ese precio cambia.
async function loadFormData(userId: string) {
  {
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
      recipesOf,
    }
  }
}

export const getPurchaseForm = createServerFn()
  .middleware([requireModule('PURCHASES')])
  .handler(async ({ context }) => {
    const { places, ingredients } = await loadFormData(context.userId)
    return { places, ingredients }
  })

export const savePurchase = createServerFn({ method: 'POST' })
  .middleware([requireModule('PURCHASES')])
  .validator(z.object({ values: purchaseSchema }))
  .handler(async ({ data, context }) => {
    const { values } = data
    const when = parseDay(values.date)
    if (!when) return { error: 'La fecha no es válida.' }
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
