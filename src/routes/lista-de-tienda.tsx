import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { shareText } from '#/lib/cost-shopping'
import { formatPrice } from '#/lib/costs'
import { requireToolPage } from '#/lib/tool-access'
import { getList, saveListState } from '#/lib/tool-list'
import { cn } from '#/lib/utils'

// Vista de tienda (web móvil) de la lista de compra: una pestaña por lugar, lo que falta comprar
// y una casilla de "comprado" que se guarda. Lo que se marcó "Ya lo tengo" no aparece aquí.
export const Route = createFileRoute('/lista-de-tienda')({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  validateSearch: z.object({ produccion: z.string().optional() }),
  beforeLoad: () => requireToolPage('SHOPPING_LIST'),
  loaderDeps: ({ search }) => ({ produccion: search.produccion }),
  gcTime: 0,
  staleTime: 0,
  loader: ({ deps }) =>
    getList({ data: { productionId: deps.produccion ?? null } }),
  component: ListaDeTienda,
})

const NONE = 'none'

function ListaDeTienda() {
  const data = Route.useLoaderData()
  const { produccion } = Route.useSearch()
  const [rows, setRows] = useState(data.rows)
  const [tab, setTab] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Los diálogos y menús de shadcn se dibujan fuera del marco: la clase del tema va en <html>.
  useEffect(() => {
    document.documentElement.classList.add('tool')
    return () => document.documentElement.classList.remove('tool')
  }, [])

  const stores = [
    ...data.places.map((p) => ({ key: p.id, name: p.name })),
    { key: NONE, name: 'Sin tienda' },
  ]
    .map((s) => ({
      ...s,
      items: rows.filter((r) => r.placeKey === s.key && !r.haveIt),
    }))
    .filter((s) => s.items.length > 0)
  const current = stores.find((s) => s.key === tab) ?? stores.at(0) ?? null

  async function toggle(id: string, bought: boolean) {
    const next = rows.map((r) => (r.ingredientId === id ? { ...r, bought } : r))
    setRows(next)
    setError(null)
    try {
      const result = await saveListState({
        data: {
          productionId: data.production?.id ?? null,
          entries: next.map((r) => ({
            ingredientId: r.ingredientId,
            placeKey: r.placeKey,
            haveIt: r.haveIt,
            bought: r.bought,
          })),
        },
      })
      if (!('ok' in result)) setError(result.error)
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
    }
  }

  async function share() {
    setNote(null)
    const total = rows.reduce((s, r) => s + (r.haveIt ? 0 : r.cost), 0)
    const text = shareText(
      data.production?.name ?? 'Lista directa',
      stores.map((s) => ({
        name: s.name,
        rows: s.items.map((r) => ({ name: r.name, buy: r.buyLabel })),
        subtotal: s.items.reduce((sum, r) => sum + r.cost, 0),
      })),
      total,
    )
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Lista de compra', text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote('Lista copiada: pégala donde quieras.')
    } catch {
      // Cerrar el menú de compartir no es un error.
    }
  }

  const bought = current?.items.filter((r) => r.bought).length ?? 0
  const count = current?.items.length ?? 0
  const total = current?.items.reduce((s, r) => s + r.cost, 0) ?? 0
  const pct = count ? Math.round((bought / count) * 100) : 0

  return (
    <div className="tool mx-auto flex min-h-screen max-w-md flex-col bg-background font-tool text-base text-foreground">
      <div className="flex items-center gap-1 border-b py-2 pr-2 pl-1">
        <Link
          to="/herramienta/lista"
          search={produccion ? { produccion } : {}}
          aria-label="Volver a la lista de compra"
          className="flex size-11 items-center justify-center text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-lg font-semibold">Lista de compra</div>
          <div className="truncate text-sm text-muted-foreground">
            {data.production
              ? data.production.summary.join(' · ')
              : 'Lista directa'}
          </div>
        </div>
        <button
          type="button"
          aria-label="Compartir como texto"
          onClick={() => void share()}
          className="flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent text-foreground"
        >
          <Share className="size-5" />
        </button>
      </div>

      {current === null ? (
        <p className="p-6 text-center text-muted-foreground">
          No hay nada por comprar.
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Tienda"
            className="flex gap-2 overflow-x-auto px-4 pt-4 pb-2"
          >
            {stores.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={s.key === current.key}
                onClick={() => setTab(s.key)}
                className={cn(
                  'h-11 shrink-0 cursor-pointer rounded-full border px-4 text-[15px] font-medium',
                  s.key === current.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground',
                )}
              >
                {s.name} ({s.items.length})
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4 pt-2 pb-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {bought} de {count} comprados
              </span>
              <span>Total estimado {formatPrice(total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col px-4 pt-2">
            {current.items.map((r) => (
              <label
                key={r.ingredientId}
                className={cn(
                  'flex min-h-16 cursor-pointer items-center gap-3.5 border-b py-2',
                  r.bought && 'opacity-55',
                )}
              >
                <Checkbox
                  aria-label={`Comprado: ${r.name}`}
                  checked={r.bought}
                  onCheckedChange={(v) =>
                    void toggle(r.ingredientId, v === true)
                  }
                  className="size-7"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-[17px] font-medium',
                      r.bought && 'line-through',
                    )}
                  >
                    {r.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Comprar {r.buyLabel}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />
      <div className="flex flex-col gap-2.5 p-4">
        <Button
          type="button"
          className="h-12 text-base"
          onClick={() => void share()}
        >
          Compartir como texto
        </Button>
        {error && (
          <p className="m-0 text-center text-sm text-destructive">{error}</p>
        )}
        {note && (
          <p className="m-0 text-center text-sm text-muted-foreground">
            {note}
          </p>
        )}
        <p className="m-0 text-center text-[13px] leading-normal text-muted-foreground">
          Lo que marcaste “Ya lo tengo” en la computadora no aparece aquí.
        </p>
      </div>
    </div>
  )
}
