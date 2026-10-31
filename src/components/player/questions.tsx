import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  MAX_QUESTION_LENGTH,
  askAssistant,
  createQuestion,
  sendToChef,
  voteAnswer,
} from '#/lib/player'
import type { getPlayer } from '#/lib/player'
import { cn } from '#/lib/utils'
import { usePreview } from './preview'

type Lesson = Awaited<ReturnType<typeof getPlayer>>['lesson']
type Question = Lesson['questions'][0]
type AssistantQuestion = Lesson['assistantQuestions'][0]

// Sin tildes ni mayúsculas, para comparar lo que escribe con lo ya respondido.
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5 6.5 8.5l-4-1.5 4-1.5z"
        fill="currentColor"
      />
    </svg>
  )
}

// 👍 / 👎 de la respuesta del asistente (el mismo dibujo, girado).
function VoteButton({
  label,
  down,
  selected,
  onClick,
}: {
  label: string
  down?: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex size-10 cursor-pointer items-center justify-center rounded-full border-[1.5px] p-0',
        selected
          ? 'border-player-accent bg-player-accent text-player-on-accent'
          : 'border-player-border bg-transparent text-player-muted',
      )}
    >
      <svg
        viewBox="0 0 20 20"
        className={cn('size-4.5', down && 'rotate-180')}
        aria-hidden
      >
        <path
          d="M6 9v8H3V9zM6 9l3.5-6c1.2 0 2 .9 1.8 2L10.7 8H16a1.5 1.5 0 011.5 1.8l-1.2 6A1.5 1.5 0 0114.8 17H6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

