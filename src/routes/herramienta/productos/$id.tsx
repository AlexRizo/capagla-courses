import { createFileRoute } from '@tanstack/react-router'

import { ProductForm } from '#/components/tool/product-form'
import { getProductForm } from '#/lib/tool-products'

export const Route = createFileRoute('/herramienta/productos/$id')({
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getProductForm({ data: { id: params.id } }),
  component: EditarProducto,
})

function EditarProducto() {
  const data = Route.useLoaderData()
  return <ProductForm key={data.product?.id ?? 'nuevo'} data={data} />
}
