import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { CourseLanding } from '#/components/course-landing'
import { getPromotionLanding } from '#/lib/course-landing'

// Landing de una promoción (/navidad): el curso principal con los precios especiales del
// anuncio mientras estén vigentes. Las rutas fijas (/entrar, /checkout...) tienen prioridad
// y sus nombres no se pueden usar como URL de promoción (`lib/promotions.ts`).
export const Route = createFileRoute('/$promo')({
  // `?prueba=`: enlace de prueba de la admin (ver `resolveOffer`).
  validateSearch: z.object({
    prueba: z.string().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ prueba: search.prueba }),
  loader: ({ params, deps }) =>
    getPromotionLanding({
      data: { promo: params.promo, prueba: deps.prueba },
    }),
  component: PromoPage,
})

function PromoPage() {
  return <CourseLanding page={Route.useLoaderData()} />
}
