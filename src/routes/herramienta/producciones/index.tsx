import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { requireToolPage } from '#/lib/tool-access'
import { formatAmount } from '#/lib/costs'
import { getProductions } from '#/lib/tool-productions'

export const Route = createFileRoute('/herramienta/producciones/')({
  beforeLoad: () => requireToolPage('PRODUCTION'),
  gcTime: 0,
  staleTime: 0,
  loader: () => getProductions(),
  component: Producciones,
})

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

function Producciones() {
  const productions = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const shown = productions.filter(
    (p) => !query.trim() || fold(p.name).includes(fold(query.trim())),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Producciones
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Lo que vas a hornear. Cada producción se guarda 30 días: puedes
            repetirla o armar una lista de compra aparte para cada una.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/producciones/nueva">+ Nueva producción</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar producción"
          placeholder="Buscar producción"
          className="w-65 max-w-full"
        />
        <Badge variant="outline">
          {plural(
            productions.length,
            'producción guardada',
            'producciones guardadas',
          )}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-190 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Producción</TableHead>
              <TableHead className="text-right">Dinero para comprar</TableHead>
              <TableHead className="text-right">Costo de producción</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="pr-4">Vence en</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="py-3.5 pl-4">
                  <Link
                    to="/herramienta/producciones/$id"
                    params={{ id: p.id }}
                    className="font-medium"
                  >
                    {p.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {plural(p.products, 'producto', 'productos')} ·{' '}
                    {plural(p.pieces, 'pieza', 'piezas')}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(p.buy)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(p.cost)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(p.sales)}
                </TableCell>
                <TableCell className="pr-4">
                  <Badge variant="outline">
                    {plural(p.daysLeft, 'día', 'días')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {productions.length === 0
                    ? 'Aún no tienes producciones. Agrega la primera con “+ Nueva producción”.'
                    : 'Ninguna producción coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
