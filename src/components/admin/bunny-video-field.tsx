import { useEffect, useRef, useState } from 'react'
import { Upload } from 'tus-js-client'

import { field, input, label } from '#/components/admin/form-styles'
import {
  cancelVideoUpload,
  getBunnyVideos,
  startVideoUpload,
} from '#/lib/admin-bunny'
import { formatDuration } from '#/lib/duration'

type Library = Awaited<ReturnType<typeof getBunnyVideos>>

// "Video" de una lección de video: el archivo de la biblioteca de Bunny y su duración,
// con "Reemplazar" para elegir otro y "Subir nuevo" para mandar un archivo a Bunny desde aquí
// (directo del navegador, con TUS; el servidor solo crea el video y firma la subida).
// La duración sale del propio archivo.
export function BunnyVideoField({
  value,
  onChange,
  label: title = 'Video',
}: {
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [upload, setUpload] = useState<{
    name: string
    percent: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const running = useRef<{ tus: Upload; videoId: string } | null>(null)

  const refresh = () => getBunnyVideos().then(setLibrary)

  useEffect(() => {
    void refresh()
  }, [])

  // Subir un video no se puede reanudar al cambiar de lección o cerrar la página: se cancela y
  // se quita el video vacío; mientras sube, el navegador avisa antes de cerrar.
  useEffect(() => {
    if (!upload) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [upload])
  useEffect(
    () => () => {
      if (running.current) void stop(running.current)
    },
    [],
  )

  async function stop({ tus, videoId }: { tus: Upload; videoId: string }) {
    running.current = null
    await tus.abort(true).catch(() => {})
    await cancelVideoUpload({ data: { id: videoId } }).catch(() => {})
  }

  async function send(selected: File | undefined) {
    if (file.current) file.current.value = ''
    if (!selected) return
    setError(null)
    if (!selected.type.startsWith('video/')) {
      setError('Elige un archivo de video.')
      return
    }
    setUpload({ name: selected.name, percent: 0 })
    let started
    try {
      started = await startVideoUpload({
        data: {
          filename: selected.name,
          type: selected.type,
          size: selected.size,
        },
      })
    } catch {
      setUpload(null)
      setError(
        'No se pudo preparar la subida. Revisa Bunny e intenta de nuevo.',
      )
      return
    }
    const tus = new Upload(selected, {
      endpoint: 'https://video.bunnycdn.com/tusupload',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: started.signature,
        AuthorizationExpire: String(started.expire),
        VideoId: started.videoId,
        LibraryId: started.libraryId,
      },
      metadata: { filetype: selected.type, title: started.title },
      onProgress: (sent, total) =>
        setUpload({
          name: selected.name,
          percent: Math.floor((sent / total) * 100),
        }),
      onError: () => {
        const current = { tus, videoId: started.videoId }
        void stop(current)
        setUpload(null)
        setError('No se pudo subir el video. Intenta de nuevo.')
      },
      onSuccess: () => {
        running.current = null
        setUpload(null)
        // Bunny lo procesa en unos minutos; queda elegido (falta Guardar) y se avisa.
        void refresh().then(() => {
          onChange(started.videoId)
          setOpen(false)
        })
      },
    })
    running.current = { tus, videoId: started.videoId }
    tus.start()
  }

  // Mientras Bunny procesa el video elegido, se revisa cada 10 s hasta que termina.
  const processing =
    library?.configured &&
    library.videos?.some((v) => v.id === value && !v.ready)
  useEffect(() => {
    if (!processing) return
    const timer = setTimeout(() => void refresh(), 10_000)
    return () => clearTimeout(timer)
  }, [processing, library])

  const videos = library?.configured ? library.videos : null
  const current = videos?.find((v) => v.id === value)
  const shown = (videos ?? []).filter((v) =>
    v.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  let text = 'Sin video'
  if (value) {
    text = current
      ? `${current.title} · ${formatDuration(current.durationSec)}`
      : library
        ? 'Video de Bunny no encontrado'
        : 'Cargando…'
    if (current && !current.ready) text = `${current.title} · Procesando…`
  }

  return (
    <div className={field}>
      <span className={label}>{title}</span>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
        <span className="min-w-0 truncate">{text}</span>
        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => file.current?.click()}
            disabled={!videos || !!upload}
            className="cursor-pointer border-0 bg-transparent p-0 font-admin font-medium text-foreground disabled:cursor-default disabled:opacity-50"
          >
            Subir nuevo
          </button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            disabled={!videos || !!upload}
            className="cursor-pointer border-0 bg-transparent p-0 font-admin font-medium text-foreground disabled:cursor-default disabled:opacity-50"
          >
            {value ? 'Reemplazar' : 'Elegir'}
          </button>
        </span>
      </div>
      <input
        ref={file}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => void send(e.target.files?.[0])}
      />
      {upload && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-13">
            <span className="min-w-0 truncate">
              Subiendo {upload.name} · {upload.percent}%
            </span>
            <button
              type="button"
              onClick={() => {
                const active = running.current
                setUpload(null)
                if (active) void stop(active)
              }}
              className="cursor-pointer border-0 bg-transparent p-0 font-admin text-13 font-medium text-destructive"
            >
              Cancelar
            </button>
          </div>
          <div
            role="progressbar"
            aria-valuenow={upload.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de la subida"
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${upload.percent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            No cierres esta página hasta que termine. Después Bunny lo procesa
            unos minutos.
          </span>
        </div>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
      {library && !library.configured && (
        <span className="text-xs text-muted-foreground">
          Bunny no está configurado (faltan sus variables en el servidor).
        </span>
      )}
      {library?.configured && !videos && (
        <span className="text-xs text-muted-foreground">
          No se pudo leer la biblioteca de Bunny.
        </span>
      )}
      {open && videos && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
            aria-label="Buscar video"
            className={input}
          />
          <div className="flex max-h-60 flex-col overflow-y-auto">
            {shown.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.ready}
                onClick={() => {
                  onChange(v.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex cursor-pointer flex-col items-start gap-0.5 rounded-md border-0 bg-transparent px-2 py-1.5 text-left font-admin text-13 text-foreground hover:bg-accent disabled:cursor-default disabled:opacity-50"
              >
                <span className="max-w-full truncate">
                  {v.title} · {formatDuration(v.durationSec)}
                </span>
                {(v.usedBy || !v.ready) && (
                  <span className="text-xs text-muted-foreground">
                    {v.ready ? `Ya en: ${v.usedBy}` : 'Procesando'}
                  </span>
                )}
              </button>
            ))}
            {shown.length === 0 && (
              <span className="px-2 py-1.5 text-13 text-muted-foreground">
                Sin resultados.
              </span>
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="cursor-pointer self-start border-0 bg-transparent px-2 py-1 font-admin text-13 font-medium text-destructive"
            >
              Quitar video
            </button>
          )}
        </div>
      )}
    </div>
  )
}
