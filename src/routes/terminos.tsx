import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '#/components/legal-page'
import { LEGAL_DOCS } from '#/lib/legal'

export const Route = createFileRoute('/terminos')({
  head: () => ({ meta: [{ title: 'Términos y condiciones · Capagla' }] }),
  component: () => <LegalPage doc={LEGAL_DOCS.terminos} />,
})
