import { createFileRoute } from '@tanstack/react-router'

import { ProductForm } from '#/components/tool/product-form'
import { getProductForm } from '#/lib/tool-products'

export const Route = createFileRoute('/herramienta/productos/nuevo')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getProductForm({ data: { id: null } }),
  component: NuevoProducto,
})

function NuevoProducto() {
  return <ProductForm data={Route.useLoaderData()} />
}
