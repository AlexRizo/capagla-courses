import { createFileRoute } from '@tanstack/react-router'

import { PurchaseForm } from '#/components/tool/purchase-form'
import { requireToolPage } from '#/lib/tool-access'
import { getPurchaseForm } from '#/lib/tool-purchases'

export const Route = createFileRoute('/herramienta/compras/nueva')({
  beforeLoad: () => requireToolPage('PURCHASES'),
  gcTime: 0,
  staleTime: 0,
  loader: () => getPurchaseForm(),
  component: NuevaCompra,
})

function NuevaCompra() {
  return <PurchaseForm data={Route.useLoaderData()} />
}
