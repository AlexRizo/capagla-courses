import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { captureAttribution } from '#/lib/attribution'
import { getConsent, setConsent } from '#/lib/consent'

// Aviso de cookies. La maqueta del panel solo dice que los píxeles se cargan si la persona los
// acepta; no trae diseño del aviso, así que este es mínimo, con los colores de la landing.
// Tampoco guarda ni manda nada hasta que elige. No sale en el panel (`/admin`).
export function CookieNotice() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Sin elección guardada se muestra; se decide ya montado para no chocar con el HTML del servidor.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    captureAttribution()
    setVisible(getConsent() === null)
  }, [])

  if (!visible || pathname.startsWith('/admin')) return null

  function choose(choice: 'accepted' | 'rejected') {
    setConsent(choice)
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-60 mx-auto flex max-w-160 flex-col gap-3 rounded-16 border border-landing-line bg-white p-4 text-landing-ink shadow-landing-card md:inset-x-auto md:right-6 md:bottom-6 md:mx-0 md:w-100"
    >
      <p className="m-0 text-13 leading-normal text-landing-muted md:text-sm">
        Usamos cookies para medir qué anuncios funcionan y mejorar tu
        experiencia. Puedes aceptarlas o quedarte solo con las necesarias para
        que el sitio funcione.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="min-h-10 cursor-pointer rounded-12 border-0 bg-landing-primary px-5 text-sm font-black text-white"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => choose('rejected')}
          className="min-h-10 cursor-pointer rounded-12 border-1.5 border-landing-field bg-white px-4 text-sm font-bold text-landing-primary"
        >
          Solo las necesarias
        </button>
      </div>
    </div>
  )
}
