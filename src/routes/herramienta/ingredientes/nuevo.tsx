import { createFileRoute } from '@tanstack/react-router'

import { IngredientForm } from '#/components/tool/ingredient-form'
import { getPlaces } from '#/lib/tool-places'

export const Route = createFileRoute('/herramienta/ingredientes/nuevo')({
  // Sin caché: tras guardar, la lista y el formulario muestran siempre lo último (con caché, por
  // un instante saldrían los datos de antes, y un formulario podría abrirse con valores viejos).
  gcTime: 0,
  staleTime: 0,
  loader: () => getPlaces(),
  component: NuevoIngrediente,
})

function NuevoIngrediente() {
  const places = Route.useLoaderData()
  return <IngredientForm places={places} />
}
