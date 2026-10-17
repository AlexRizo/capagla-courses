import { createFileRoute, retainSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

import { PlayerShell } from '#/components/player/player-shell'
import { getPlayer } from '#/lib/player'

// Reproductor de una lección. El acceso (sesión, inscripción y vencimiento) lo valida el servidor.
// `?vista=alumna` es "Ver como alumna" del panel (solo admins; ver `getPlayer`); se conserva al
// pasar de una lección a otra.
export const Route = createFileRoute('/mis-cursos/$slug/$lessonId')({
  validateSearch: z.object({
    vista: z.enum(['alumna']).optional().catch(undefined),
  }),
  search: { middlewares: [retainSearchParams(['vista'])] },
  loaderDeps: ({ search }) => ({ preview: search.vista === 'alumna' }),
  loader: ({ params, deps }) =>
    getPlayer({
      data: {
        slug: params.slug,
        lessonId: params.lessonId,
        preview: deps.preview,
      },
    }),
  component: Reproductor,
})

function Reproductor() {
  return <PlayerShell data={Route.useLoaderData()} />
}
