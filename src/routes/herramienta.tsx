import { Outlet, createFileRoute } from '@tanstack/react-router'

import { ToolLayout } from '#/components/tool/tool-layout'
import { requireToolPage } from '#/lib/tool-access'
import { getToolUsage } from '#/lib/tool-usage'

// Herramienta de costos: todo lo que cuelga de /herramienta comparte este marco y esta guarda.
// Sin sesión va a /entrar; sin acceso a la herramienta, a Mis cursos.
export const Route = createFileRoute('/herramienta')({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  beforeLoad: () => requireToolPage(),
  loader: () => getToolUsage(),
  component: Herramienta,
})

function Herramienta() {
  const { tier, used } = Route.useLoaderData()
  return (
    <ToolLayout tier={tier} used={used}>
      <Outlet />
    </ToolLayout>
  )
}
