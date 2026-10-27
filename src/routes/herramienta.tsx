import { Outlet, createFileRoute } from '@tanstack/react-router'

import { ToolLayout } from '#/components/tool/tool-layout'
import { requireToolPage } from '#/lib/tool-access'

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
  component: () => (
    <ToolLayout>
      <Outlet />
    </ToolLayout>
  ),
})
