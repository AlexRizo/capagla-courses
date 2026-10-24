import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, CircleMinus, CircleX } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { VERDICT_LABEL } from '#/lib/cost-product'
import type { Verdict } from '#/lib/cost-product'
import { formatPrice } from '#/lib/costs'
import { getProducts } from '#/lib/tool-products'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/herramienta/productos/')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getProducts(),
  component: Productos,
})

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const PILL: Record<Verdict, { style: string; icon: typeof CircleCheck }> = {
  LOSS: { style: 'bg-danger-soft text-danger', icon: CircleX },
  LOW: { style: 'bg-warning-soft text-warning', icon: CircleAlert },
  GOOD: { style: 'bg-success-soft text-success', icon: CircleCheck },
  COVERED: { style: 'bg-muted text-muted-foreground', icon: CircleMinus },
  NONE: { style: 'bg-muted text-muted-foreground', icon: CircleMinus },
}

function Productos() {
  const products = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'alert'>('all')
  const [archived, setArchived] = useState(false)

  const active = products.filter((p) => !p.archived)
  const shown = products.filter(
    (p) =>
      (archived || !p.archived) &&
      (!query.trim() || fold(p.name).includes(fold(query.trim()))) &&
      (filter === 'all' || p.verdict === 'LOSS' || p.verdict === 'LOW'),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Productos
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Lo que vendes. Un producto lleva una o varias recetas más su
            empaque, y aquí es donde fijas el precio.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/productos/nuevo">+ Nuevo producto</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar producto"
          placeholder="Buscar producto"
          className="w-65 max-w-full"
        />
        <ToggleGroup
          type="single"
          variant="outline"
          value={filter}
          onValueChange={(v) => v && setFilter(v as 'all' | 'alert')}
          aria-label="Filtrar"
        >
          <ToggleGroupItem value="all">Todos</ToggleGroupItem>
          <ToggleGroupItem value="alert">Con alerta</ToggleGroupItem>
        </ToggleGroup>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={setArchived} />
          Ver archivados
        </label>
        <Badge variant="outline">
          {shown.length === active.length
            ? shown.length
            : `${shown.length} de ${active.length}`}{' '}
          {shown.length === 1 && active.length === 1 ? 'producto' : 'productos'}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-205 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Producto</TableHead>
              <TableHead>Se vende como</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Ganancia</TableHead>
              <TableHead className="pr-4">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => {
              const pill = PILL[p.verdict]
              const Icon = pill.icon
              const tone =
                p.verdict === 'LOSS'
                  ? 'text-danger'
                  : p.verdict === 'LOW'
                    ? 'text-warning'
                    : p.verdict === 'GOOD'
                      ? 'text-success'
                      : 'text-muted-foreground'
              return (
                <TableRow key={p.id} className={p.archived ? 'opacity-60' : ''}>
                  <TableCell className="py-3.5 pl-4">
                    <Link
                      to="/herramienta/productos/$id"
                      params={{ id: p.id }}
                      className="font-medium"
                    >
                      {p.name}
                    </Link>
                    {p.archived && (
                      <Badge variant="outline" className="ml-2">
                        Archivado
                      </Badge>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {p.recipes.length > 0
                        ? `${p.recipes.length === 1 ? 'Receta' : 'Recetas'}: ${p.recipes.join(', ')}`
                        : 'Sin recetas'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.slices ? 'Entero y por rebanada' : 'Entero'}
                    {p.slices && (
                      <div className="text-sm text-muted-foreground">
                        {p.slices} rebanadas por pieza
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.cost === null ? '—' : formatPrice(p.cost)}
                  </TableCell>
                  <TableCell>
                    {p.price === null ? '—' : formatPrice(p.price)}
                  </TableCell>
                  <TableCell className={cn('font-medium', tone)}>
                    {p.gain
                      ? `${p.gain.amount < 0 ? '−' : ''}${formatPrice(Math.abs(p.gain.amount))} · ${p.gain.pct < 0 ? '−' : ''}${Math.abs(p.gain.pct).toFixed(1)}%`
                      : '—'}
                  </TableCell>
                  <TableCell className="pr-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-xs font-medium',
                        pill.style,
                      )}
                    >
                      <Icon className="size-3.5" />
                      {p.verdict === 'NONE' && p.incomplete
                        ? p.recipes.length === 0
                          ? 'Sin recetas'
                          : 'Sin ingredientes'
                        : p.verdict === 'NONE'
                          ? 'Sin precio'
                          : VERDICT_LABEL[p.verdict]}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {products.length === 0
                    ? 'Aún no tienes productos. Agrega el primero con “+ Nuevo producto”.'
                    : filter === 'alert'
                      ? 'Ningún producto tiene alerta.'
                      : 'Ningún producto coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="m-0 text-sm text-muted-foreground">
        El costo incluye ingredientes, empaque y lo que cada receta tenga
        activado: merma, gasto fijo y mano de obra.
      </p>
    </>
  )
}
