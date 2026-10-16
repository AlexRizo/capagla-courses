import { createFileRoute } from '@tanstack/react-router'

import { PlayerShell } from '#/components/player/player-shell'
import { getPlayer } from '#/lib/player'

// Reproductor de una lección. El acceso (sesión, inscripción y vencimiento) lo valida el servidor.
export const Route = createFileRoute('/mis-cursos/$slug/$lessonId')({
  loader: ({ params }) =>
    getPlayer({ data: { slug: params.slug, lessonId: params.lessonId } }),
  component: Reproductor,
})

function Reproductor() {
  return <PlayerShell data={Route.useLoaderData()} />
}
