import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { QuestionDialog } from '#/components/admin/question-dialog'
import {
  getAdminQuestions,
  getAssistantInfo,
  saveAssistantLimits,
  saveAssistantMaxChars,
} from '#/lib/admin-questions'
import { BURST_PER_MINUTE, DAILY_ASSISTANT_LIMIT } from '#/lib/assistant-limits'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/admin/preguntas')({
  loader: async () => ({
    questions: await getAdminQuestions(),
    assistant: await getAssistantInfo(),
  }),
  component: Preguntas,
})

const columns = 'flex items-center gap-3 px-5'
const statusText = {
  ASSISTANT: 'Asistente',
  PENDING: 'Pendiente',
  ANSWERED: 'Respondida',
  HIDDEN: 'Oculta',
} as const

function Preguntas() {
  const { questions, assistant } = Route.useLoaderData()
  const [filter, setFilter] = useState<'pend' | 'resp' | 'all'>('pend')
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'responder' | 'leccion'>('responder')

  const pending = questions.filter((q) => q.status === 'PENDING').length
  const visible = questions.filter(
    (q) =>
      filter === 'all' ||
      (filter === 'pend' ? q.status === 'PENDING' : q.status === 'ANSWERED'),
  )
  const current = questions.find((q) => q.id === selected)

  function show(id: string, next: 'responder' | 'leccion') {
    setSelected(id)
    setTab(next)
    setOpen(true)
  }

  const filters = [
    ['pend', `Pendientes · ${pending}`],
    ['resp', 'Respondidas'],
    ['all', 'Todas'],
  ] as const

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
          Preguntas para la chef
        </h1>
        <div className="text-muted-foreground">
          {assistant.enabled
            ? 'Primero responde el asistente. Aquí llegan solo las que la alumna decidió mandarte porque la respuesta no le sirvió.'
            : 'Aquí llegan las preguntas que las alumnas te mandan desde sus lecciones.'}
        </div>
      </div>

      <div className="flex gap-2 text-13 font-medium">
        {filters.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'cursor-pointer rounded-md border px-3 py-1.5 font-admin text-13 font-medium',
              filter === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-chart-3',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div
          className={`${columns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
        >
          <div className="flex-3">Pregunta</div>
          <div className="flex-2">Lección</div>
          <div className="flex-1">Alumna</div>
          <div className="flex-1">Enviada</div>
          <div className="flex-1">Estado</div>
        </div>
        {visible.map((q) => (
          <div
            key={q.id}
            role="button"
            tabIndex={0}
            onClick={() => show(q.id, 'responder')}
            onKeyDown={(e) => e.key === 'Enter' && show(q.id, 'responder')}
            className={cn(
              `${columns} cursor-pointer border-t border-border py-3.5`,
              q.id === selected ? 'bg-accent' : 'bg-card',
            )}
          >
            <div className="flex-3 font-medium">{q.text}</div>
            <div className="flex-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  show(q.id, 'leccion')
                }}
                className="cursor-pointer border-0 bg-transparent p-0 text-left font-admin text-sm text-primary underline decoration-zinc-400 underline-offset-3"
              >
                {q.lesson}
              </button>
            </div>
            <div className="flex-1 text-chart-3">{q.who}</div>
            <div className="flex-1 text-chart-3">{q.when}</div>
            <div className="flex-1">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4">
                {statusText[q.status]}
              </span>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="border-t border-border p-5 text-muted-foreground">
            No hay preguntas aquí.
          </div>
        )}
      </div>

      <AssistantCard assistant={assistant} />

      {open && current && (
        <QuestionDialog
          question={current}
          assistant={assistant.enabled}
          tab={tab}
          onTab={setTab}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// Ajuste del asistente: se guarda al salir del campo.
type AssistantInfo = Awaited<ReturnType<typeof getAssistantInfo>>

const money = (usd: number) =>
  usd < 0.01 ? 'menos de $0.01 USD' : `$${usd.toFixed(2)} USD`

function AssistantCard({ assistant }: { assistant: AssistantInfo }) {
  const { maxChars, studentsEnabled, dailyLimit, usage } = assistant
  const router = useRouter()
  const [value, setValue] = useState(String(maxChars))
  const [limit, setLimit] = useState(String(dailyLimit))
  // El interruptor cambia al instante; si el guardado falla, vuelve a lo guardado.
  const [on, setOn] = useState(studentsEnabled)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)

  async function save() {
    const number = Number(value)
    if (number === maxChars) return setError(null)
    const result = await saveAssistantMaxChars({ data: { maxChars: number } })
    if (result.error) {
      setValue(String(maxChars))
      return setError(result.error)
    }
    setError(null)
    await router.invalidate()
  }

  async function saveLimits(enabled: boolean, nextLimit: number) {
    const result = await saveAssistantLimits({
      data: { enabled, dailyLimit: nextLimit },
    })
    if (result.error) {
      setLimit(String(dailyLimit))
      setOn(studentsEnabled)
      return setLimitError(result.error)
    }
    setLimitError(null)
    await router.invalidate()
  }

  return (
    <div className="flex w-full max-w-130 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="text-base font-semibold">Asistente</div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="max-chars" className="text-13 font-medium">
          Máximo de caracteres por respuesta
        </label>
        <input
          id="max-chars"
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="box-border h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        />
        <span className="text-xs text-muted-foreground">
          Si no cabe, el asistente lo dice y ofrece mandarla a la chef.
        </span>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-13 font-medium">
          <input
            id="students-enabled"
            type="checkbox"
            checked={on}
            onChange={(e) => {
              setOn(e.target.checked)
              void saveLimits(e.target.checked, Number(limit) || dailyLimit)
            }}
          />
          Asistente activo para las alumnas
        </label>
        <span className="text-xs text-muted-foreground">
          Apagado, “Preguntar” va directo a la chef. El borrador para la chef
          sigue funcionando.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="daily-limit" className="text-13 font-medium">
          Tope de preguntas en 24 horas (todas las alumnas juntas)
        </label>
        <input
          id="daily-limit"
          type="text"
          inputMode="numeric"
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            const number = Number(limit)
            if (number !== dailyLimit) void saveLimits(on, number)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="box-border h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        />
        <span className="text-xs text-muted-foreground">
          Al llegar al tope, “Preguntar” va directo a la chef hasta que pasen
          las 24 horas. Cada alumna puede hacer {DAILY_ASSISTANT_LIMIT} al día,{' '}
          {BURST_PER_MINUTE} por minuto y una a la vez.
        </span>
        {limitError && (
          <span className="text-xs text-destructive">{limitError}</span>
        )}
      </div>
      <div className="rounded-md bg-muted px-3 py-2 text-13 leading-normal">
        Últimas 24 horas: <strong>{usage.questions}</strong> de {dailyLimit}{' '}
        preguntas · gasto estimado <strong>{money(usage.costUsd)}</strong>
        {usage.failed > 0 && <> · {usage.failed} con error</>}
        {usage.refused > 0 && <> · {usage.refused} rechazadas por el modelo</>}
        <div className="text-xs text-muted-foreground">
          Es una estimación con los tokens que informa el modelo; la cifra real
          es la de tu cuenta de Anthropic.
        </div>
      </div>
      <div className="text-13 leading-normal text-muted-foreground">
        Los votos de la alumna (me sirvió / no me sirvió) se guardan para un
        panel de efectividad que se diseña más adelante.
      </div>
    </div>
  )
}
