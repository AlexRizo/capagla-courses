import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { JSONContent } from '@tiptap/react'

import {
  field,
  input,
  label,
  primaryButton,
} from '#/components/admin/form-styles'
import { BunnyVideoField } from '#/components/admin/bunny-video-field'
import { RichTextEditor } from '#/components/admin/rich-text-editor'
import { ResourceFiles, UploadBox } from '#/components/admin/upload-field'
import { updateLesson } from '#/lib/admin-courses'
import { cn } from '#/lib/utils'

type Lesson = {
  id: string
  title: string
  published: boolean
  lessonType: 'VIDEO' | 'TEXT' | null
  bunnyVideoId: string | null
  body: JSONContent | null
  notes: string | null
  videoParts: string | null
  resources: { id: string; name: string }[]
}

const choice = 'flex-1 cursor-pointer rounded-md p-2 text-center font-medium'

// Panel derecho del editor para una lección: título, tipo y su contenido.
export function LessonSettings({
  slug,
  lesson,
  convert,
  remove,
}: {
  slug: string
  lesson: Lesson
  convert: React.ReactNode
  remove: React.ReactNode
}) {
  const router = useRouter()
  const [type, setType] = useState(lesson.lessonType ?? 'VIDEO')
  const [doc, setDoc] = useState<JSONContent | null>(lesson.body)
  const [videoId, setVideoId] = useState(lesson.bunnyVideoId)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setMessage(null)
    try {
      await updateLesson({
        data: {
          id: lesson.id,
          title: String(form.get('title')),
          lessonType: type,
          bunnyVideoId: videoId ?? '',
          body: doc,
          notes: String(form.get('notes') ?? ''),
          videoParts: String(form.get('videoParts') ?? ''),
        },
      })
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage(
        'No se pudo guardar. Revisa los datos (una parte por línea como "2:10 Título", y que el video siga en la biblioteca de Bunny).',
      )
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
        <div className="text-base font-semibold">Editar lección</div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
          {lesson.published ? 'Publicada' : 'Borrador'}
        </span>
      </div>

      <div className={field}>
        <label htmlFor="title" className={label}>
          Título
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={lesson.title}
          className={input}
        />
      </div>

      <div className={field}>
        <span className={label}>Tipo de lección</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('VIDEO')}
            className={cn(
              choice,
              type === 'VIDEO'
                ? 'border-none bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground',
            )}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setType('TEXT')}
            className={cn(
              choice,
              type === 'TEXT'
                ? 'border-none bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground',
            )}
          >
            Receta o texto
          </button>
        </div>
      </div>

      {type === 'VIDEO' ? (
        <BunnyVideoField value={videoId} onChange={setVideoId} />
      ) : (
        <div className={field}>
          <span className={label}>Texto de la lección</span>
          <RichTextEditor
            value={lesson.body}
            onChange={setDoc}
            placeholder="Receta o texto de la lección"
          />
        </div>
      )}

      <div className={field}>
        <label htmlFor="notes" className={label}>
          Notas de la lección{' '}
          <span className="font-normal text-muted-foreground">
            · solo de esta lección
          </span>
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={lesson.notes ?? ''}
          placeholder="Solo se muestran si escribes algo"
          className="box-border min-h-18 resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm"
        />
      </div>

      <div className={field}>
        <span className={label}>
          Recursos{' '}
          <span className="font-normal text-muted-foreground">
            · solo de esta lección
          </span>
        </span>
        <ResourceFiles resources={lesson.resources} />
        <UploadBox
          target="resource"
          id={lesson.id}
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx"
        >
          Arrastra archivos o haz clic para subirlos (PDF, plantillas)
        </UploadBox>
      </div>

      {type === 'VIDEO' && (
        <div className={field}>
          <label htmlFor="videoParts" className={label}>
            Partes del video
          </label>
          <textarea
            id="videoParts"
            name="videoParts"
            defaultValue={lesson.videoParts ?? ''}
            placeholder={
              'Pega una parte por línea:\n0:00 Ingredientes\n2:10 Derretir el chocolate\n6:45 Mezcla'
            }
            className="box-border min-h-26 resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
          />
          <span className="text-xs text-muted-foreground">
            Una línea por parte: minuto, un espacio y el título. Es opcional. Si
            cambias el video, revisa estas partes.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
        <a
          href={`/mis-cursos/${slug}/${lesson.id}?vista=alumna`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3.5 font-medium whitespace-nowrap text-foreground no-underline"
        >
          Ver como alumna
        </a>
        {convert}
        {remove}
      </div>
      <div className="text-xs text-muted-foreground">
        «Ver como alumna» abre el reproductor tal como lo vería una alumna que
        compró, sin guardar progreso. Úsalo antes de publicar cambios.
      </div>
    </form>
  )
}
