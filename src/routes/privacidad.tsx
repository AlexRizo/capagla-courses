import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '#/components/legal-page'
import { LEGAL_DOCS } from '#/lib/legal'

export const Route = createFileRoute('/privacidad')({
  head: () => ({ meta: [{ title: 'Aviso de privacidad · Capagla' }] }),
  component: () => <LegalPage doc={LEGAL_DOCS.privacidad} />,
})
