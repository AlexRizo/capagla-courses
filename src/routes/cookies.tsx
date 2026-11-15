import { createFileRoute } from '@tanstack/react-router'

import { openCookieNotice } from '#/components/cookie-notice'
import { LegalPage } from '#/components/legal-page'
import { LEGAL_DOCS } from '#/lib/legal'

export const Route = createFileRoute('/cookies')({
  head: () => ({ meta: [{ title: 'Política de cookies · Capagla' }] }),
  component: () => (
    <LegalPage doc={LEGAL_DOCS.cookies}>
      {/* Para cambiar lo que eligió en el aviso (H21). */}
      <button
        type="button"
        onClick={openCookieNotice}
        className="mt-5 min-h-11 cursor-pointer rounded-12 border-1.5 border-landing-primary bg-white px-5 text-15 font-bold text-landing-primary"
      >
        Cambiar mis preferencias de cookies
      </button>
    </LegalPage>
  ),
})
