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
import { Switch } from '#/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Info } from 'lucide-react'
import { formatPrice } from '#/lib/costs'
import { getRecipes } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/recetas/')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getRecipes(),
  component: Recetas,
})

// Texto sin mayúsculas ni tildes, para buscar "galleta" y encontrar "Galleta".
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function Recetas() {
  const recipes = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [archived, setArchived] = useState(false)

  const active = recipes.filter((r) => !r.archived)
  const tags = [...new Set(recipes.flatMap((r) => (r.tag ? [r.tag] : [])))]
  const shown = recipes.filter(
    (r) =>
      (archived || !r.archived) &&
      (!query.trim() || fold(r.name).includes(fold(query.trim()))) &&
      (tag === 'all' || r.tag === tag),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Recetas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cada receta es una tanda: un pastel, una charola, una docena. Aquí
            defines qué lleva, cuántas piezas rinde y cuánto cuesta hacerla, sin
            empaque ni precio de venta.
          </p>
        </div>
        <Button asChild>
          <Link to="/herramienta/recetas/nueva">+ Nueva receta</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar receta"
          placeholder="Buscar receta"
          className="w-65 max-w-full"
        />
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger aria-label="Etiqueta" className="w-47.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etiquetas</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          to="/herramienta/etiquetas"
          className="text-sm text-primary underline underline-offset-3"
        >
          Administrar etiquetas
        </Link>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={setArchived} />
          Ver archivadas
        </label>
        <Badge variant="outline">
          {shown.length === active.length
            ? shown.length
            : `${shown.length} de ${active.length}`}{' '}
          {shown.length === 1 && active.length === 1 ? 'receta' : 'recetas'}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-180 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nombre</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Rinde</TableHead>
              <TableHead className="pr-4 text-right">Costo de receta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id} className={r.archived ? 'opacity-60' : ''}>
                <TableCell className="py-3.5 pl-4">
                  <Link
                    to="/herramienta/recetas/$id"
                    params={{ id: r.id }}
                    className="font-medium"
                  >
                    {r.name}
                  </Link>
                  {r.archived && (
                    <Badge variant="outline" className="ml-2">
                      Archivada
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.tag ? <Badge variant="secondary">{r.tag}</Badge> : '—'}
                </TableCell>
                <TableCell>
                  {r.yieldPieces
                    ? `${r.yieldPieces} ${r.yieldPieces === 1 ? 'pieza' : 'piezas'}`
                    : '—'}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {r.empty ? (
                    <Badge variant="secondary">Sin ingredientes</Badge>
                  ) : (
                    formatPrice(r.total ?? 0)
                  )}
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {recipes.length === 0
                    ? 'Aún no tienes recetas. Agrega la primera con “+ Nueva receta”.'
                    : 'Ninguna receta coincide con tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Alert>
        <Info />
        <AlertTitle>Puedes repetir nombres</AlertTitle>
        <AlertDescription>
          Si ya tienes un “Pastel Red Velvet”, puedes crear otro igual con otra
          etiqueta, por ejemplo Cupcake. La etiqueta solo sirve para filtrar; el
          rendimiento siempre se mide en piezas.
        </AlertDescription>
      </Alert>
      <p className="m-0 text-sm text-muted-foreground">
        El costo de receta ya incluye merma, gasto fijo y mano de obra si los
        activaste en esa receta.
      </p>
    </>
  )
}
