import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { JSONContent } from '@tiptap/react'

import {
  field,
  input,
  label,
  note,
  primaryButton,
} from '#/components/admin/form-styles'
import { RichTextEditor } from '#/components/admin/rich-text-editor'
import { ResourceFiles, UploadBox } from '#/components/admin/upload-field'
import { updateChapter } from '#/lib/admin-courses'

// Panel derecho del editor para un capítulo: nombre y receta.
export function ChapterSettings({
  id,
  title,
  published,
  recipe,
  resources,
  convert,
  remove,
}: {
  id: string
  title: string
  published: boolean
  recipe: JSONContent | null
  resources: { id: string; name: string }[]
  convert: React.ReactNode
  remove: React.ReactNode
}) {
  const router = useRouter()
  const [doc, setDoc] = useState<JSONContent | null>(recipe)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setMessage(null)
    try {
      await updateChapter({
        data: { id, title: String(form.get('title')), recipe: doc },
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
        <div className="text-base font-semibold">Editar capítulo</div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
          {published ? 'Publicado' : 'Borrador'}
        </span>
      </div>

      <div className={field}>
        <label htmlFor="title" className={label}>
          Nombre
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={title}
          className={input}
        />
      </div>

      <div className={note}>
        Lo que subas aquí se ve en el panel derecho (“Material”) de{' '}
        <strong>todas</strong> las lecciones de este capítulo. Si no subes nada,
        el panel no aparece.
      </div>

      <div className={field}>
        <span className={label}>Receta del capítulo</span>
        <RichTextEditor
          value={recipe}
          onChange={setDoc}
          placeholder="Utensilios, ingredientes y procedimiento"
        />
      </div>

      <div className={field}>
        <span className={label}>Recursos del capítulo</span>
        <ResourceFiles resources={resources} />
        <UploadBox
          target="resource"
          id={id}
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx"
        >
          Arrastra archivos o haz clic para subirlos (recetario PDF)
        </UploadBox>
      </div>

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
        {convert}
        {remove}
      </div>
    </form>
  )
}
