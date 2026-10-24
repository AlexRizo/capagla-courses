import { createFileRoute } from '@tanstack/react-router'

import { ProductionForm } from '#/components/tool/production-form'
import { getProductionForm } from '#/lib/tool-productions'

export const Route = createFileRoute('/herramienta/producciones/nueva')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getProductionForm({ data: { id: null } }),
  component: NuevaProduccion,
})

function NuevaProduccion() {
  return <ProductionForm data={Route.useLoaderData()} />
}
