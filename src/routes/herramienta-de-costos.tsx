import { createFileRoute } from '@tanstack/react-router'

import { ToolLanding } from '#/components/tool-landing'
import { getToolPage } from '#/lib/tool-page'
import { seo, siteUrlFrom } from '#/lib/seo'

// Página base de la herramienta de costos: los niveles publicados a su precio normal.
export const Route = createFileRoute('/herramienta-de-costos')({
  loader: () => getToolPage(),
  head: ({ loaderData, matches }) => ({
    meta: seo({
      title: 'Herramienta de costos',
      description: loaderData?.intro,
      path: '/herramienta-de-costos',
      base: siteUrlFrom(matches),
    }),
  }),
  component: ToolPage,
})

function ToolPage() {
  return <ToolLanding page={Route.useLoaderData()} />
}
