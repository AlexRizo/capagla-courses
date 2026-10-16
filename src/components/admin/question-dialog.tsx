import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { field, label, primaryButton } from '#/components/admin/form-styles'
import {
  MAX_ANSWER_LENGTH,
  answerQuestion,
  hideQuestion,
} from '#/lib/admin-questions'
import type { getAdminQuestions } from '#/lib/admin-questions'
import { cn } from '#/lib/utils'

export type AdminQuestion = Awaited<ReturnType<typeof getAdminQuestions>>[0]

const secondaryButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium text-foreground disabled:opacity-60'

// La respuesta que escribe la chef. Cada pregunta tiene su propio formulario (se reinicia al cambiar).
function AnswerForm({
  question,
  onHidden,
}: {
  question: AdminQuestion
  onHidden: () => void
}) {
  const router = useRouter()
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(
    action: () => Promise<{ error?: string }>,
    done?: () => void,
  ) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.error) return setError(result.error)
      await router.invalidate()
      done?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="answer" className={label}>
          Tu respuesta
        </label>
        <textarea
          id="answer"
          value={answer}
          maxLength={MAX_ANSWER_LENGTH}
          onChange={(e) => setAnswer(e.target.value)}
          className="box-border min-h-35 resize-y rounded-md border border-border bg-card px-3 py-2.5 font-admin text-sm leading-normal text-foreground"
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={busy || !answer.trim()}
          onClick={() =>
            run(() => answerQuestion({ data: { id: question.id, answer } }))
          }
          className={primaryButton}
        >
          Publicar respuesta
        </button>
        {question.status === 'PENDING' && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => hideQuestion({ data: { id: question.id } }), onHidden)
            }
            className={secondaryButton}
          >
            Ocultar pregunta
          </button>
        )}
      </div>
      {error && <div className="text-13 text-destructive">{error}</div>}
      <div className="text-13 leading-normal text-muted-foreground">
        Al publicar, la pregunta y tu respuesta quedan visibles en esa lección y
        la alumna recibe un correo.
      </div>
    </>
  )
}

// Ventana de una pregunta: "Responder" y "Lección y transcripción" (sin transcripción por ahora).
export function QuestionDialog({
  question,
  tab,
  onTab,
  onClose,
}: {
  question: AdminQuestion
  tab: 'responder' | 'leccion'
  onTab: (tab: 'responder' | 'leccion') => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs = [
    ['responder', 'Responder'],
    ['leccion', 'Lección y transcripción'],
  ] as const

  return (
    <div className="fixed inset-0 z-20 box-border flex items-center justify-center bg-black/45 p-8">
      <div
        role="dialog"
        aria-label={`Pregunta de ${question.who}`}
        className="flex max-h-full w-full max-w-180 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-admin-dialog"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">
              Pregunta de {question.who}
            </span>
            <span className="text-xs text-muted-foreground">
              {question.lesson} · {question.when}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="size-8 cursor-pointer rounded-md border border-border bg-card font-admin text-base text-foreground"
          >
            ×
          </button>
        </div>
        <div className="flex border-b border-border px-3">
          {tabs.map(([id, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cn(
                'h-8.5 flex-1 cursor-pointer border-0 border-b-2 bg-transparent font-admin text-13 font-medium',
                tab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground',
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3.5 overflow-auto p-5">
          {tab === 'responder' && (
            <>
              <div className="leading-normal font-medium">{question.text}</div>
              {question.status === 'ANSWERED' ? (
                <>
                  <div className="rounded-md border border-border bg-muted p-3 leading-normal whitespace-pre-line text-chart-3">
                    {question.answer}
                  </div>
                  <div className="rounded-md bg-accent px-3 py-2.5 text-chart-4">
                    Respondida y publicada en la lección. La alumna ya recibió
                    el correo.
                  </div>
                </>
              ) : (
                <AnswerForm
                  key={question.id}
                  question={question}
                  onHidden={onClose}
                />
              )}
            </>
          )}
          {tab === 'leccion' && (
            <div className={field}>
              {question.videoUrl ? (
                <video
                  src={question.videoUrl}
                  controls
                  className="aspect-video w-full max-w-105 rounded-lg bg-zinc-900"
                />
              ) : (
                <div className="flex aspect-video w-full max-w-105 items-center justify-center rounded-lg bg-zinc-900 text-13 text-zinc-400">
                  [Video de la lección]
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
