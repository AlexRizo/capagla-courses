import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import {
  ListFilters,
  ListPager,
  ListSearchBox,
  listColumns,
  listDate,
  listPill,
} from '#/components/admin/list-parts'
import { SALE_FILTERS, getAdminSales } from '#/lib/admin-sales'
import { cn } from '#/lib/utils'

const search = z.object({
  q: z.string().catch('').default(''),
  filtro: z.enum(SALE_FILTERS).catch('pagadas').default('pagadas'),
  pagina: z.number().int().min(1).catch(1).default(1),
})

// Ventas (H34): la lista de compras, de la más reciente a la más antigua.
export const Route = createFileRoute('/admin/ventas')({
  validateSearch: search,
  loaderDeps: ({ search: s }) => s,
  loader: ({ deps }) =>
    getAdminSales({
      data: { q: deps.q, filter: deps.filtro, page: deps.pagina },
    }),
  component: Ventas,
})

const STATUS = {
  PAID: 'Pagada',
  REFUNDED: 'Reembolsada',
  PENDING: 'Pendiente',
  FAILED: 'Fallida',
} as const

const mxn = (n: number) => `$${n.toLocaleString('es-MX')}`

function Ventas() {
  const { orders, total, pages, counts, paidMxn } = Route.useLoaderData()
  const { q, filtro, pagina } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const filters = [
    ['pagadas', `Pagadas · ${counts.pagadas}`],
    ['reembolsadas', `Reembolsadas · ${counts.reembolsadas}`],
    ['pendientes', `Pendientes · ${counts.pendientes}`],
    ['fallidas', `Fallidas · ${counts.fallidas}`],
    ['todas', `Todas · ${counts.todas}`],
  ] as const

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
            Ventas
          </h1>
          <div className="max-w-180 leading-normal text-muted-foreground">
            Las compras del sitio. Pendiente: abrió el pago y no lo terminó. Los
            reembolsos se hacen en Stripe; al reembolsar el total se quita el
            acceso.
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-muted-foreground">
            Cobrado (pagadas, sin reembolsos)
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {mxn(paidMxn)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListFilters filters={filters} current={filtro} navigate={navigate} />
        <ListSearchBox
          q={q}
          placeholder="Buscar por nombre o correo"
          navigate={navigate}
        />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div
          className={`${listColumns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
        >
          <div className="flex-3">Alumna</div>
          <div className="flex-4">Productos</div>
          <div className="flex-2">Fecha</div>
          <div className="flex-1 text-right">Total</div>
          <div className="flex-2">Llegó de</div>
          <div className="flex-1">Estado</div>
        </div>
        {orders.map((o) => (
          <div
            key={o.id}
            className={`${listColumns} border-t border-border py-3.5`}
          >
            <div className="flex min-w-0 flex-3 flex-col">
              <span className="truncate font-medium">{o.name}</span>
              <span className="truncate text-13 text-chart-3">{o.email}</span>
            </div>
            <div className="flex min-w-0 flex-4 flex-col text-13">
              {o.products.map((p) => (
                <span key={p}>{p}</span>
              ))}
              {o.kind && (
                <span className="text-muted-foreground">{o.kind}</span>
              )}
            </div>
            <div className="flex-2 text-chart-3">{listDate.format(o.date)}</div>
            <div className="flex-1 text-right font-medium tabular-nums">
              {mxn(o.amountMxn)}
            </div>
            <div className="flex min-w-0 flex-2 flex-col text-13 text-chart-3">
              {o.promotion && <span className="truncate">{o.promotion}</span>}
              <span className="truncate">{o.source}</span>
            </div>
            <div className="flex-1">
              <span
                className={cn(
                  listPill,
                  o.status === 'PAID' && 'border-primary text-primary',
                  o.status === 'REFUNDED' &&
                    'border-destructive text-destructive',
                )}
              >
                {STATUS[o.status]}
              </span>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="border-t border-border p-5 text-muted-foreground">
            No hay ventas con ese filtro.
          </div>
        )}
      </div>

      <ListPager
        total={total}
        noun="ventas"
        page={pagina}
        pages={pages}
        navigate={navigate}
      />
    </div>
  )
}
