import { createFileRoute } from '@tanstack/react-router'

import { IngredientForm } from '#/components/tool/ingredient-form'
import { getIngredient } from '#/lib/tool-ingredients'
import { getPlaces } from '#/lib/tool-places'

export const Route = createFileRoute('/herramienta/ingredientes/$id')({
  // Sin caché: tras guardar, la lista y el formulario muestran siempre lo último (con caché, por
  // un instante saldrían los datos de antes, y un formulario podría abrirse con valores viejos).
  gcTime: 0,
  staleTime: 0,
  loader: async ({ params }) => ({
    ingredient: await getIngredient({ data: { id: params.id } }),
    places: await getPlaces(),
  }),
  component: EditarIngrediente,
})

function EditarIngrediente() {
  const { ingredient, places } = Route.useLoaderData()
  return (
    <IngredientForm
      key={ingredient.id}
      ingredient={ingredient}
      places={places}
    />
  )
}
