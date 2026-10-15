import { createFileRoute } from '@tanstack/react-router'

import { ProGate } from '#/components/admin/pro-gate'
import { PromotionEditor } from '#/components/admin/promotion-editor'
import { getAdminPromotion } from '#/lib/admin-promotions'

export const Route = createFileRoute('/admin/promociones/$id')({
  loader: ({ params }) => getAdminPromotion({ data: { id: params.id } }),
  component: EditarPromocion,
})

function EditarPromocion() {
  const promotion = Route.useLoaderData()
  return (
    <ProGate>
      <PromotionEditor promotion={promotion} />
    </ProGate>
  )
}
