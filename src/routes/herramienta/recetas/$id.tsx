import { createFileRoute } from '@tanstack/react-router'

import { RecipeForm } from '#/components/tool/recipe-form'
import { getRecipeForm } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/recetas/$id')({
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getRecipeForm({ data: { id: params.id } }),
  component: EditarReceta,
})

function EditarReceta() {
  const data = Route.useLoaderData()
  return <RecipeForm key={data.recipe?.id ?? 'nueva'} data={data} />
}
