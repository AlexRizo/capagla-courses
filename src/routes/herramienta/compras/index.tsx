import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { requireToolPage } from '#/lib/tool-access'
import { formatDay } from '#/lib/cost-purchases'
import { formatPrice } from '#/lib/costs'
import { getPurchases } from '#/lib/tool-purchases'

export const Route = createFileRoute('/herramienta/compras/')({
  beforeLoad: () => requireToolPage('PURCHASES'),
  gcTime: 0,
  staleTime: 0,
  loader: () => getPurchases(),
  component: Compras,
})

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function Compras() {
  const { purchases, places } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('all')

  const shown = purchases.filter(
    (p) =>
      (place === 'all' ||
        (place === 'none' ? p.placeId === null : p.placeId === place)) &&
      (!query.trim() ||
        fold(`${formatDay(p.date)} ${p.placeName ?? ''}`).includes(
          fold(query.trim()),
        )),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Registro de compras
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Lo que has comprado. Cada compra mantiene tus precios al día.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/compras/nueva">+ Registrar compra</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar compra"
          placeholder="Buscar compra"
          className="w-65 max-w-full"
        />
        <Select value={place} onValueChange={setPlace}>
          <SelectTrigger aria-label="Lugar" className="w-47.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los lugares</SelectItem>
            <SelectItem value="none">Sin tienda</SelectItem>
            {places.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">
          {shown.length === purchases.length
            ? shown.length
            : `${shown.length} de ${purchases.length}`}{' '}
          {purchases.length === 1 ? 'compra' : 'compras'}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-180 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Fecha</TableHead>
              <TableHead>Lugar</TableHead>
              <TableHead className="text-right">Ingredientes</TableHead>
              <TableHead className="text-right">
                Precios que cambiaron
              </TableHead>
              <TableHead className="pr-4 text-right">Total pagado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="py-3.5 pl-4">
                  <Link
                    to="/herramienta/compras/$id"
                    params={{ id: p.id }}
                    className="font-medium"
                  >
                    {formatDay(p.date)}
                  </Link>
                </TableCell>
                <TableCell>{p.placeName ?? '—'}</TableCell>
                <TableCell className="text-right">{p.ingredients}</TableCell>
                <TableCell className="text-right">{p.changed}</TableCell>
                <TableCell className="pr-4 text-right">
                  {formatPrice(p.total)}
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {purchases.length === 0
                    ? 'Aún no has registrado compras. Anota la primera con “+ Registrar compra”.'
                    : 'Ninguna compra coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
