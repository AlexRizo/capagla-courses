import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { QuestionDialog } from '#/components/admin/question-dialog'
import { getAdminQuestions } from '#/lib/admin-questions'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/admin/preguntas')({
  loader: () => getAdminQuestions(),
  component: Preguntas,
})

const columns = 'flex items-center gap-3 px-5'
const statusText = {
  PENDING: 'Pendiente',
  ANSWERED: 'Respondida',
  HIDDEN: 'Oculta',
} as const

function Preguntas() {
  const questions = Route.useLoaderData()
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
          Aquí llegan las preguntas que las alumnas te mandan desde sus
          lecciones.
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

      {open && current && (
        <QuestionDialog
          question={current}
          tab={tab}
          onTab={setTab}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
