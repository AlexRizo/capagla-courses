import type { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { input } from '#/components/admin/form-styles'
import { cn } from '#/lib/utils'

// Piezas de las listas del panel con filtros, búsqueda y páginas (Ventas y Leads, como Usuarios).

export const listColumns = 'flex items-center gap-3 px-5'
export const listPill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'
export const listDate = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'medium',
})

type ListSearch = { q: string; filtro: string; pagina: number }

// Búsqueda que se manda a la dirección poco después de dejar de escribir.
export function ListSearchBox({
  q,
  placeholder,
  navigate,
}: {
  q: string
  placeholder: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const [text, setText] = useState(q)
  useEffect(() => {
    if (text === q) return
    const timer = setTimeout(
      () =>
        void navigate({
          search: (s: ListSearch) => ({ ...s, q: text, pagina: 1 }),
          replace: true,
        } as never),
      300,
    )
    return () => clearTimeout(timer)
  }, [text, q, navigate])
  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(input, 'w-72')}
    />
  )
}

export function ListFilters({
  filters,
  current,
  navigate,
}: {
  filters: readonly (readonly [string, string])[]
  current: string
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="flex flex-wrap gap-2 text-13 font-medium">
      {filters.map(([id, name]) => (
        <button
          key={id}
          type="button"
          onClick={() =>
            void navigate({
              search: (s: ListSearch) => ({ ...s, filtro: id, pagina: 1 }),
            } as never)
          }
          className={cn(
            'cursor-pointer rounded-md border px-3 py-1.5 font-admin text-13 font-medium',
            current === id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-chart-3',
          )}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

export function ListPager({
  total,
  noun,
  page,
  pages,
  navigate,
}: {
  total: number
  noun: string
  page: number
  pages: number
  navigate: ReturnType<typeof useNavigate>
}) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between text-13 text-muted-foreground">
      <span>
        {total} {noun} · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        {(
          [
            ['Anterior', page - 1, page <= 1],
            ['Siguiente', page + 1, page >= pages],
          ] as const
        ).map(([name, to, disabled]) => (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() =>
              void navigate({
                search: (s: ListSearch) => ({ ...s, pagina: to }),
              } as never)
            }
            className="h-9 cursor-pointer rounded-md border border-border bg-card px-3.5 font-admin font-medium text-foreground disabled:cursor-default disabled:opacity-50"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
