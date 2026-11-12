import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { captureAttribution } from '#/lib/attribution'
import { getConsent, setConsent } from '#/lib/consent'

// Aviso de cookies. La maqueta del panel solo dice que los píxeles se cargan si la persona los
// acepta; no trae diseño del aviso, así que este es mínimo, con los colores de la landing.
// Tampoco guarda ni manda nada hasta que elige. No sale en el panel (`/admin`) ni en la herramienta de costos (`/herramienta` y su vista de tienda).
export function CookieNotice() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Sin elección guardada se muestra; se decide ya montado para no chocar con el HTML del servidor.
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    captureAttribution()
    setVisible(getConsent() === null)
  }, [])

  const hidden =
    !visible ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/herramienta') ||
    pathname.startsWith('/lista-de-tienda')

  // Mientras se ve, el aviso (fijo abajo) tapaba el final de la página: en móvil, el botón
  // «Pagar» del checkout. Se deja abajo un espacio del alto del aviso para poder pasar de él.
  useEffect(() => {
    const el = ref.current
    if (hidden || !el) return
    const body = document.body
    const reserve = () => {
      const gap = window.innerHeight - el.getBoundingClientRect().top
      body.style.paddingBottom = `${Math.ceil(gap)}px`
    }
    reserve()
    const observer = new ResizeObserver(reserve)
    observer.observe(el)
    window.addEventListener('resize', reserve)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reserve)
      body.style.paddingBottom = ''
    }
  }, [hidden])

  if (hidden) return null

  function choose(choice: 'accepted' | 'rejected') {
    setConsent(choice)
    setVisible(false)
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-60 mx-auto flex max-w-160 flex-col gap-3 rounded-16 border border-landing-line bg-white p-4 text-landing-ink shadow-landing-card md:inset-x-auto md:right-6 md:bottom-6 md:mx-0 md:w-100"
    >
      <p className="m-0 text-13 leading-normal text-landing-muted md:text-sm">
        Usamos cookies para medir qué anuncios funcionan y mejorar tu
        experiencia. Puedes aceptarlas o quedarte solo con las necesarias para
        que el sitio funcione.{' '}
        <Link
          to="/cookies"
          className="font-bold text-landing-primary underline"
        >
          Más información
        </Link>
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
