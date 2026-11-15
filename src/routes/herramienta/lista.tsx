import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { ShoppingList } from '#/components/tool/shopping-list'
import { requireToolPage } from '#/lib/tool-access'
import { getLatestProductionId, getList } from '#/lib/tool-list'

// Lista de compra: con `?produccion=` es la de esa producción y con `?directa` la lista directa
// (solo lo agregado a mano). Sin ninguno (desde el menú) abre la producción más reciente; sin
// producciones, la lista directa (H40).
export const Route = createFileRoute('/herramienta/lista')({
  beforeLoad: () => requireToolPage('SHOPPING_LIST'),
  validateSearch: z.object({
    produccion: z.string().optional(),
    directa: z.boolean().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({
    produccion: search.produccion,
    directa: search.directa,
  }),
  gcTime: 0,
  staleTime: 0,
  loader: async ({ deps }) => {
    if (!deps.produccion && !deps.directa) {
      const latest = await getLatestProductionId()
      if (latest) {
        throw redirect({
          to: '/herramienta/lista',
          search: { produccion: latest },
          replace: true,
        })
      }
    }
    return getList({ data: { productionId: deps.produccion ?? null } })
  },
  component: Lista,
})

function Lista() {
  const data = Route.useLoaderData()
  // Se vuelve a armar desde el servidor cuando cambian los renglones o lo agregado a mano; marcar
  // "Ya lo tengo" o mover renglones no recarga (se guarda aparte).
  const key = `${data.production?.id ?? 'directa'}:${data.rows
    .map((r) => `${r.ingredientId}.${r.manualAmount}`)
    .join(',')}`
  return <ShoppingList key={key} data={data} />
}
