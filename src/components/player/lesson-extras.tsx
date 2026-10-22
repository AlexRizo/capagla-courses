import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'

import { RichTextView } from '#/components/rich-text-view'
import type { getPlayer } from '#/lib/player'
import { cn } from '#/lib/utils'

import { Questions } from './questions'

export type PlayerResource = { id: string; name: string; url: string }

// Lección de texto sin texto que solo trae enlaces de descarga (la "Receta" de cada capítulo: el
// PDF de la receta). El enlace va en lugar del texto, no repetido en "Recursos".
export const isDownloadLesson = (lesson: {
  type: string
  body: unknown
  resources: PlayerResource[]
}) => lesson.type === 'TEXT' && !lesson.body && lesson.resources.length > 0

const sectionLabel =
  'text-11 font-black tracking-player-caps text-player-accent'

export function DownloadRow({ resource }: { resource: PlayerResource }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-12 border border-player-border bg-player-surface px-3.5 py-3.25">
      <span className="text-sm">{resource.name}</span>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className="text-13 font-bold text-player-accent no-underline"
      >
        Descargar
      </a>
    </div>
  )
}

// Notas, recursos y preguntas de ESTA lección. Notas y recursos solo aparecen si la lección
// los tiene; Preguntas siempre.
export function LessonTabs({
  lessonId,
  notes,
  resources,
  questions,
  assistant,
}: {
  lessonId: string
  notes: string | null
  resources: PlayerResource[]
  questions: Awaited<ReturnType<typeof getPlayer>>['lesson']['questions']
  assistant: boolean
}) {
  const tabs = [
    ...(notes ? [{ id: 'notas', label: 'Notas' }] : []),
    ...(resources.length ? [{ id: 'recursos', label: 'Recursos' }] : []),
    { id: 'preguntas', label: `Preguntas · ${questions.length}` },
  ]
  const [selected, setSelected] = useState(tabs[0].id)
  const tab = tabs.some((t) => t.id === selected) ? selected : tabs[0].id

  return (
    <div className="flex flex-none flex-col overflow-hidden rounded-16 border border-player-border bg-player-surface">
      <div className="flex flex-wrap items-center border-b border-player-border px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={cn(
              'cursor-pointer border-0 border-b-3 bg-transparent px-4 pt-4 pb-3.5 font-sans text-15 font-bold',
              t.id === tab
                ? 'border-player-accent text-player-accent'
                : 'border-transparent text-player-muted',
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="pr-2 text-xs text-player-muted">
          Solo de esta lección
        </span>
      </div>
      <div className="flex flex-col gap-3 px-6 py-5.5">
        {tab === 'notas' && (
          <div className="flex flex-col gap-2">
            <div className="text-lg font-black">Notas de esta lección</div>
            <div className="text-15 leading-160 whitespace-pre-line text-player-muted">
              {notes}
            </div>
          </div>
        )}
        {tab === 'recursos' && (
          <div className="flex flex-col gap-2.5">
            <div className="text-lg font-black">Recursos de esta lección</div>
            {resources.map((r) => (
              <DownloadRow key={r.id} resource={r} />
            ))}
          </div>
        )}
        {tab === 'preguntas' && (
          <Questions
            lessonId={lessonId}
            questions={questions}
            assistant={assistant}
          />
        )}
      </div>
    </div>
  )
}

export const hasChapterMaterial = (
  chapter: { recipe: JSONContent | null; resources: PlayerResource[] } | null,
) => !!chapter && (chapter.recipe !== null || chapter.resources.length > 0)

// Material del capítulo: se ve en todas sus lecciones. La receta es el texto que escribió
// la chef; si el capítulo no tiene material, este bloque no aparece.
export function ChapterMaterial({
  chapter,
  note = true,
}: {
  chapter: {
    title: string
    recipe: JSONContent | null
    resources: PlayerResource[]
  }
  // El aviso "Se ve en todas las lecciones…" solo va en el panel de escritorio.
  note?: boolean
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className={`${sectionLabel} uppercase`}>
        Del capítulo · {chapter.title}
      </div>
      {chapter.recipe && (
        <div className="flex flex-col gap-3.5 rounded-14 border border-player-border bg-player-surface p-4">
          <div className="text-17 font-black">Receta</div>
          <RichTextView
            doc={chapter.recipe}
            className="gap-0 text-sm leading-normal text-player-muted [&_h3]:mt-3.5 [&_h3]:mb-1 [&_h3]:leading-natural [&_h3]:text-player-text [&_h3:first-child]:mt-0 [&_p+p]:mt-2"
          />
        </div>
      )}
      {chapter.resources.map((r) => (
        <DownloadRow key={r.id} resource={r} />
      ))}
      {note && (
        <div className="text-xs leading-normal text-player-muted">
          Se ve en todas las lecciones de este capítulo.
        </div>
      )}
    </div>
  )
}
