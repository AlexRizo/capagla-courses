import { useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { removeResource } from '#/lib/admin-courses'
import { cn } from '#/lib/utils'

// Recuadro punteado de la maqueta: se arrastran archivos o se hace clic para elegirlos.
// Cada archivo se sube a `/api/uploads` (portada o recurso) y luego se recargan los datos.
export function UploadBox({
  target,
  id,
  accept,
  multiple,
  children,
}: {
  target: 'cover' | 'resource'
  id: string
  accept: string
  multiple?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(files: File[]) {
    if (!files.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of multiple ? files : files.slice(0, 1)) {
        const body = new FormData()
        body.set('target', target)
        body.set('id', id)
        body.set('file', file)
        const res = await fetch('/api/uploads', { method: 'POST', body })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setError(`${file.name}: ${data?.error ?? 'No se pudo subir.'}`)
          break
        }
        await router.invalidate()
      }
    } catch {
      setError('No se pudo subir el archivo.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void upload([...e.dataTransfer.files])
        }}
        className={cn(
          'cursor-pointer rounded-md border border-dashed border-ring bg-transparent px-3 py-2.5 text-left text-sm text-muted-foreground',
          over && 'bg-muted',
        )}
      >
        {busy ? 'Subiendo…' : children}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => void upload([...(e.target.files ?? [])])}
      />
      {error && <span className="text-13 text-destructive">{error}</span>}
    </>
  )
}

// Archivos ya subidos de un capítulo o lección, con "Quitar".
export function ResourceFiles({
  resources,
}: {
  resources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(id: string) {
    setBusy(id)
    try {
      await removeResource({ data: { id } })
      await router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {resources.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
        >
          <span className="truncate">{r.name}</span>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => void remove(r.id)}
            className="cursor-pointer border-none bg-transparent p-0 text-13 text-muted-foreground underline disabled:opacity-60"
          >
            Quitar
          </button>
        </div>
      ))}
    </>
  )
}
