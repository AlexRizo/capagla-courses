import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  input,
  label,
  note,
  primaryButton,
} from '#/components/admin/form-styles'
import { UploadBox } from '#/components/admin/upload-field'
import { removeCourseCover, updateCourseSettings } from '#/lib/admin-courses'
import { cn } from '#/lib/utils'

type Settings = {
  name: string
  description: string
  coverUrl: string | null
  priceMxn: number
  accessDays: number
  published: boolean
}

const choice = 'flex-1 cursor-pointer rounded-md p-2 text-center font-medium'

// Panel derecho del editor con "Ajustes del curso".
export function CourseSettings({
  slug,
  settings,
}: {
  slug: string
  settings: Settings
}) {
  const router = useRouter()
  const [published, setPublished] = useState(settings.published)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setMessage(null)
    try {
      await updateCourseSettings({
        data: {
          slug,
          name: String(form.get('name')),
          description: String(form.get('description')),
          priceMxn: Number(form.get('priceMxn')),
          accessDays: Number(form.get('accessDays')),
          published,
        },
      })
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar. Revisa los datos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-1 basis-95 flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Ajustes del curso</div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
          {settings.published ? 'Publicado' : 'Borrador'}
        </span>
      </div>

      <div className={field}>
        <label htmlFor="name" className={label}>
          Título
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={settings.name}
          className={input}
        />
      </div>

      <div className={field}>
        <label htmlFor="description" className={label}>
          Descripción corta
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={settings.description}
          placeholder="Una o dos frases que se ven en la tarjeta del curso"
          className="box-border min-h-18 resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm"
        />
      </div>

      <div className={field}>
        <span className={label}>Portada</span>
        {settings.coverUrl && (
          <div className="flex items-center justify-between gap-3">
            <img
              src={settings.coverUrl}
              alt=""
              className="h-16 rounded-md border border-border object-cover"
            />
            <button
              type="button"
              onClick={async () => {
                await removeCourseCover({ data: { slug } })
                await router.invalidate()
              }}
              className="cursor-pointer border-none bg-transparent p-0 text-13 text-muted-foreground underline"
            >
              Quitar
            </button>
          </div>
        )}
        <UploadBox target="cover" id={slug} accept=".jpg,.jpeg,.png,.webp">
          Arrastra una imagen o haz clic para subirla
        </UploadBox>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className={cn(field, 'flex-1 basis-40')}>
          <label htmlFor="priceMxn" className={label}>
            Precio normal (MXN)
          </label>
          <input
            id="priceMxn"
            name="priceMxn"
            inputMode="numeric"
            required
            defaultValue={settings.priceMxn}
            className={input}
          />
        </div>
        <div className={cn(field, 'flex-1 basis-40')}>
          <label htmlFor="accessDays" className={label}>
            Acceso (días)
          </label>
          <input
            id="accessDays"
            name="accessDays"
            inputMode="numeric"
            required
            defaultValue={settings.accessDays}
            className={input}
          />
        </div>
      </div>

      <div className={note}>
        Este es el precio de la página normal. Los precios especiales por fecha
        se definen en <strong>Landings y precios</strong>.
      </div>

      <div className={field}>
        <span className={label}>Estado</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPublished(true)}
            className={cn(
              choice,
              published
                ? 'border-none bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground',
            )}
          >
            Publicado
          </button>
          <button
            type="button"
            onClick={() => setPublished(false)}
            className={cn(
              choice,
              published
                ? 'border border-border bg-card text-foreground'
                : 'border-none bg-primary text-primary-foreground',
            )}
          >
            Borrador
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
      </div>
    </form>
  )
}
