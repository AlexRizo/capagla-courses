import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { getSession } from '#/lib/session'

// Vista de alumno: todo lo que cuelga de /mis-cursos requiere sesión.
export const Route = createFileRoute('/mis-cursos')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/entrar' })
  },
  component: Outlet,
})