// Respuesta del asistente a una pregunta, con "Me sirvió" / "No me sirvió" y "Preguntarle a la
// chef". La usan la pregunta que acaba de hacer y las del historial (guardadas en la base).
function AssistantCard({
  id,
  answer,
  initialVote,
  page,
  onSent,
}: {
  id: string
  answer: string | null
  initialVote?: 'UP' | 'DOWN' | null
  page?: boolean
  // La pregunta ya está en la bandeja de la chef.
  onSent: () => void
}) {
  const [vote, setVote] = useState<'UP' | 'DOWN' | undefined>(
    initialVote ?? undefined,
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = usePreview()

  async function rate(value: 'UP' | 'DOWN') {
    if (preview) return
    const before = vote
    setVote(value)
    try {
      await voteAnswer({ data: { id, vote: value } })
    } catch {
      setVote(before)
    }
  }

  async function toChef() {
    if (sending || preview) return
    setSending(true)
    setError(null)
    try {
      const result = await sendToChef({ data: { id } })
      if (result.error) return setError(result.error)
      onSent()
    } catch {
      setError('No pudimos enviar tu pregunta. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 rounded-14 border border-player-border bg-player-open',
        page ? 'p-4' : 'px-5 py-4.5',
      )}
    >
      <div className="text-base leading-[1.55] whitespace-pre-line">
        {answer ??
          'No pudimos generar la respuesta ahora. Puedes mandarle tu pregunta a la chef.'}
      </div>
      {answer && (
        <div className="flex items-center gap-2 text-13 text-player-muted">
          <Sparkle className="size-3.5 text-player-accent" />
          Respondido por Inteligencia Artificial
        </div>
      )}
      {error && (
        <div className="text-sm font-bold text-player-accent">{error}</div>
      )}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-player-border pt-3.5">
        {answer && (
          <>
            <VoteButton
              label="Me sirvió"
              selected={vote === 'UP'}
              onClick={() => rate('UP')}
            />
            <VoteButton
              label="No me sirvió"
              down
              selected={vote === 'DOWN'}
              onClick={() => rate('DOWN')}
            />
            {vote === 'UP' && (
              <span className="text-sm text-player-muted">
                Gracias, nos ayuda a mejorar.
              </span>
            )}
          </>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={toChef}
          disabled={sending}
          className={cn(
            'min-h-10 cursor-pointer rounded-full border-[1.5px] border-player-accent px-4.5 font-sans text-sm font-black',
            vote === 'DOWN'
              ? 'bg-player-accent text-player-on-accent'
              : 'bg-transparent text-player-accent',
          )}
        >
          Preguntarle a la chef
        </button>
      </div>
    </div>
  )
}

// Cuántas preguntas se ven antes de "Ver todas las preguntas".
const COLLAPSED = 2

// Pestaña "Preguntas" de la lección (en móvil, su propia vista con título).
// Mientras escribe se buscan respuestas que ya se dieron. "Preguntar" consulta primero al
// asistente de IA (con "Me sirvió" / "No me sirvió" y "Preguntarle a la chef" como segundo
// paso); sin asistente (`assistant` falso, aún no hay proveedor) la manda directo a la chef.
export function Questions({
  lessonId,
  questions,
  history,
  assistant,
  page,
}: {
  lessonId: string
  questions: Question[]
  // Sus preguntas anteriores al asistente que aún no manda a la chef.
  history: AssistantQuestion[]
  assistant: boolean
  // Vista de móvil: con título y los controles uno bajo otro.
  page?: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  // Respuesta del asistente a la pregunta que acaba de hacer (null: no pudo responder).
  const [asked, setAsked] = useState<{ id: string; answer: string | null }>()
  const [error, setError] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const [allHistory, setAllHistory] = useState(false)

  const words = normalize(text)
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  const filtering = words.length > 0
  const hit = (q: Question) =>
    words.some((w) =>
      normalize(
        `${q.text} ${q.answer ?? ''} ${q.assistantAnswer ?? ''}`,
      ).includes(w),
    )
  const matches = questions.filter(
    (q) => (q.answer || q.assistantAnswer) && hit(q),
  ).length
  const list = filtering
    ? questions.filter(hit)
    : all
      ? questions
      : questions.slice(0, COLLAPSED)
  const hasText = text.trim().length > 0
  // La que acaba de hacer ya se ve arriba, con su tarjeta.
  const shownHistory = history.filter((h) => h.id !== asked?.id)
  const preview = usePreview()

  function change(value: string) {
    setText(value)
    setSent(false)
    setAsked(undefined)
    setError(null)
  }

  async function ask() {
    if (!hasText || sending || preview) return
    setSending(true)
    setError(null)
    setAsked(undefined)
    try {
      if (assistant) {
        const result = await askAssistant({
          data: { lessonId, text: text.trim() },
        })
        if (!result.id) {
          return setError(result.error ?? 'No pudimos enviar tu pregunta.')
        }
        setAsked({ id: result.id, answer: result.answer ?? null })
        // Queda guardada: se recarga para que cuente en su historial.
        await router.invalidate()
        return
      }
      const result = await createQuestion({
        data: { lessonId, text: text.trim() },
      })
      if (result.error) return setError(result.error)
      setText('')
      setSent(true)
      await router.invalidate()
    } catch {
      setError('No pudimos enviar tu pregunta. Inténtalo de nuevo.')
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

      <div className="text-13 text-player-muted">
        Las preguntas y sus respuestas las ven las demás alumnas de esta
        lección. No escribas datos personales.
      </div>

      {filtering && !sent && matches > 0 && (
        <div className="text-sm text-player-muted">
          Quizás te funcione{' '}
          {matches === 1 ? 'esta respuesta' : 'estas respuestas'} que ya se{' '}
          {matches === 1 ? 'dio' : 'dieron'}:
        </div>
      )}
      {filtering && !sent && !asked && matches === 0 && (
        <div className="text-sm text-player-muted">
          Parece una pregunta nueva. Pulsa{' '}
          <strong className="text-player-text">Preguntar</strong>{' '}
          {assistant
            ? 'y el asistente te ayuda.'
            : 'y se la enviamos a la chef.'}
        </div>
      )}

      {asked && (
        <AssistantCard
          key={asked.id}
          id={asked.id}
          answer={asked.answer}
          page={page}
          onSent={() => {
            setText('')
            setAsked(undefined)
            setSent(true)
            void router.invalidate()
          }}
        />
      )}

      {sent && (
        <div className="rounded-14 border border-player-ok-line bg-player-ok px-5 py-4 text-15 leading-normal text-player-ok-text">
          <strong>Enviamos tu pregunta a la chef.</strong> Te avisamos por
          correo cuando responda y quedará aquí abajo para las demás alumnas.
        </div>
      )}

      {!filtering && shownHistory.length > 0 && (
        <div className="flex flex-col border-t border-player-border pt-2">
          <div className="pt-2.5 pb-1 text-xs font-black tracking-player-caps text-player-accent">
            TUS PREGUNTAS AL ASISTENTE
          </div>
          {(allHistory ? shownHistory : shownHistory.slice(0, COLLAPSED)).map(
            (h) => (
              <div
                key={h.id}
                className="flex flex-col gap-2.5 border-b border-player-border py-4"
              >
                <div className="text-sm">
                  <strong>Tú</strong>{' '}
                  <span className="text-player-muted">· {h.ago}</span>
                </div>
                <div className="text-base leading-normal">{h.text}</div>
                <AssistantCard
                  id={h.id}
                  answer={h.answer}
                  initialVote={h.vote}
                  page={page}
                  onSent={() => {
                    setSent(true)
                    void router.invalidate()
                  }}
                />
              </div>
            ),
          )}
          {shownHistory.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setAllHistory(!allHistory)}
              className="cursor-pointer self-start border-0 bg-transparent px-0 pt-3.5 font-sans text-sm font-bold text-player-accent"
            >
              {allHistory
                ? 'Ver menos'
                : `Ver todas mis preguntas al asistente (${shownHistory.length})`}
            </button>
          )}
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
            {q.assistantAnswer && (
              <div className="flex flex-col gap-1.5 rounded-12 border border-player-border px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-black tracking-landing-caps text-player-muted">
                  <Sparkle className="size-3.5 text-player-accent" />
                  RESPUESTA DEL ASISTENTE · IA
                </div>
                <div className="text-15 leading-normal whitespace-pre-line">
                  {q.assistantAnswer}
                </div>
              </div>
            )}
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
              q.status === 'PENDING' && (
                <div className="self-start rounded-full bg-player-track px-3 py-1.5 text-13 font-bold text-player-muted">
                  Esperando respuesta de la chef
                </div>
              )
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
