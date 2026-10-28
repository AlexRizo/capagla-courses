import { createFileRoute } from '@tanstack/react-router'

import { QuoteForm } from '#/components/tool/quote-form'
import { requireToolPage } from '#/lib/tool-access'
import { getQuoteForm } from '#/lib/tool-quotes'

export const Route = createFileRoute('/herramienta/cotizador/')({
  beforeLoad: () => requireToolPage('QUOTES'),
  gcTime: 0,
  staleTime: 0,
  loader: () => getQuoteForm({ data: { id: null } }),
  component: NuevaCotizacion,
})

function NuevaCotizacion() {
  return <QuoteForm data={Route.useLoaderData()} />
}
