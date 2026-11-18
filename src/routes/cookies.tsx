import { createFileRoute } from '@tanstack/react-router'

import { CookiePreference } from '#/components/cookie-notice'
import { LegalPage } from '#/components/legal-page'
import { LEGAL_DOCS } from '#/lib/legal'

export const Route = createFileRoute('/cookies')({
  head: () => ({ meta: [{ title: 'Política de cookies · Capagla' }] }),
  component: () => (
    <LegalPage doc={LEGAL_DOCS.cookies}>
      {/* Para cambiar la elección (H21). */}
      <CookiePreference />
    </LegalPage>
  ),
})
