import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '#/components/legal-page'
import { LEGAL_DOCS } from '#/lib/legal'

export const Route = createFileRoute('/devoluciones')({
  head: () => ({ meta: [{ title: 'Política de devoluciones · Capagla' }] }),
  component: () => <LegalPage doc={LEGAL_DOCS.devoluciones} />,
})
