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
import { LEAD_FILTERS, getAdminLeads } from '#/lib/admin-sales'
import { cn } from '#/lib/utils'

const search = z.object({
  q: z.string().catch('').default(''),
  filtro: z.enum(LEAD_FILTERS).catch('todos').default('todos'),
  pagina: z.number().int().min(1).catch(1).default(1),
})

// Leads (H34): quienes se registran en la clase gratis con su correo.
export const Route = createFileRoute('/admin/leads')({
  validateSearch: search,
  loaderDeps: ({ search: s }) => s,
  loader: ({ deps }) =>
    getAdminLeads({
      data: { q: deps.q, filter: deps.filtro, page: deps.pagina },
    }),
  component: Leads,
})

function Leads() {
  const { leads, total, pages, counts } = Route.useLoaderData()
  const { q, filtro, pagina } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const filters = [
    ['todos', `Todos · ${counts.todos}`],
    ['correos', `Aceptan correos · ${counts.correos}`],
    ['sin-correos', `Sin correos · ${counts['sin-correos']}`],
  ] as const
  const csv = `/api/admin-leads?${new URLSearchParams({ filtro, q })}`

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
            Leads
          </h1>
          <div className="max-w-180 leading-normal text-muted-foreground">
            Quienes se registraron en la clase gratis. Para escribirles, exporta
            el CSV e impórtalo en Brevo (Contactos › Importar contactos). Solo
            manda novedades a quienes las aceptaron: usa el filtro «Aceptan
            correos» antes de exportar.
          </div>
        </div>
        <a
          href={csv}
          download
          className="inline-flex h-9 items-center rounded-md border-none bg-primary px-3.5 font-medium text-primary-foreground no-underline"
        >
          Exportar CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListFilters filters={filters} current={filtro} navigate={navigate} />
        <ListSearchBox
          q={q}
          placeholder="Buscar por correo"
          navigate={navigate}
        />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div
          className={`${listColumns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
        >
          <div className="flex-4">Correo</div>
          <div className="flex-2">Registro</div>
          <div className="flex-2">Acepta correos</div>
          <div className="flex-3">Llegó de</div>
          <div className="flex-1">Compró</div>
        </div>
        {leads.map((l) => (
          <div
            key={l.id}
            className={`${listColumns} border-t border-border py-3.5`}
          >
            <div className="min-w-0 flex-4 truncate font-medium">{l.email}</div>
            <div className="flex-2 text-chart-3">
              {listDate.format(l.createdAt)}
            </div>
            <div className="flex-2 text-chart-3">
              {l.newsletterAt
                ? `Sí · ${listDate.format(l.newsletterAt)}`
                : 'No'}
            </div>
            <div className="min-w-0 flex-3 truncate text-chart-3">
              {l.source}
            </div>
            <div className="flex-1">
              <span
                className={cn(
                  listPill,
                  l.bought && 'border-primary text-primary',
                )}
              >
                {l.bought ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
        ))}
        {leads.length === 0 && (
          <div className="border-t border-border p-5 text-muted-foreground">
            No hay leads con ese filtro.
          </div>
        )}
      </div>

      <ListPager
        total={total}
        noun="leads"
        page={pagina}
        pages={pages}
        navigate={navigate}
      />
    </div>
  )
}
