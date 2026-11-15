import { createFileRoute } from '@tanstack/react-router'

import { PurchaseEditForm } from '#/components/tool/purchase-edit-form'
import { requireToolPage } from '#/lib/tool-access'
import { getPurchaseEdit } from '#/lib/tool-purchases'

export const Route = createFileRoute('/herramienta/compras/$id_/editar')({
  beforeLoad: () => requireToolPage('PURCHASES'),
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getPurchaseEdit({ data: { id: params.id } }),
  component: CorregirCompra,
})

function CorregirCompra() {
  return <PurchaseEditForm data={Route.useLoaderData()} />
}
