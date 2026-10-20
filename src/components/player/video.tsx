import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from '@tanstack/react-router'
import { Volume2, VolumeX } from 'lucide-react'

import { clock, partAt } from '#/lib/duration'
import type { VideoPart } from '#/lib/duration'
import {
  VIDEO_RATES as RATES,
  readVideoPrefs,
  saveVideoPrefs,
} from '#/lib/video-prefs'
import { cn } from '#/lib/utils'

// Estado del video de la lección, compartido entre el reproductor, el panel "En este video"
// y el botón de marcar momentos. Hay un solo `<video>` a la vez.
type VideoState = {
  time: number
  setTime: (t: number) => void
  duration: number
  setDuration: (d: number) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  seek: (seconds: number) => void
}

const VideoContext = createContext<VideoState | null>(null)

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    setTime(seconds)
  }, [])

  const value = useMemo(
    () => ({ time, setTime, duration, setDuration, videoRef, seek }),
    [time, duration, seek],
  )
  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
}

export function useVideo() {
  const ctx = useContext(VideoContext)
  if (!ctx) throw new Error('useVideo va dentro de VideoProvider')
  return ctx
}

// Firma de Bunny en la ruta de la URL: `/bcdn_token=…&expires=…&token_path=…`.
const SIGNATURE = /\/bcdn_token=[^/]*/
// La firma se renueva cuando le quedan menos de 10 minutos (se revisa cada minuto).
const RENEW_BEFORE_MS = 10 * 60 * 1000
const RENEW_CHECK_MS = 60 * 1000

// Vencimiento de la firma en milisegundos, o `null` si la URL no va firmada.
function signatureExpiry(url: string) {
  const expires = url.match(SIGNATURE)?.[0].match(/expires=(\d+)/)?.[1]
  return expires ? Number(expires) * 1000 : null
}

// La misma URL con la firma de `signed` (las descargas de hls.js llevan siempre la más nueva).
function withSignature(url: string, signed: string) {
  const signature = signed.match(SIGNATURE)?.[0]
  return signature ? url.replace(SIGNATURE, signature) : url
}

// Saltos de las teclas: ← → y J L; ↑ ↓ cambian el volumen.
const SEEK_SHORT = 5
const SEEK_LONG = 10
const VOLUME_STEP = 0.1
// Sin actividad durante este tiempo (y reproduciendo), la barra de controles se oculta.
const HIDE_CONTROLS_MS = 3000

