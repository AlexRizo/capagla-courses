import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { ProGate } from '#/components/admin/pro-gate'
import { createPromotion, getAdminPromotions } from '#/lib/admin-promotions'

export const Route = createFileRoute('/admin/promociones/')({
  loader: () => getAdminPromotions(),
  component: Promociones,
})

const columns = 'flex items-center gap-3 px-5'
const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'

function Promociones() {
  const promotions = Route.useLoaderData()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setCreating(true)
    setError(null)
    try {
      const result = await createPromotion()
      if (!result.id) return setError(result.error ?? 'No se pudo crear.')
      await navigate({
        to: '/admin/promociones/$id',
        params: { id: result.id },
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <ProGate>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
                Promociones
              </h1>
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Modo pro
              </span>
            </div>
            <div className="max-w-165 leading-normal text-muted-foreground">
              Cada promoción crea una landing con su propia URL: el cuerpo del
              curso principal y, abajo, los adicionales a precio especial. Los
              precios especiales solo se aplican dentro de sus fechas.
            </div>
            {error && <div className="text-13 text-destructive">{error}</div>}
          </div>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="inline-flex h-9 cursor-pointer items-center rounded-md border-none bg-primary px-3.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            + Nueva promoción
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-xs">
          <div
            className={`${columns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
          >
            <div className="flex-3">Promoción</div>
            <div className="flex-2">URL</div>
            <div className="flex-1">Productos</div>
            <div className="flex-2">Vigencia</div>
            <div className="flex-1">Estado</div>
            <div className="flex-1">Visitas</div>
            <div className="flex-1">Ventas</div>
          </div>
          {promotions.map((p) => (
            <Link
              key={p.id}
              to="/admin/promociones/$id"
              params={{ id: p.id }}
              className={`${columns} border-t border-border py-3.5`}
            >
              <div className="flex-3 font-medium">{p.name}</div>
              <div className="flex-2 font-mono text-13 text-chart-3">
                /{p.slug}
              </div>
              <div className="flex-1 text-chart-3">{p.products}</div>
              <div className="flex-2 text-chart-3">{p.vigency}</div>
              <div className="flex-1">
                <span className={pill}>{p.status}</span>
              </div>
              <div className="flex-1 text-chart-3">—</div>
              <div className="flex-1 text-chart-3">{p.sales}</div>
            </Link>
          ))}
        </div>
      </div>
    </ProGate>
  )
}
