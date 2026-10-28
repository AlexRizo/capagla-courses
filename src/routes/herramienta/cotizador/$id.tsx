import { createFileRoute } from '@tanstack/react-router'

import { QuoteForm } from '#/components/tool/quote-form'
import { requireToolPage } from '#/lib/tool-access'
import { getQuoteForm } from '#/lib/tool-quotes'

export const Route = createFileRoute('/herramienta/cotizador/$id')({
  beforeLoad: () => requireToolPage('QUOTES'),
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getQuoteForm({ data: { id: params.id } }),
  component: EditarCotizacion,
})

function EditarCotizacion() {
  const data = Route.useLoaderData()
  return <QuoteForm key={data.quote?.id ?? 'nueva'} data={data} />
}
