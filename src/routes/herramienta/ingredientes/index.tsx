import { Link, createFileRoute } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Switch } from '#/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { KINDS, costLine, formatPrice, purchaseLabel } from '#/lib/costs'
import { getIngredients } from '#/lib/tool-ingredients'
import { getPlaces } from '#/lib/tool-places'

export const Route = createFileRoute('/herramienta/ingredientes/')({
  // Sin caché: tras guardar, la lista y el formulario muestran siempre lo último (con caché, por
  // un instante saldrían los datos de antes, y un formulario podría abrirse con valores viejos).
  gcTime: 0,
  staleTime: 0,
  loader: async () => ({
    ingredients: await getIngredients(),
    places: await getPlaces(),
  }),
  component: Ingredientes,
})

// Texto sin mayúsculas ni tildes, para buscar "azucar" y encontrar "Azúcar".
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function Ingredientes() {
  const { ingredients, places } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [place, setPlace] = useState('all')
  const [archived, setArchived] = useState(false)

  const active = ingredients.filter((i) => !i.archived)
  const shown = ingredients.filter(
    (i) =>
      (archived || !i.archived) &&
      (!query.trim() || fold(i.name).includes(fold(query.trim()))) &&
      (kind === 'all' || i.kind === kind) &&
      (place === 'all' ||
        (place === 'none' ? i.placeId === null : i.placeId === place)),
  )
  const count =
    shown.length === active.length
      ? String(shown.length)
      : `${shown.length} de ${active.length}`

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Ingredientes
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Todo lo que compras: ingredientes y empaques. Escribe cuánto pagaste
            y por cuánto, y calculamos lo que cuesta cada gramo, mililitro o
            pieza.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/ingredientes/nuevo">+ Nuevo ingrediente</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar ingrediente"
          placeholder="Buscar ingrediente"
          className="w-65 max-w-full"
        />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="Tipo" className="w-47.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(KINDS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={place} onValueChange={setPlace}>
          <SelectTrigger aria-label="Lugar" className="w-47.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los lugares</SelectItem>
            <SelectItem value="none">Sin lugar asignado</SelectItem>
            {places.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={setArchived} />
          Ver archivados
        </label>
        <Badge variant="outline">
          {count}{' '}
          {shown.length === 1 && count === '1' ? 'ingrediente' : 'ingredientes'}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-190 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Lugar de compra</TableHead>
              <TableHead>Se compra en</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="pr-4 text-right">
                Costo por unidad
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((i) => (
              <TableRow key={i.id} className={i.archived ? 'opacity-60' : ''}>
                <TableCell className="py-3.5 pl-4">
                  <Link
                    to="/herramienta/ingredientes/$id"
                    params={{ id: i.id }}
                    className="font-medium"
                  >
                    {i.name}
                  </Link>
                  {i.archived && (
                    <Badge variant="outline" className="ml-2">
                      Archivado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{KINDS[i.kind]}</Badge>
                </TableCell>
                <TableCell>{i.placeName ?? '—'}</TableCell>
                <TableCell>{purchaseLabel(i.quantity, i.unit)}</TableCell>
                <TableCell className="text-right">
                  {formatPrice(i.price)}
                </TableCell>
                <TableCell className="pr-4 text-right">{costLine(i)}</TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {ingredients.length === 0
                    ? 'Aún no tienes ingredientes. Agrega el primero con “+ Nuevo ingrediente”.'
                    : 'Ningún ingrediente coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Alert>
        <Info />
        <AlertTitle>Cómo se actualizan los precios</AlertTitle>
        <AlertDescription>
          Cambias cada precio a mano desde el ingrediente, o los actualizas al
          registrar una compra, donde ves el último precio y cuánto cambió. Los
          cambios se aplican a todas las recetas que lo usan.
        </AlertDescription>
      </Alert>
    </>
  )
}
