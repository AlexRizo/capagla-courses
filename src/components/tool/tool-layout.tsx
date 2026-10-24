import { Link, useRouterState } from '@tanstack/react-router'
import {
  Archive,
  BookOpen,
  Calculator,
  CalendarDays,
  Layers,
  ListChecks,
  Package,
  Receipt,
  SlidersHorizontal,
  Store,
  Tag,
} from 'lucide-react'
import { useEffect } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import { Separator } from '#/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { TooltipProvider } from '#/components/ui/tooltip'
import type { FileRouteTypes } from '#/routeTree.gen'

type Item = {
  label: string
  icon: typeof Package
  // Sin `to`, la sección aún no está construida: se ve en el menú pero no abre nada.
  to?: FileRouteTypes['to']
}

// Menú de la maqueta, en su orden. Se activa sección por sección conforme se construye.
const groups: { label: string; items: Item[] }[] = [
  {
    label: 'Costos',
    items: [
      { label: 'Productos', icon: Package, to: '/herramienta/productos' },
      { label: 'Recetas', icon: BookOpen, to: '/herramienta/recetas' },
      { label: 'Premezclas', icon: Layers, to: '/herramienta/premezclas' },
      {
        label: 'Ingredientes',
        icon: Archive,
        to: '/herramienta/ingredientes',
      },
      { label: 'Etiquetas', icon: Tag, to: '/herramienta/etiquetas' },
    ],
  },
  {
    label: 'Compras',
    items: [
      { label: 'Lista de compra', icon: ListChecks },
      { label: 'Registro de compras', icon: Receipt },
      { label: 'Lugares de compra', icon: Store, to: '/herramienta/lugares' },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { label: 'Producción', icon: CalendarDays },
      { label: 'Cotizador', icon: Calculator },
    ],
  },
]
const settings: Item = {
  label: 'Ajustes de costos',
  icon: SlidersHorizontal,
  to: '/herramienta/ajustes',
}

const active =
  'data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-accent-foreground'

function NavItem({ item, pathname }: { item: Item; pathname: string }) {
  const Icon = item.icon
  if (!item.to) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled
          aria-disabled="true"
          className="text-sidebar-muted opacity-60"
        >
          <Icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={pathname.startsWith(item.to)}
        className={active}
      >
        <Link to={item.to}>
          <Icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// Marco de la herramienta de costos: barra lateral morada oscura y contenido gris claro, con el
// tema `.tool` (tokens de su maqueta). Los diálogos y menús de shadcn se dibujan fuera de este
// marco, así que la clase también se pone en <html> mientras la herramienta está abierta.
export function ToolLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    document.documentElement.classList.add('tool')
    return () => document.documentElement.classList.remove('tool')
  }, [])

  // Dónde está la persona, para las migas de pan (Ajustes cuelga del grupo Costos).
  const places = [
    ...groups.flatMap((g) => g.items.map((item) => ({ group: g.label, item }))),
    { group: 'Costos', item: settings },
  ]
  const here = places.find((p) => p.item.to && pathname.startsWith(p.item.to))
  const group = here && { label: here.group }
  const current = here?.item

  return (
    <div className="tool font-tool">
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 p-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
                  C
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold">Capagla</span>
                  <span className="text-xs text-sidebar-muted">Costos</span>
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              {groups.map((g, i) => (
                <div key={g.label}>
                  {i > 0 && <SidebarSeparator className="my-2" />}
                  <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-muted">
                      {g.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {g.items.map((item) => (
                          <NavItem
                            key={item.label}
                            item={item}
                            pathname={pathname}
                          />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </div>
              ))}
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavItem item={settings} pathname={pathname} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="text-13 text-sidebar-muted"
                  >
                    <Link to="/mis-cursos">← Volver a mis cursos</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="bg-page">
            <header className="flex h-14 items-center gap-3 border-b bg-background px-6">
              <SidebarTrigger className="-ml-2" />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>{group?.label ?? 'Costos'}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {current?.label ?? 'Inicio'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="flex flex-col gap-6 p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  )
}
