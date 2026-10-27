import { createFileRoute } from '@tanstack/react-router'

import { RecipeForm } from '#/components/tool/recipe-form'
import { getRecipeForm } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/recetas/nueva')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getRecipeForm({ data: { id: null } }),
  component: NuevaReceta,
})

function NuevaReceta() {
  return <RecipeForm data={Route.useLoaderData()} />
}
