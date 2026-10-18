import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  field,
  input,
  label,
  primaryButton,
} from '#/components/admin/form-styles'
import {
  MAX_ANSWER_LENGTH,
  answerQuestion,
  generateDraft,
  getLessonTranscript,
  hideQuestion,
} from '#/lib/admin-questions'
import type { getAdminQuestions } from '#/lib/admin-questions'
import { clock, fold } from '#/lib/transcript'
import type { TranscriptLine } from '#/lib/transcript'
import { cn } from '#/lib/utils'

export type AdminQuestion = Awaited<ReturnType<typeof getAdminQuestions>>[0]

const secondaryButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium text-foreground disabled:opacity-60'

// La respuesta que escribe la chef. Cada pregunta tiene su propio formulario (se reinicia al cambiar).
// Con asistente de IA, arranca con su borrador (se genera al abrir la pregunta).
function AnswerForm({
  question,
  assistant,
  onHidden,
}: {
  question: AdminQuestion
  assistant: boolean
  onHidden: () => void
}) {
  const router = useRouter()
  const [answer, setAnswer] = useState(question.draft ?? '')
  const [draft, setDraft] = useState(question.draft ?? '')
  const [drafting, setDrafting] = useState(assistant && !question.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function makeDraft(regenerate: boolean) {
    // Regenerar reemplaza lo escrito: se pregunta si ya lo cambió.
    if (
      regenerate &&
      answer.trim() &&
      answer !== draft &&
      !window.confirm('Se reemplazará lo que escribiste. ¿Continuar?')
    ) {
      return
    }
    setDrafting(true)
    setError(null)
    try {
      const result = await generateDraft({
        data: { id: question.id, regenerate },
      })
      if (result.error) return setError(result.error)
      const next = result.draft ?? ''
      // Al abrir, no pisa lo que la chef alcanzó a escribir.
      setAnswer((current) => (regenerate || !current.trim() ? next : current))
      setDraft(next)
      await router.invalidate()
    } catch {
      setError('No se pudo generar el borrador. Inténtalo de nuevo.')
    } finally {
      setDrafting(false)
    }
  }

  useEffect(() => {
    if (assistant && !question.draft) void makeDraft(false)
    // Una vez por pregunta (el formulario se reinicia al cambiar de pregunta).
  }, [])

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
        <div className="flex items-center justify-between">
          <label htmlFor="answer" className={label}>
            Tu respuesta
          </label>
          {assistant && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-chart-4">
              Borrador de la IA · editable
            </span>
          )}
        </div>
        <textarea
          id="answer"
          value={answer}
          maxLength={MAX_ANSWER_LENGTH}
          disabled={drafting && !answer}
          placeholder={drafting ? 'Generando el borrador…' : undefined}
          onChange={(e) => setAnswer(e.target.value)}
          className="box-border min-h-35 resize-y rounded-md border border-border bg-card px-3 py-2.5 font-admin text-sm leading-normal text-foreground"
        />
      </div>
      {assistant && (
        <div className="text-xs leading-normal text-muted-foreground">
          El borrador sale de la transcripción de la lección. Revisa que
          coincida con el video antes de publicar.
        </div>
      )}
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
        {assistant && (
          <button
            type="button"
            disabled={busy || drafting}
            onClick={() => makeDraft(true)}
            className={secondaryButton}
          >
            Regenerar con IA
          </button>
        )}
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
        {assistant &&
          ' Solo se guardan las respuestas de la chef; las del asistente no se publican.'}
      </div>
    </>
  )
}

const VOTE_TEXT = {
  UP: 'Votó: me sirvió',
  DOWN: 'Votó: no me sirvió',
} as const

// "Buscar en la transcripción": las líneas con su minuto, filtradas por lo que escribe.
function Transcript({ itemId }: { itemId: string }) {
  const [lines, setLines] = useState<TranscriptLine[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let current = true
    getLessonTranscript({ data: { itemId } })
      .then((result) => current && setLines(result))
      .catch(() => current && setLines([]))
    return () => {
      current = false
    }
  }, [itemId])

  const shown = (lines ?? []).filter(
    (l) => !search.trim() || fold(l.x).includes(fold(search.trim())),
  )
  // Sin marcas de tiempo (texto plano) no hay minuto que mostrar.
  const timed = (lines ?? []).some((l) => l.t > 0)

  return (
    <>
      <div className={field}>
        <label htmlFor="transcript-search" className={label}>
          Buscar en la transcripción
        </label>
        <input
          id="transcript-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ej. mantequilla"
          className={input}
        />
      </div>
      <div className="flex flex-col rounded-md border border-border">
        {shown.map((l, i) => (
          <div
            key={i}
            className="flex gap-3 border-t border-accent px-3 py-2.5 leading-normal first:border-t-0"
          >
            {timed && (
              <span className="w-10 flex-none pt-0.5 font-mono text-xs text-muted-foreground">
                {clock(l.t)}
              </span>
            )}
            <span className="text-chart-5">{l.x}</span>
          </div>
        ))}
        {lines !== null && shown.length === 0 && (
          <div className="p-3 text-muted-foreground">
            {lines.length === 0
              ? 'Esta lección aún no tiene transcripción.'
              : 'Sin resultados en la transcripción.'}
          </div>
        )}
      </div>
    </>
  )
}

// Ventana de una pregunta: "Responder" y "Lección y transcripción".
export function QuestionDialog({
  question,
  assistant,
  tab,
  onTab,
  onClose,
}: {
  question: AdminQuestion
  assistant: boolean
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
              {question.assistantAnswer && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Lo que ya le respondió el asistente
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4">
                      {question.vote ? VOTE_TEXT[question.vote] : 'Sin voto'}
                    </span>
                  </div>
                  <div className="rounded-md border border-border bg-muted p-3 leading-normal whitespace-pre-line text-chart-3">
                    {question.assistantAnswer}
                  </div>
                </>
              )}
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
                  assistant={assistant}
                  onHidden={onClose}
                />
              )}
            </>
          )}
          {tab === 'leccion' && (
            <>
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
              <Transcript key={question.itemId} itemId={question.itemId} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
