import { createFileRoute } from '@tanstack/react-router'

import { ProductionForm } from '#/components/tool/production-form'
import { requireToolPage } from '#/lib/tool-access'
import { getProductionForm } from '#/lib/tool-productions'

export const Route = createFileRoute('/herramienta/producciones/$id')({
  beforeLoad: () => requireToolPage('PRODUCTION'),
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getProductionForm({ data: { id: params.id } }),
  component: EditarProduccion,
})

function EditarProduccion() {
  const data = Route.useLoaderData()
  return <ProductionForm key={data.production?.id ?? 'nueva'} data={data} />
}
