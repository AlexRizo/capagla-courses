import {
  Outlet,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'

import { AdminLayout } from '#/components/admin/admin-layout'
import { getPendingQuestions } from '#/lib/admin-questions'
import { getSession } from '#/lib/session'

// Panel de la chef: todo lo que cuelga de /admin comparte este layout y esta guarda.
// Sin sesión va a /entrar; con sesión sin rol ADMIN responde 404 (no revela el panel).
export const Route = createFileRoute('/admin')({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/entrar' })
    if (session.user.role !== 'ADMIN') throw notFound()
    return { userName: session.user.name }
  },
  loader: () => getPendingQuestions(),
  component: Admin,
})

function Admin() {
  const { userName } = Route.useRouteContext()
  const pendingQuestions = Route.useLoaderData()
  return (
    <AdminLayout userName={userName} pendingQuestions={pendingQuestions}>
      <Outlet />
    </AdminLayout>
  )
}
