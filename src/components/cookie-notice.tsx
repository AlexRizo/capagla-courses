import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { captureAttribution } from '#/lib/attribution'
import { CONSENT_EVENT, getConsent, setConsent } from '#/lib/consent'
import type { Consent } from '#/lib/consent'

// Aviso de cookies (decidido por Cheko, 2026-11-17): una barra delgada abajo, sin botón de
// aceptar. La medición ya está activa al entrar. La barra sale una sola vez: al mostrarse se
// guarda `si`, así que cerrarla con la ×, seguir a otra página o no hacer nada deja todo activo y
// no vuelve a salir. «Rechazar» apaga Meta, TikTok y GA4 y guarda `no`. Las cookies de
// funcionamiento (sesión, carrito, pago) no dependen de esto.
// No sale en el panel (`/admin`) ni en la herramienta de costos (`/herramienta/…` y su vista de
// tienda); la página pública `/herramienta-de-costos` sí la lleva.
export const isPrivateArea = (pathname: string) =>
  pathname.startsWith('/admin') ||
  pathname === '/herramienta' ||
  pathname.startsWith('/herramienta/') ||
  pathname.startsWith('/lista-de-tienda')

export function CookieNotice() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Página donde se mostró (se decide ya montado para no chocar con el HTML del servidor).
  const [shownAt, setShownAt] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    captureAttribution()
  }, [])

  useEffect(() => {
    if (shownAt !== null || isPrivateArea(pathname)) return
    if (getConsent() !== null) return
    // Mostrarla cuenta como aviso dado: no vuelve a salir y la medición sigue activa.
    setConsent('accepted')
    setShownAt(pathname)
  }, [pathname, shownAt])

  // Al pasar a otra página (seguir navegando) se quita.
  const visible = shownAt !== null && shownAt === pathname && !closed

  // Mientras se ve, la barra (fija abajo) taparía el final de la página: en móvil, el botón
  // «Pagar» del checkout. Se deja abajo un espacio de su alto para poder pasar de ella.
  useEffect(() => {
    const el = ref.current
    if (!visible || !el) return
    const body = document.body
    const reserve = () => {
      body.style.paddingBottom = `${Math.ceil(el.getBoundingClientRect().height)}px`
    }
    reserve()
    const observer = new ResizeObserver(reserve)
    observer.observe(el)
    return () => {
      observer.disconnect()
      body.style.paddingBottom = ''
    }
  }, [visible])

  if (!visible) return null

  function reject() {
    setConsent('rejected')
    setClosed(true)
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-60 flex items-center gap-3 border-t border-landing-line bg-white py-2 pr-2 pl-4 text-landing-ink md:justify-center md:pl-6"
    >
      <p className="m-0 flex-1 text-13 leading-snug text-landing-muted md:flex-none">
        Usamos cookies para medir y mejorar nuestros anuncios.{' '}
        <Link
          to="/privacidad"
          className="font-bold whitespace-nowrap text-landing-primary underline"
        >
          Aviso de privacidad
        </Link>
        {' · '}
        <button
          type="button"
          // Se apaga al presionar, antes del clic: si no, los píxeles alcanzan a registrar el
          // propio clic en «Rechazar» (Meta lo manda como SubscribedButtonClick).
          onPointerDown={() => setConsent('rejected')}
          onClick={reject}
          className="cursor-pointer border-0 bg-transparent p-0 font-bold text-landing-primary underline"
        >
          Rechazar
        </button>
      </p>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Cerrar aviso de cookies"
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-xl leading-none text-landing-muted"
      >
        ×
      </button>
    </div>
  )
}

// Página /cookies (H21): muestra si la medición está activa y deja apagarla o volver a activarla.
export function CookiePreference() {
  // Se lee ya montado (la cookie no existe en el HTML del servidor).
  const [consent, setLocal] = useState<Consent | null | undefined>(undefined)

  useEffect(() => {
    const sync = () => setLocal(getConsent())
    sync()
    window.addEventListener(CONSENT_EVENT, sync)
    return () => window.removeEventListener(CONSENT_EVENT, sync)
  }, [])

  if (consent === undefined) return null
  const rejected = consent === 'rejected'

  return (
    <div className="mt-5 flex flex-col items-start gap-3">
      <p className="m-0 text-15 leading-normal text-landing-muted">
        {rejected
          ? 'Rechazaste las cookies de medición: Meta, TikTok y Google Analytics están apagados.'
          : 'Las cookies de medición están activas.'}
      </p>
      <button
        type="button"
        onClick={() => setConsent(rejected ? 'accepted' : 'rejected')}
        className="min-h-11 cursor-pointer rounded-12 border-1.5 border-landing-primary bg-white px-5 text-15 font-bold text-landing-primary"
      >
        {rejected
          ? 'Activar las cookies de medición'
          : 'Rechazar las cookies de medición'}
      </button>
    </div>
  )
}
