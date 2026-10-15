import { createFileRoute } from '@tanstack/react-router'

import { CourseLanding } from '#/components/course-landing'
import { getPromotionLanding } from '#/lib/course-landing'

// Landing de una promoción (/navidad): el curso principal con los precios especiales del
// anuncio mientras estén vigentes. Las rutas fijas (/entrar, /checkout...) tienen prioridad
// y sus nombres no se pueden usar como URL de promoción (`lib/promotions.ts`).
export const Route = createFileRoute('/$promo')({
  loader: ({ params }) =>
    getPromotionLanding({ data: { promo: params.promo } }),
  component: PromoPage,
})

function PromoPage() {
  return <CourseLanding page={Route.useLoaderData()} />
}
