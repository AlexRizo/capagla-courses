import { createFileRoute } from '@tanstack/react-router'

import { UserEditor } from '#/components/admin/user-editor'
import { getAdminUser } from '#/lib/admin-users'

export const Route = createFileRoute('/admin/usuarios/$id')({
  loader: ({ params }) => getAdminUser({ data: { id: params.id } }),
  component: EditarUsuario,
})

function EditarUsuario() {
  const user = Route.useLoaderData()
  return <UserEditor key={user.id} user={user} />
}
