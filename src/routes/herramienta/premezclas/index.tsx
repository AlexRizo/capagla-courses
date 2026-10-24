import { Link, createFileRoute } from '@tanstack/react-router'
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
import { UNITS, formatPrice, formatQuantity } from '#/lib/costs'
import { getPremixes } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/premezclas/')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getPremixes(),
  component: Premezclas,
})

// Texto sin mayúsculas ni tildes, para buscar "betun" y encontrar "Betún".
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function Premezclas() {
  const premixes = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)

  const active = premixes.filter((p) => !p.archived)
  const shown = premixes.filter(
    (p) =>
      (archived || !p.archived) &&
      (!query.trim() || fold(p.name).includes(fold(query.trim()))),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Premezclas
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Mezclas que preparas una vez y usas en varias recetas, como un betún
            o un relleno. Se cuestan por lo que realmente rinden.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/premezclas/nueva">+ Nueva premezcla</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar premezcla"
          placeholder="Buscar premezcla"
          className="w-65 max-w-full"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={setArchived} />
          Ver archivadas
        </label>
        <Badge variant="outline">
          {shown.length === active.length
            ? shown.length
            : `${shown.length} de ${active.length}`}{' '}
          {shown.length === 1 && active.length === 1
            ? 'premezcla'
            : 'premezclas'}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-180 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Premezcla</TableHead>
              <TableHead>Ingredientes</TableHead>
              <TableHead>Rinde de verdad</TableHead>
              <TableHead className="pr-4">Costo por unidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id} className={p.archived ? 'opacity-60' : ''}>
                <TableCell className="py-3.5 pl-4">
                  <Link
                    to="/herramienta/premezclas/$id"
                    params={{ id: p.id }}
                    className="font-medium"
                  >
                    {p.name}
                  </Link>
                  {p.archived && (
                    <Badge variant="outline" className="ml-2">
                      Archivada
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {p.ingredients === 0 ? (
                    <Badge variant="secondary">Sin ingredientes</Badge>
                  ) : (
                    p.ingredients
                  )}
                </TableCell>
                <TableCell>
                  {p.yieldQty
                    ? `${formatQuantity(p.yieldQty)} ${UNITS[p.yieldUnit].label}`
                    : '—'}
                </TableCell>
                <TableCell className="pr-4">
                  {p.perBulk === null
                    ? '—'
                    : `${formatPrice(p.perBulk)} / ${p.bulkUnit === 'litro' ? 'l' : 'kg'}`}
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {premixes.length === 0
                    ? 'Aún no tienes premezclas. Agrega la primera con “+ Nueva premezcla”.'
                    : 'Ninguna premezcla coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
