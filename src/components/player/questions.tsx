import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { MAX_QUESTION_LENGTH, createQuestion } from '#/lib/player'
import type { getPlayer } from '#/lib/player'
import { cn } from '#/lib/utils'
import { usePreview } from './preview'

type Question = Awaited<ReturnType<typeof getPlayer>>['lesson']['questions'][0]

// Sin tildes ni mayúsculas, para comparar lo que escribe con lo ya respondido.
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Cuántas preguntas se ven antes de "Ver todas las preguntas".
const COLLAPSED = 2

// Pestaña "Preguntas" de la lección (en móvil, su propia vista con título).
// Mientras escribe se buscan respuestas que ya se dieron; "Preguntar" manda la pregunta a la chef.
// (El paso intermedio del asistente de IA de la maqueta no está integrado.)
export function Questions({
  lessonId,
  questions,
  page,
}: {
  lessonId: string
  questions: Question[]
  // Vista de móvil: con título y los controles uno bajo otro.
  page?: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [all, setAll] = useState(false)

  const words = normalize(text)
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  const filtering = words.length > 0
  const hit = (q: Question) =>
    words.some((w) => normalize(`${q.text} ${q.answer ?? ''}`).includes(w))
  const matches = questions.filter((q) => q.answer && hit(q)).length
  const list = filtering
    ? questions.filter(hit)
    : all
      ? questions
      : questions.slice(0, COLLAPSED)
  const hasText = text.trim().length > 0
  const preview = usePreview()

  function change(value: string) {
    setText(value)
    setSent(false)
    setError(null)
  }

  async function ask() {
    if (!hasText || sending) return
    setSending(true)
    setError(null)
    try {
      const result = await createQuestion({
        data: { lessonId, text: text.trim() },
      })
      if (result.error) return setError(result.error)
      setText('')
      setSent(true)
      await router.invalidate()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {page && (
        <h2 className="m-0 text-22 font-black tracking-landing-title-sm">
          Preguntas
        </h2>
      )}

      <div
        className={cn('flex', page ? 'flex-col gap-2.5' : 'flex-wrap gap-3')}
      >
        <div className={cn('relative', !page && 'flex-[1_1_360px]')}>
          <input
            type="text"
            value={text}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Busca o escribe tu pregunta…"
            aria-label="Busca o escribe tu pregunta"
            className="box-border h-12.5 w-full rounded-12 border-[1.5px] border-player-border bg-player-control pr-11 pl-4 font-sans text-base text-player-text"
          />
          {hasText && (
            <button
              type="button"
              onClick={() => change('')}
              aria-label="Borrar"
              className="absolute top-2.25 right-2 size-8 cursor-pointer rounded-lg border-0 bg-transparent text-lg text-player-accent"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={ask}
          disabled={!hasText || preview}
          className={cn(
            'inline-flex h-12.5 cursor-pointer items-center justify-center gap-2.5 rounded-12 border-0 bg-player-btn px-5.5 font-sans text-base font-black text-player-btn-text',
            page ? 'w-full' : 'min-w-40',
            !hasText && 'opacity-50',
          )}
        >
          {sending && (
            <span className="inline-block size-4 animate-spin rounded-full border-[2.5px] border-player-btn-text border-t-transparent" />
          )}
          <span>{sending ? 'Procesando…' : 'Preguntar'}</span>
        </button>
      </div>

      {error && (
        <div className="text-sm font-bold text-player-accent">{error}</div>
      )}

      {filtering && !sent && matches > 0 && (
        <div className="text-sm text-player-muted">
          Quizás te funcione{' '}
          {matches === 1 ? 'esta respuesta' : 'estas respuestas'} que ya se{' '}
          {matches === 1 ? 'dio' : 'dieron'}:
        </div>
      )}
      {filtering && !sent && matches === 0 && (
        <div className="text-sm text-player-muted">
          Parece una pregunta nueva. Pulsa{' '}
          <strong className="text-player-text">Preguntar</strong> y se la
          enviamos a la chef.
        </div>
      )}

      {sent && (
        <div className="rounded-14 border border-player-ok-line bg-player-ok px-5 py-4 text-15 leading-normal text-player-ok-text">
          <strong>Enviamos tu pregunta a la chef.</strong> Te avisamos por
          correo cuando responda y quedará aquí abajo para las demás alumnas.
        </div>
      )}

      <div className="flex flex-col border-t border-player-border pt-2">
        <div className="pt-2.5 pb-1 text-xs font-black tracking-player-caps text-player-accent">
          {filtering ? 'RESPUESTAS RELACIONADAS' : 'PREGUNTAS DE ESTA LECCIÓN'}
        </div>
        {list.map((q) => (
          <div
            key={q.id}
            className="flex flex-col gap-2.5 border-b border-player-border py-4"
          >
            <div className="text-sm">
              <strong>{q.who}</strong>{' '}
              <span className="text-player-muted">· {q.ago}</span>
            </div>
            <div className="text-base leading-normal">{q.text}</div>
            {q.answer ? (
              <div className="flex flex-col gap-1.5 rounded-12 border border-player-border bg-player-open px-4 py-3.5">
                <div className="text-xs font-black tracking-landing-caps text-player-accent">
                  RESPUESTA DE GLADIS · CHEF
                </div>
                <div className="text-15 leading-normal whitespace-pre-line">
                  {q.answer}
                </div>
              </div>
            ) : (
              <div className="self-start rounded-full bg-player-track px-3 py-1.5 text-13 font-bold text-player-muted">
                Esperando respuesta de la chef
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className="py-4 text-sm text-player-muted">
            Aún no hay preguntas aquí.
          </div>
        )}
        {!filtering && questions.length > COLLAPSED && (
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="cursor-pointer self-start border-0 bg-transparent px-0 pt-3.5 font-sans text-sm font-bold text-player-accent"
          >
            {all
              ? 'Ver menos'
              : `Ver todas las preguntas (${questions.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
