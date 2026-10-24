import { createFileRoute } from '@tanstack/react-router'

import { PremixForm } from '#/components/tool/premix-form'
import { getPremix } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/premezclas/nueva')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getPremix({ data: { id: null } }),
  component: NuevaPremezcla,
})

function NuevaPremezcla() {
  const { premix, ingredients } = Route.useLoaderData()
  return <PremixForm premix={premix} ingredients={ingredients} />
}
