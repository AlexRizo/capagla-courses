import { createFileRoute } from '@tanstack/react-router'

import { PremixForm } from '#/components/tool/premix-form'
import { getPremix } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/premezclas/$id')({
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getPremix({ data: { id: params.id } }),
  component: EditarPremezcla,
})

function EditarPremezcla() {
  const { premix, ingredients } = Route.useLoaderData()
  return (
    <PremixForm
      key={premix?.id ?? 'nueva'}
      premix={premix}
      ingredients={ingredients}
    />
  )
}