export function VideoPlayer({
  src,
  durationSec,
  parts,
  moments,
  compact = false,
}: {
  src: string
  // Duración que escribió la chef; vale mientras el archivo no informe la suya.
  durationSec: number | null
  parts: VideoPart[]
  moments: { id: string; seconds: number }[]
  // Móvil: sin velocidad ni "Parte actual:".
  compact?: boolean
}) {
  const { time, setTime, duration, setDuration, videoRef, seek } = useVideo()
  const box = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState(0)
  const [failed, setFailed] = useState(false)

  const total = duration || durationSec || 0
  const pct = (sec: number) => (total ? Math.min(100, (sec / total) * 100) : 0)
  const part = partAt(parts, time)
  const silent = muted || volume === 0

  // Barra de controles: se oculta reproduciendo y sin actividad (como en los reproductores
  // habituales). Vuelve al mover el ratón, tocar la pantalla o usar un atajo; no se oculta en
  // pausa, con el ratón sobre ella ni con el foco del teclado en sus controles.
  const [idle, setIdle] = useState(false)
  const [overBar, setOverBar] = useState(false)
  const [focusInBar, setFocusInBar] = useState(false)
  const idleTimer = useRef<number | undefined>(undefined)
  const wake = useCallback(() => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), HIDE_CONTROLS_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])
  const hidden = playing && idle && !overBar && !focusInBar
  // En pantalla táctil, si la barra está oculta, el toque solo la muestra (no pausa).
  const tapOnlyShows = useRef(false)

  // Un archivo (mp4) va directo al `<video>`. Una lista HLS (.m3u8, la de Bunny) la reproduce
  // hls.js (se descarga solo si hace falta) y, donde no se pueda, el HLS nativo del navegador.
  const isHls = src.includes('.m3u8')
  // La URL de Bunny trae su firma (token y vencimiento, 6 h) y el servidor firma otra cada vez
  // que se recargan los datos de la lección (al guardar un momento, marcar como vista,
  // preguntar o renovar la firma). El video solo se vuelve a cargar si cambia el archivo; si
  // solo cambia la firma, hls.js la usa en las siguientes descargas sin reiniciar nada.
  const sourceKey = src.replace(SIGNATURE, '')
  const srcRef = useRef(src)
  // Lo que hay que hacer cuando llegue una firma nueva (reanudar descargas que fallaron).
  const onNewSignature = useRef<(() => void) | null>(null)
  // Con HLS nativo (Safari sin hls.js) no se puede cambiar la URL de cada descarga.
  const native = useRef<{ url: string } | null>(null)
  useEffect(() => {
    srcRef.current = src
    onNewSignature.current?.()
    onNewSignature.current = null
    // HLS nativo: si la firma con la que se cargó está por vencer, se cambia la fuente por la
    // nueva y se sigue en el mismo minuto (solo entonces, para no cortar en cada guardado).
    const video = videoRef.current
    const loaded = native.current
    if (!video || !loaded || loaded.url === src) return
    const expiry = signatureExpiry(loaded.url)
    if (!expiry || expiry - Date.now() > RENEW_BEFORE_MS) return
    const { currentTime, paused } = video
    loaded.url = src
    video.src = src
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = currentTime
        if (!paused) void video.play()
      },
      { once: true },
    )
  }, [src, videoRef])

  // Renovar la firma antes de que venza: se vuelven a pedir los datos de la lección (con su
  // control de acceso) y llega una firma nueva. Se revisa cada minuto y al volver a la pestaña,
  // porque en segundo plano o con la computadora dormida los temporizadores se atrasan.
  const router = useRouter()
  const expiry = signatureExpiry(src)
  useEffect(() => {
    if (!expiry) return
    const check = () => {
      if (expiry - Date.now() < RENEW_BEFORE_MS) void router.invalidate()
    }
    const onVisible = () => document.visibilityState === 'visible' && check()
    const timer = setInterval(check, RENEW_CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [expiry, router])

  useEffect(() => {
    const video = videoRef.current
    const url = srcRef.current
    if (!video) return
    setFailed(false)
    native.current = null
    if (!isHls) {
      video.src = url
      return
    }
    let cancelled = false
    let stop = () => {}
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        const hls = new Hls({
          // Cada descarga (listas y segmentos) sale con la firma más nueva que haya.
          xhrSetup: (xhr, requestUrl) => {
            xhr.open('GET', withSignature(requestUrl, srcRef.current), true)
          },
        })
        // Firma vencida o por vencer (p. ej. al despertar la computadora): con la primera
        // descarga rechazada se pide otra firma; hls.js la usa en sus reintentos y, si ya se
        // había rendido, se reanuda la descarga al llegar.
        let renewing = false
        hls.on(Hls.Events.ERROR, (_event, error) => {
          const signed = signatureExpiry(srcRef.current)
          if (
            error.type === Hls.ErrorTypes.NETWORK_ERROR &&
            signed &&
            signed - Date.now() < RENEW_BEFORE_MS
          ) {
            if (error.fatal) onNewSignature.current = () => hls.startLoad()
            if (!renewing) {
              renewing = true
              void router.invalidate().finally(() => {
                renewing = false
              })
            }
            return
          }
          if (error.fatal) setFailed(true)
        })
        hls.loadSource(url)
        hls.attachMedia(video)
        stop = () => hls.destroy()
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        native.current = { url }
        video.src = url
      } else {
        setFailed(true)
      }
    })
    return () => {
      cancelled = true
      onNewSignature.current = null
      stop()
    }
  }, [sourceKey, isHls, videoRef, router])

  // Los ajustes guardados de la alumna se aplican al montar el video (una vez por lección).
  // `defaultPlaybackRate` hace que la velocidad sobreviva a la carga del archivo.
  useEffect(() => {
    const video = videoRef.current
    const prefs = readVideoPrefs()
    if (!video || !prefs) return
    video.defaultPlaybackRate = prefs.rate
    video.playbackRate = prefs.rate
    video.volume = prefs.volume
    video.muted = prefs.muted
    setRate(RATES.indexOf(prefs.rate))
    setVolume(prefs.volume)
    setMuted(prefs.muted)
  }, [videoRef])

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  function setSpeed(index: number) {
    const video = videoRef.current
    const next = Math.max(0, Math.min(RATES.length - 1, index))
    setRate(next)
    saveVideoPrefs({ rate: RATES[next] })
    if (!video) return
    video.defaultPlaybackRate = RATES[next]
    video.playbackRate = RATES[next]
  }

  // Con volumen en 0 el silencio no se quita con M: vuelve a la mitad.
  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    if (video.volume === 0) {
      video.volume = 0.5
      video.muted = false
    } else {
      video.muted = !video.muted
    }
  }

  // Fija el volumen (0 a 1); en 0 queda silenciado y al subirlo vuelve el sonido.
  function setLevel(level: number) {
    const video = videoRef.current
    if (!video) return
    video.volume = Math.max(0, Math.min(1, level))
    video.muted = video.volume === 0
  }

  function changeVolume(delta: number) {
    const video = videoRef.current
    if (!video) return
    setLevel(Math.round((video.volume + delta) * 10) / 10)
  }

  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen()
  }

  // Atajos de teclado. No actúan al escribir (campos de texto) ni con Ctrl/Cmd/Alt, y la barra
  // espaciadora se deja a los botones y enlaces que tengan el foco.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (
        target?.closest(
          'input:not([data-video-seek]):not([data-video-volume]), textarea, select, [contenteditable="true"]',
        )
      )
        return
      // Con el foco en el control de volumen, las flechas las maneja el propio control.
      if (target?.closest('[data-video-volume]') && e.key.startsWith('Arrow'))
        return
      const video = videoRef.current
      if (!video) return
      const onControl = !!target?.closest('button, a, [role="button"]')
      const skip = (seconds: number) =>
        seek(
          Math.max(
            0,
            Math.min(video.duration || Infinity, video.currentTime + seconds),
          ),
        )

      switch (e.key) {
        case ' ':
          if (onControl) return
          toggle()
          break
        case 'k':
        case 'K':
          toggle()
          break
        case 'ArrowLeft':
          skip(-SEEK_SHORT)
          break
        case 'ArrowRight':
          skip(SEEK_SHORT)
          break
        case 'j':
        case 'J':
          skip(-SEEK_LONG)
          break
        case 'l':
        case 'L':
          skip(SEEK_LONG)
          break
        case 'ArrowUp':
          changeVolume(VOLUME_STEP)
          break
        case 'ArrowDown':
          changeVolume(-VOLUME_STEP)
          break
        case 'm':
        case 'M':
          toggleMute()
          break
        case 'f':
        case 'F':
          fullscreen()
          break
        case '>':
          setSpeed(rate + 1)
          break
        case '<':
          setSpeed(rate - 1)
          break
        default:
          return
      }
      e.preventDefault()
      wake()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const icon = cn(
    'cursor-pointer border-0 bg-transparent p-0 text-white',
    compact ? 'text-xs' : 'text-base',
  )
  const soundIcon = cn('block', compact ? 'size-3.5' : 'size-4')

  return (
    <div
      ref={box}
      onPointerMove={(e) => {
        // Un toque también genera `pointermove`; ese se maneja en `onPointerDown`.
        if (e.pointerType !== 'mouse') return
        wake()
        // Se revisa en cada movimiento (y no con entrar/salir de la barra) porque al cambiar el
        // ícono de un botón el ratón "sale" de un elemento que ya no existe y no se avisa.
        setOverBar(!!bar.current?.contains(e.target as Node))
      }}
      onPointerDown={(e) => {
        tapOnlyShows.current = e.pointerType !== 'mouse' && hidden
        wake()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        setOverBar(false)
        setIdle(true)
      }}
      className={cn(
        'relative aspect-video flex-none overflow-hidden bg-player-video',
        !compact && 'rounded-16',
        hidden && 'cursor-none',
      )}
    >
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        onClick={() => {
          if (tapOnlyShows.current) tapOnlyShows.current = false
          else toggle()
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          const video = e.currentTarget
          setMuted(video.muted)
          setVolume(video.volume)
          saveVideoPrefs({ volume: video.volume, muted: video.muted })
        }}
        onPlay={() => {
          setPlaying(true)
          wake()
        }}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        className={cn(
          'absolute inset-0 size-full object-contain',
          hidden ? 'cursor-none' : 'cursor-pointer',
        )}
      />
      {/* Marca de agua (pedido del usuario): dentro del contenedor, así también sale en pantalla
          completa; no recibe clics. */}
      {!failed && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 right-3 text-sm font-black tracking-wide text-white/40 drop-shadow-sm select-none md:top-4 md:right-5 md:text-base"
        >
          Capagla
        </div>
      )}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-bold text-landing-lilac">
          No se pudo cargar el video.
        </div>
      ) : (
        <div
          ref={bar}
          // Solo el foco del teclado (Tab) la mantiene visible: un clic también deja el foco en
          // el botón, y entonces la barra no se ocultaría hasta hacer clic en otro lado.
          onFocus={(e) => setFocusInBar(e.target.matches(':focus-visible'))}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocusInBar(false)
          }}
          className={cn(
            'absolute inset-x-0 bottom-0 flex flex-col bg-black/55 text-left text-white transition-opacity duration-300',
            hidden && 'pointer-events-none opacity-0',
            compact
              ? 'gap-1.5 px-3 pt-2 pb-2.5 text-xs'
              : 'gap-2.5 px-4.5 pt-3 pb-3.5 text-13',
          )}
        >
          <div
            className={cn(
              'relative flex items-center',
              compact ? 'h-4' : 'h-4.5',
            )}
          >
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/30" />
            <div
              className="absolute left-0 h-1 rounded-full bg-player-fill"
              style={{ width: `${pct(time)}%` }}
            />
            {parts.map((p) => (
              <span
                key={p.seconds}
                className={cn(
                  'absolute top-0.5 w-0.5 bg-white',
                  compact ? 'h-3' : 'h-3.5',
                )}
                style={{ left: `${pct(p.seconds)}%` }}
              />
            ))}
            {moments.map((m) => (
              <span
                key={m.id}
                className={cn(
                  'absolute top-0.75 rotate-45 rounded-xs bg-player-moment',
                  compact ? 'size-2.5' : 'size-3',
                )}
                style={{ left: `${pct(m.seconds)}%` }}
              />
            ))}
            <span
              className={cn(
                'absolute top-px rounded-full bg-white',
                compact ? '-ml-1.75 size-3.5' : '-ml-2 size-4',
              )}
              style={{ left: `${pct(time)}%` }}
            />
            <input
              type="range"
              min={0}
              max={total || 1}
              step={0.1}
              value={Math.min(time, total || 1)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Posición del video"
              data-video-seek
              className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <div className={cn('flex items-center', compact ? 'gap-3' : 'gap-4')}>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
              className={icon}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <span className="whitespace-nowrap">
              {clock(time)} / {clock(total)}
            </span>
            <span className="min-w-0 flex-1 truncate text-landing-lilac">
              {part && (compact ? part.title : `Parte actual: ${part.title}`)}
            </span>
            {!compact && (
              <button
                type="button"
                onClick={() => setSpeed((rate + 1) % RATES.length)}
                aria-label="Velocidad"
                className="cursor-pointer rounded-md border-0 bg-white/20 px-2 py-0.5 font-bold text-white"
              >
                {RATES[rate]}x
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={silent ? 'Activar sonido' : 'Silenciar'}
                className={icon}
              >
                {silent ? (
                  <VolumeX className={soundIcon} aria-hidden="true" />
                ) : (
                  <Volume2 className={soundIcon} aria-hidden="true" />
                )}
              </button>
              {/* Volumen (no está en la maqueta): mismo estilo que la barra de avance. En móvil
                  no va: el volumen es el del teléfono (en iPhone el navegador no lo permite). */}
              {!compact && (
                <div className="relative flex h-4.5 w-20 items-center">
                  <div className="absolute inset-x-0 h-1 rounded-full bg-white/30" />
                  <div
                    className="absolute left-0 h-1 rounded-full bg-player-fill"
                    style={{ width: `${silent ? 0 : volume * 100}%` }}
                  />
                  <span
                    className="absolute size-3 rounded-full bg-white"
                    style={{
                      left: `calc(${silent ? 0 : volume} * (100% - 12px))`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={silent ? 0 : volume}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    aria-label="Volumen"
                    data-video-volume
                    className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={fullscreen}
              aria-label="Pantalla completa"
              className={icon}
            >
              ⛶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
