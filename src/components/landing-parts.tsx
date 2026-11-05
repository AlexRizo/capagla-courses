import { useEffect, useRef, useState } from 'react'

import type { CoursePage } from '#/lib/course-pages'
import { track } from '#/lib/track-client'

// Piezas que comparten las landings de venta (recetas y curso de costeo).

// Marketing: ver el curso o la promoción (solo el navegador). Devuelve lo que necesita el botón
// de reproducir: sin video de intro el botón queda como en la maqueta (sin acción).
export function useLandingIntro(page: CoursePage) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    track('ViewContent', {
      params: {
        contentName: page.title,
        contentIds: [page.slug],
        value: page.priceMxn,
        currency: 'MXN',
      },
    })
  }, [page.slug, page.promoSlug, page.title, page.priceMxn])
  return {
    playing,
    close: () => setPlaying(false),
    onPlay: page.introVideo ? () => setPlaying(true) : undefined,
  }
}

export function Play({
  mobile,
  onPlay,
}: {
  mobile?: boolean
  onPlay?: () => void
}) {
  const className = `relative flex items-center justify-center rounded-full bg-landing-primary/92 shadow-landing-play ${mobile ? 'size-16' : 'size-21'}`
  const triangle = (
    <div
      className={`size-0 border-y-transparent border-l-white ${mobile ? 'ml-1.25 border-y-12 border-l-19' : 'ml-1.5 border-y-15 border-l-25'}`}
    />
  )
  if (!onPlay) return <div className={className}>{triangle}</div>
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label="Ver el video de presentación"
      className={`${className} cursor-pointer border-0 p-0`}
    >
      {triangle}
    </button>
  )
}

// Video de intro de la promoción en una ventana sobre la página (Bunny, por HLS).
// Se cierra con ✕, con Escape o tocando fuera del video.
export function IntroVideo({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = video.current
    if (!el) return
    let hls: { destroy: () => void } | undefined
    let cancelled = false
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        const player = new Hls()
        player.loadSource(src)
        player.attachMedia(el)
        hls = player
      } else {
        el.src = src
      }
      void el.play().catch(() => {})
    })
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelled = true
      hls?.destroy()
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [src, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video de presentación"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-landing-ink/85 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl"
      >
        <button
          ref={close}
          type="button"
          onClick={onClose}
          aria-label="Cerrar video"
          className="absolute -top-12 right-0 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-white text-lg font-black text-landing-ink"
        >
          ✕
        </button>
        <video
          ref={video}
          controls
          playsInline
          className="block aspect-video w-full rounded-16 bg-black"
        />
      </div>
    </div>
  )
}
