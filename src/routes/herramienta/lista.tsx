import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ShoppingList } from '#/components/tool/shopping-list'
import { getList } from '#/lib/tool-list'

// Lista de compra: con `?produccion=` es la de esa producción; sin él, la lista directa.
export const Route = createFileRoute('/herramienta/lista')({
  validateSearch: z.object({ produccion: z.string().optional() }),
  loaderDeps: ({ search }) => ({ produccion: search.produccion }),
  gcTime: 0,
  staleTime: 0,
  loader: ({ deps }) =>
    getList({ data: { productionId: deps.produccion ?? null } }),
  component: Lista,
})

function Lista() {
  const data = Route.useLoaderData()
  // Se vuelve a armar desde el servidor cuando cambian los renglones o lo agregado a mano; marcar
  // "Ya lo tengo" o mover renglones no recarga (se guarda aparte).
  const key = `${data.production?.id ?? 'directa'}:${data.rows
    .map((r) => `${r.ingredientId}.${r.manualPacks}`)
    .join(',')}`
  return <ShoppingList key={key} data={data} />
}
