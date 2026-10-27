import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import { initTracking, onConsentChange, track } from '#/lib/track-client'

// Carga los píxeles (solo con las cookies aceptadas) y registra el PageView de cada página.
// `config` son los IDs públicos que entrega el servidor; sin ID no se carga nada.
export function Tracking({
  config,
}: {
  config: {
    metaPixelId: string | null
    tiktokPixelId: string | null
    ga4MeasurementId: string | null
  }
}) {
  const href = useRouterState({ select: (s) => s.location.href })
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    initTracking(config)
    return onConsentChange(() => initTracking(config))
  }, [config])

  // Una vista por página (navegar dentro del sitio no recarga). Ni el panel, ni la herramienta ni la API cuentan.
  useEffect(() => {
    if (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/herramienta') ||
      pathname.startsWith('/lista-de-tienda') ||
      pathname.startsWith('/api')
    )
      return
    track('PageView')
  }, [href, pathname])

  return null
}
