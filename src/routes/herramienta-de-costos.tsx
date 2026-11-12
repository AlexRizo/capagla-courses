import { createFileRoute } from '@tanstack/react-router'

import { ToolLanding } from '#/components/tool-landing'
import { getToolPage } from '#/lib/tool-page'

// Página base de la herramienta de costos: los niveles publicados a su precio normal.
export const Route = createFileRoute('/herramienta-de-costos')({
  loader: () => getToolPage(),
  component: ToolPage,
})

function ToolPage() {
  return <ToolLanding page={Route.useLoaderData()} />
}
