import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { CreateUserDialog } from '#/components/admin/create-user-dialog'
import { input } from '#/components/admin/form-styles'
import { getAdminUsers } from '#/lib/admin-users'
import { cn } from '#/lib/utils'

const search = z.object({
  q: z.string().catch('').default(''),
  filtro: z
    .enum(['todos', 'admin', 'alumnas', 'suspendidas'])
    .catch('todos')
    .default('todos'),
  pagina: z.number().int().min(1).catch(1).default(1),
})

export const Route = createFileRoute('/admin/usuarios/')({
  validateSearch: search,
  loaderDeps: ({ search: s }) => s,
  loader: ({ deps }) =>
    getAdminUsers({
      data: { q: deps.q, filter: deps.filtro, page: deps.pagina },
    }),
  component: Usuarios,
})

const columns = 'flex items-center gap-3 px-5'
const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'
const date = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'medium',
})

function Usuarios() {
  const { users, total, pages, counts } = Route.useLoaderData()
  const { q, filtro, pagina } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [creating, setCreating] = useState(false)
  const [text, setText] = useState(q)

  // La búsqueda se manda a la dirección poco después de dejar de escribir.
  useEffect(() => {
    if (text === q) return
    const timer = setTimeout(
      () =>
        void navigate({
          search: (s) => ({ ...s, q: text, pagina: 1 }),
          replace: true,
        }),
      300,
    )
    return () => clearTimeout(timer)
  }, [text, q, navigate])

  const filters = [
    ['todos', `Todos · ${counts.todos}`],
    ['admin', `Administradores · ${counts.admin}`],
    ['alumnas', `Alumnas · ${counts.alumnas}`],
    ['suspendidas', `Suspendidas · ${counts.suspendidas}`],
  ] as const

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
            Usuarios
          </h1>
          <div className="text-muted-foreground">
            Administradores y alumnas. Crea cuentas, cambia su rol, dales acceso
            a cursos o suspéndelas.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-9 cursor-pointer items-center rounded-md border-none bg-primary px-3.5 font-medium text-primary-foreground"
        >
          + Crear usuario
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-13 font-medium">
          {filters.map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                void navigate({
                  search: (s) => ({ ...s, filtro: id, pagina: 1 }),
                })
              }
              className={cn(
                'cursor-pointer rounded-md border px-3 py-1.5 font-admin text-13 font-medium',
                filtro === id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-chart-3',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar usuario"
          className={cn(input, 'w-72')}
        />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div
          className={`${columns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
        >
          <div className="flex-4">Usuario</div>
          <div className="flex-1">Rol</div>
          <div className="flex-1">Accesos</div>
          <div className="flex-2">Alta</div>
          <div className="flex-1">Estado</div>
        </div>
        {users.map((u) => (
          <Link
            key={u.id}
            to="/admin/usuarios/$id"
            params={{ id: u.id }}
            className={`${columns} border-t border-border py-3.5`}
          >
            <div className="flex min-w-0 flex-4 flex-col">
              <span className="truncate font-medium">{u.name}</span>
              <span className="truncate text-13 text-chart-3">{u.email}</span>
            </div>
            <div className="flex-1">
              <span className={pill}>{u.admin ? 'Admin' : 'Alumna'}</span>
            </div>
            <div className="flex-1 text-chart-3">{u.courses}</div>
            <div className="flex-2 text-chart-3">
              {date.format(u.createdAt)}
            </div>
            <div className="flex-1">
              <span
                className={cn(
                  pill,
                  u.suspended && 'border-destructive text-destructive',
                )}
              >
                {u.suspended ? 'Suspendida' : 'Activa'}
              </span>
            </div>
          </Link>
        ))}
        {users.length === 0 && (
          <div className="border-t border-border p-5 text-muted-foreground">
            No hay usuarios con ese filtro.
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-13 text-muted-foreground">
          <span>
            {total} usuarios · página {pagina} de {pages}
          </span>
          <div className="flex gap-2">
            {(
              [
                ['Anterior', pagina - 1, pagina <= 1],
                ['Siguiente', pagina + 1, pagina >= pages],
              ] as const
            ).map(([name, to, disabled]) => (
              <button
                key={name}
                type="button"
                disabled={disabled}
                onClick={() =>
                  void navigate({ search: (s) => ({ ...s, pagina: to }) })
                }
                className="h-9 cursor-pointer rounded-md border border-border bg-card px-3.5 font-admin font-medium text-foreground disabled:cursor-default disabled:opacity-50"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
