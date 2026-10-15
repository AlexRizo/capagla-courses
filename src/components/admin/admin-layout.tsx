import { Link, useRouterState } from '@tanstack/react-router'
import { createContext, useContext, useState } from 'react'

import type { FileRouteTypes } from '#/routeTree.gen'
import { Switch } from '#/components/admin/switch'
import { cn } from '#/lib/utils'

type NavItem = { label: string; href?: string; badge?: number }

const management: NavItem[] = [
  { label: 'Preguntas', href: '/admin/preguntas' },
  { label: 'Ventas' },
  { label: 'Leads' },
]

const pro: NavItem[] = [
  { label: 'Promociones', href: '/admin/promociones' },
  { label: 'Cursos', href: '/admin/cursos' },
  { label: 'Marketing', href: '/admin/marketing' },
]

const item = 'flex items-center justify-between rounded-md p-2 font-medium'
const sectionLabel = 'px-2 pb-1.5 text-xs font-medium text-muted-foreground'

// El "Modo pro" lo leen las vistas del panel para decidir si muestran su contenido.
const AdminContext = createContext({ pro: false })
export const useAdmin = () => useContext(AdminContext)

export function AdminLayout({
  userName,
  pendingQuestions = 0,
  children,
}: {
  userName?: string | null
  pendingQuestions?: number
  children: React.ReactNode
}) {
  const [dark, setDark] = useState(false)
  const [proMode, setProMode] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const current =
    management.find((i) => i.href && pathname.startsWith(i.href)) ??
    pro.find((i) => i.href && pathname.startsWith(i.href))
  const title = current
    ? `${management.includes(current) ? 'Gestión' : 'Modo pro'} / ${current.label}`
    : 'Panel de administración'

  function link(i: NavItem) {
    const active = i.href && pathname.startsWith(i.href)
    const badge = i.href === '/admin/preguntas' ? pendingQuestions : 0
    if (!i.href) {
      return (
        <span key={i.label} className={cn(item, 'text-chart-3')}>
          {i.label}
        </span>
      )
    }
    return (
      // Navegación del cliente para no perder el modo claro/oscuro ni el modo pro.
      // Las rutas que aún no existen caen en el 404 de la app.
      <Link
        key={i.label}
        to={i.href as FileRouteTypes['to']}
        className={cn(item, active && 'bg-accent')}
      >
        <span>{i.label}</span>
        {badge > 0 && (
          <span className="rounded-full bg-primary px-2 py-px text-xs font-medium text-primary-foreground">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <AdminContext.Provider value={{ pro: proMode }}>
      <div
        className={cn(
          'admin flex min-h-screen bg-background font-admin text-sm text-foreground',
          dark && 'dark',
        )}
      >
        <aside className="flex w-60 flex-none flex-col gap-5 border-r border-border bg-sidebar px-3 py-4">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-13 font-semibold text-primary-foreground">
              C
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Capagla</span>
              <span className="text-xs text-muted-foreground">
                Panel de administración
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5">
            <div className={sectionLabel}>Gestión</div>
            {management.map(link)}
            {proMode && (
              <>
                <div className={cn(sectionLabel, 'pt-3.5')}>Modo pro</div>
                {pro.map(link)}
              </>
            )}
          </nav>

          <div className="flex-1" />
          {userName && (
            <div className="flex items-center gap-2.5 border-t border-border p-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-border text-xs font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-13 font-medium">{userName}</span>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="box-border flex h-14 items-center justify-between border-b border-border px-6">
            <span className="font-medium">{title}</span>
            <div className="flex items-center gap-5">
              <button
                type="button"
                aria-label="Cambiar modo de color"
                onClick={() => setDark(!dark)}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-13 font-medium text-foreground"
              >
                <span aria-hidden="true">{dark ? '☾' : '☀'}</span>
                <span>{dark ? 'Oscuro' : 'Claro'}</span>
              </button>
              <button
                type="button"
                onClick={() => setProMode(!proMode)}
                className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent p-0"
              >
                <span className="text-13 font-medium text-foreground">
                  Modo pro
                </span>
                <Switch on={proMode} />
              </button>
            </div>
          </header>
          {children}
        </div>
      </div>
    </AdminContext.Provider>
  )
}
