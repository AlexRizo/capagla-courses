import { Link, useRouterState } from '@tanstack/react-router'
import { CircleHelp, X } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

import { helpDuration, helpKeyForPath, helpTopic } from '#/lib/tool-help'
import type { HelpKey } from '#/lib/tool-help'
import type { HelpVideo } from '#/lib/tool-help-server'
import { markToolWelcomeSeen } from '#/lib/tool-help-server'
import { cn } from '#/lib/utils'

// Ayuda de la herramienta (tema 11; prototipo, página «Ayuda (herramienta)»): el «?» junto al
// título de cada sección abre su video encima (en el celular, a pantalla completa); la
// bienvenida A00 se abre sola la primera vez. Sin video, no hay «?».

type HelpState = {
  videos: HelpVideo[]
  open: (key: HelpKey) => void
}

const HelpContext = createContext<HelpState>({ videos: [], open: () => {} })

export const useToolHelp = () => useContext(HelpContext)

export function ToolHelpProvider({
  videos,
  welcome,
  children,
}: {
  videos: HelpVideo[]
  welcome: boolean
  children: React.ReactNode
}) {
  const [current, setCurrent] = useState<HelpKey | null>(welcome ? 'A00' : null)
  const [welcomeOpen, setWelcomeOpen] = useState(welcome)
  const video = current ? videos.find((v) => v.key === current) : undefined

  function close() {
    if (welcomeOpen) {
      setWelcomeOpen(false)
      void markToolWelcomeSeen().catch(() => {})
    }
    setCurrent(null)
  }

  return (
    <HelpContext.Provider value={{ videos, open: setCurrent }}>
      {children}
      {video && (
        <HelpDialog video={video} welcome={welcomeOpen} onClose={close} />
      )}
    </HelpContext.Provider>
  )
}

// El «?» junto al título (lo ponen los títulos de cada sección, listado y detalle).
export function HelpButton() {
  const { videos, open } = useToolHelp()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const key = helpKeyForPath(pathname)
  if (!key || !videos.some((v) => v.key === key)) return null
  return (
    <button
      type="button"
      onClick={() => open(key)}
      aria-label={`Ver el video de ayuda de ${helpTopic(key).title}`}
      title="Ver el video de ayuda"
      className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border bg-background p-0 text-primary shadow-xs md:size-8"
    >
      <CircleHelp className="size-4.5" aria-hidden="true" />
    </button>
  )
}

function HelpDialog({
  video,
  welcome,
  onClose,
}: {
  video: HelpVideo
  welcome: boolean
  onClose: () => void
}) {
  const player = useRef<HTMLVideoElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const topic = helpTopic(video.key)
  const title = welcome ? 'Bienvenida a tu herramienta de costos' : topic.title
  const subtitle = welcome
    ? 'Gladis te muestra el menú y por dónde empezar.'
    : `Video de ayuda · ${helpDuration(video.seconds)}`

  useEffect(() => {
    const el = player.current
    if (!el) return
    let hls: { destroy: () => void } | undefined
    let cancelled = false
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        const p = new Hls()
        p.loadSource(video.url)
        p.attachMedia(el)
        hls = p
      } else {
        el.src = video.url
      }
    })
    closeButton.current?.focus()
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
  }, [video.url, onClose])

  const allVideos = pathname !== '/herramienta/ayuda' && (
    <Link
      to="/herramienta/ayuda"
      onClick={onClose}
      className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border border-sidebar-border px-1 font-medium text-white no-underline md:h-9 md:border-0 md:text-primary"
    >
      Ver todos los videos <span aria-hidden="true">→</span>
    </Link>
  )

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex overflow-auto bg-tool-help-mobile md:items-start md:justify-center md:bg-black/55 md:px-6 md:pt-18 md:pb-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayuda-titulo"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col text-white md:h-auto md:max-w-220 md:gap-4 md:rounded-xl md:bg-card md:p-5 md:text-foreground md:shadow-2xl"
      >
        <div className="flex h-14 items-center gap-2 pr-1 pl-4 md:h-auto md:items-start md:gap-3 md:p-0">
          <div className="min-w-0 flex-1">
            <h2
              id="ayuda-titulo"
              className="m-0 text-base leading-tight font-semibold md:text-lg"
            >
              {title}
            </h2>
            <p className="m-0 mt-0.5 text-xs text-sidebar-muted md:mt-1 md:text-sm md:text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-current md:size-9 md:text-muted-foreground"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-center pb-6 md:block md:flex-none md:pb-0">
          <video
            ref={player}
            controls
            playsInline
            className="block aspect-video w-full bg-black md:rounded-lg"
          />
        </div>
        {welcome ? (
          <div className="flex flex-col gap-2 p-4 md:flex-row-reverse md:flex-wrap md:items-center md:p-0">
            <Link
              to="/herramienta/ajustes"
              onClick={onClose}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-sidebar-primary px-4 font-medium text-white no-underline md:h-9"
            >
              Empezar por Ajustes de costos
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="h-12 cursor-pointer rounded-lg border border-sidebar-border bg-transparent px-4 font-tool text-sm font-medium text-current md:h-9 md:border-border"
            >
              Ver después
            </button>
            <span className="text-center text-xs text-sidebar-muted md:mr-auto md:text-left md:text-sm md:text-muted-foreground">
              También la encuentras en Ayuda, en el menú.
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-end md:p-0',
              !allVideos && 'hidden md:flex',
            )}
          >
            {allVideos || (
              <button
                type="button"
                onClick={onClose}
                className="hidden h-9 cursor-pointer rounded-lg border bg-background px-4 font-tool text-sm font-medium text-foreground md:inline-flex md:items-center"
              >
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
