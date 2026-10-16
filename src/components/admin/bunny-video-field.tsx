import { useEffect, useState } from 'react'

import { field, input, label } from '#/components/admin/form-styles'
import { getBunnyVideos } from '#/lib/admin-bunny'
import { formatDuration } from '#/lib/duration'

type Library = Awaited<ReturnType<typeof getBunnyVideos>>

// "Video" de una lección de video: el archivo de la biblioteca de Bunny y su duración,
// con "Reemplazar" para elegir otro. La duración sale del propio archivo.
export function BunnyVideoField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void getBunnyVideos().then(setLibrary)
  }, [])

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
  }

  return (
    <div className={field}>
      <span className={label}>Video</span>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
        <span className="min-w-0 truncate">{text}</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={!videos}
          className="cursor-pointer border-0 bg-transparent p-0 font-admin font-medium text-foreground disabled:cursor-default disabled:opacity-50"
        >
          {value ? 'Reemplazar' : 'Elegir'}
        </button>
      </div>
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
