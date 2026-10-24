import { createFileRoute } from '@tanstack/react-router'

import { QuoteForm } from '#/components/tool/quote-form'
import { getQuoteForm } from '#/lib/tool-quotes'

export const Route = createFileRoute('/herramienta/cotizador/')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getQuoteForm({ data: { id: null } }),
  component: NuevaCotizacion,
})

function NuevaCotizacion() {
  return <QuoteForm data={Route.useLoaderData()} />
}
