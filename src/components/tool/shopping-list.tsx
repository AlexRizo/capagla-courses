import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Link, useRouter } from '@tanstack/react-router'
import { GripVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Picker } from '#/components/tool/picker'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { moveRow, shareText } from '#/lib/cost-shopping'
import { formatPrice, parseDecimal, UNITS } from '#/lib/costs'
import type { CostUnit } from '#/lib/costs'
import { addManualItem, removeManualItem, saveListState } from '#/lib/tool-list'
import type { getList } from '#/lib/tool-list'
import { cn } from '#/lib/utils'

type Loaded = Awaited<ReturnType<typeof getList>>
type Row = Loaded['rows'][number]

const NONE = 'none'
const NONE_LABEL = 'Sin lugar asignado'

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

// Lo que se guarda de cada renglón, en el orden en que está.
const toEntries = (rows: Row[]) =>
  rows.map((r) => ({
    ingredientId: r.ingredientId,
    placeKey: r.placeKey,
    haveIt: r.haveIt,
    bought: r.bought,
  }))

function Origin({ row }: { row: Row }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.origin.production && <Badge variant="secondary">Producción</Badge>}
      {row.origin.manual && <Badge variant="outline">Manual</Badge>}
    </div>
  )
}

// Un renglón que se arrastra (por su asa) y también recibe renglones soltados encima.
function ListRow({
  row,
  view,
  places,
  onHaveIt,
  onPlace,
  onRemoveManual,
}: {
  row: Row
  view: 'store' | 'ingredient'
  places: Loaded['places']
  onHaveIt: (v: boolean) => void
  onPlace: (key: string) => void
  onRemoveManual: () => void
}) {
  const drag = useDraggable({ id: row.ingredientId })
  const drop = useDroppable({ id: row.ingredientId })
  return (
    <TableRow
      ref={(node) => {
        drag.setNodeRef(node)
        drop.setNodeRef(node)
      }}
      className={cn(
        row.haveIt && 'opacity-50',
        drag.isDragging && 'opacity-40',
        drop.isOver && !drag.isDragging && 'bg-accent',
      )}
    >
      <TableCell className="w-8 pl-3">
        <button
          type="button"
          aria-label={`Arrastrar ${row.name}`}
          title="Arrastra para cambiar el orden o moverlo a otro lugar"
          className="cursor-grab touch-none border-0 bg-transparent p-0 text-muted-foreground print:hidden"
          {...drag.attributes}
          {...drag.listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="w-24">
        <Checkbox
          aria-label={`Ya lo tengo: ${row.name}`}
          checked={row.haveIt}
          onCheckedChange={(v) => onHaveIt(v === true)}
        />
      </TableCell>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell>
        <Badge variant="secondary">
          {row.kind === 'PACKAGING' ? 'Empaque' : 'Ingrediente'}
        </Badge>
      </TableCell>
      <TableCell>{row.needLabel}</TableCell>
      <TableCell>{row.buyLabel}</TableCell>
      <TableCell>
        {view === 'store' ? (
          <Origin row={row} />
        ) : (
          <Select value={row.placeKey} onValueChange={onPlace}>
            <SelectTrigger
              aria-label={`Lugar de compra: ${row.name}`}
              className="w-44 print:border-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{NONE_LABEL}</SelectItem>
              {places.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-right">
        {row.haveIt ? '—' : formatPrice(row.cost)}
      </TableCell>
      <TableCell className="w-12 pr-3">
        {row.origin.manual && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar lo agregado a mano: ${row.name}`}
            className="print:hidden"
            onClick={onRemoveManual}
          >
            <Trash2 />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// Encabezado con anchos fijos: así las columnas de todas las tiendas quedan alineadas.
const HEAD = (last: string) => (
  <TableHeader>
    <TableRow>
      <TableHead className="w-8" />
      <TableHead className="w-24">Ya lo tengo</TableHead>
      <TableHead>Ingrediente</TableHead>
      <TableHead className="w-28">Tipo</TableHead>
      <TableHead className="w-28">Necesitas</TableHead>
      <TableHead className="w-32">Comprar</TableHead>
      <TableHead className="w-48">{last}</TableHead>
      <TableHead className="w-24 text-right">Costo</TableHead>
      <TableHead className="w-12" />
    </TableRow>
  </TableHeader>
)

// Un grupo de la vista por tienda: también recibe renglones (aunque esté vacío).
function Group({
  placeKey,
  name,
  rows,
  children,
}: {
  placeKey: string
  name: string
  rows: Row[]
  children: React.ReactNode
}) {
  const drop = useDroppable({ id: `group:${placeKey}` })
  const subtotal = rows.reduce((s, r) => s + (r.haveIt ? 0 : r.cost), 0)
  return (
    <Card
      ref={drop.setNodeRef}
      className={cn('gap-0 py-0', drop.isOver && 'ring-2 ring-primary')}
    >
      <CardHeader className="flex flex-row items-baseline justify-between gap-3 border-b py-4">
        <div className="flex items-baseline gap-3">
          <CardTitle>{name}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {plural(rows.length, 'producto', 'productos')}
          </span>
        </div>
        <span className="font-medium tabular-nums">
          {formatPrice(subtotal)}
        </span>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

export function ShoppingList({ data }: { data: Loaded }) {
  const router = useRouter()
  const productionId = data.production?.id ?? null
  const [rows, setRows] = useState<Row[]>(data.rows)
  const [view, setView] = useState<'store' | 'ingredient'>('store')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<CostUnit | ''>('')
  const units = data.choices.find((c) => c.id === ingredientId)?.units ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  async function persist(next: Row[]) {
    setRows(next)
    setError(null)
    try {
      const result = await saveListState({
        data: { productionId, entries: toEntries(next) },
      })
      if (!('ok' in result)) setError(result.error)
    } catch {
      setError('No se pudo guardar tu lista. Inténtalo de nuevo.')
    }
  }

  const update = (id: string, patch: Partial<Row>) =>
    void persist(
      rows.map((r) => (r.ingredientId === id ? { ...r, ...patch } : r)),
    )

  function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id
    if (!over) return
    const activeId = String(event.active.id)
    const target = String(over)
    const next = target.startsWith('group:')
      ? moveRow(
          rows,
          activeId,
          { kind: 'group', key: target.slice('group:'.length) },
          true,
        )
      : moveRow(rows, activeId, { kind: 'row', id: target }, view === 'store')
    if (next !== rows) void persist(next)
  }

  function pickIngredient(id: string) {
    setIngredientId(id)
    setUnit(data.choices.find((c) => c.id === id)?.units[0] ?? '')
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    const n = parseDecimal(quantity)
    if (!ingredientId || !unit || !n || n <= 0) {
      setError('Elige un ingrediente y escribe cuánto necesitas.')
      return
    }
    setError(null)
    try {
      const result = await addManualItem({
        data: { productionId, ingredientId, quantity: n, unit },
      })
      if (!('ok' in result)) return setError(result.error)
      setIngredientId('')
      setQuantity('')
      setUnit('')
      await router.invalidate()
    } catch {
      setError('No se pudo agregar. Inténtalo de nuevo.')
    }
  }

  async function removeManual(id: string) {
    try {
      await removeManualItem({ data: { productionId, ingredientId: id } })
      await router.invalidate()
    } catch {
      setError('No se pudo quitar. Inténtalo de nuevo.')
    }
  }

  const pending = rows.filter((r) => !r.haveIt)
  const total = pending.reduce((s, r) => s + r.cost, 0)
  const groups = [
    ...data.places.map((p) => ({ key: p.id, name: p.name })),
    { key: NONE, name: NONE_LABEL },
  ].map((g) => ({
    ...g,
    rows: rows.filter((r) => r.placeKey === g.key),
  }))
  const title = data.production?.name ?? 'Lista directa'

  const text = shareText(
    title,
    groups.map((g) => ({
      name: g.name,
      rows: g.rows
        .filter((r) => !r.haveIt)
        .map((r) => ({ name: r.name, buy: r.buyLabel })),
      subtotal: g.rows.reduce((s, r) => s + (r.haveIt ? 0 : r.cost), 0),
    })),
    total,
  )

  async function share() {
    setNote(null)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Lista de compra · ${title}`, text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote('Lista copiada: pégala donde quieras.')
    } catch {
      // Cerrar el menú de compartir no es un error.
    }
  }

  const rowProps = (r: Row) => ({
    row: r,
    view,
    places: data.places,
    onHaveIt: (v: boolean) => update(r.ingredientId, { haveIt: v }),
    onPlace: (key: string) => update(r.ingredientId, { placeKey: key }),
    onRemoveManual: () => void removeManual(r.ingredientId),
  })

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">
          Lista de compra
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Una sola lista con todo lo que necesitas. Marca “Ya lo tengo” y se
          resta del total.
        </p>
      </div>

      {data.production && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
          <div>
            <div className="text-sm text-muted-foreground">Producción</div>
            <div className="font-medium">
              {[data.production.name, ...data.production.summary].join(' · ')}
            </div>
          </div>
          <Button variant="outline" asChild className="print:hidden">
            <Link
              to="/herramienta/producciones/$id"
              params={{ id: data.production.id }}
            >
              Ver producción
            </Link>
          </Button>
        </div>
      )}

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Agregar a la lista</CardTitle>
          <p className="m-0 text-sm text-muted-foreground">
            Por si necesitas algo que no viene de tu producción. Escribe la
            cantidad que necesitas, tal cual: la lista no la redondea a
            paquetes.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={addManual} className="flex flex-wrap items-end gap-3">
            <div className="flex w-72 max-w-full flex-col gap-1.5">
              <Label>Ingrediente</Label>
              <Picker
                aria-label="Ingrediente"
                items={data.choices.map((c) => ({
                  id: c.id,
                  label: c.name,
                  hint: c.kind === 'PACKAGING' ? 'Empaque' : undefined,
                }))}
                value={ingredientId}
                onChange={pickIngredient}
                placeholder="Elige un ingrediente"
                searchPlaceholder="Buscar ingrediente"
              />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label>Unidad</Label>
              <Select
                value={unit}
                onValueChange={(u) => setUnit(u as CostUnit)}
                disabled={units.length === 0}
              >
                <SelectTrigger aria-label="Unidad">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNITS[u].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Agregar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="print:hidden">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && setView(v as 'store' | 'ingredient')}
          aria-label="Vista"
        >
          <ToggleGroupItem value="store">Por tienda</ToggleGroupItem>
          <ToggleGroupItem value="ingredient">Por ingrediente</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragEnd={onDragEnd}
      >
        {view === 'store' ? (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-sm text-muted-foreground print:hidden">
              Arrastra los renglones para ordenarlos como vas a comprar hoy en
              cada lugar, o llévalos a otro lugar si ese día lo compras en otro
              lado. El orden es el que tú le des.
            </p>
            {groups.map((g) => (
              <Group key={g.key} placeKey={g.key} name={g.name} rows={g.rows}>
                <Table className="min-w-200 table-fixed tabular-nums">
                  {HEAD('Origen')}
                  <TableBody>
                    {g.rows.map((r) => (
                      <ListRow key={r.ingredientId} {...rowProps(r)} />
                    ))}
                    {g.rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="px-4 py-6 text-center text-muted-foreground print:hidden"
                        >
                          Suelta aquí lo que vayas a comprar en este lugar
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Group>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-sm text-muted-foreground print:hidden">
              Arrastra los renglones para ordenarlos como vas a comprar hoy. Es
              el mismo orden que ves en la vista por tienda.
            </p>
            <Card className="py-0">
              <CardContent className="p-0">
                <Table className="min-w-200 table-fixed tabular-nums">
                  {HEAD('Lugar de compra')}
                  <TableBody>
                    {rows.map((r) => (
                      <ListRow key={r.ingredientId} {...rowProps(r)} />
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Aún no hay nada en la lista.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DndContext>

      {error && <p className="m-0 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4 shadow-xs">
        <div>
          <div className="text-sm text-muted-foreground">
            {plural(pending.length, 'por comprar', 'por comprar')} · Total
            estimado
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatPrice(total)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
          >
            Imprimir PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => void share()}>
            Compartir como texto
          </Button>
          <Button variant="outline" asChild>
            <Link
              to="/lista-de-tienda"
              search={productionId ? { produccion: productionId } : {}}
            >
              Vista de tienda
            </Link>
          </Button>
        </div>
      </div>
      {note && <p className="m-0 text-sm text-muted-foreground">{note}</p>}
      <p className="m-0 text-sm text-muted-foreground">
        “Comprar” redondea a los paquetes completos que pide tu producción; lo
        que agregas a mano va con la cantidad exacta que escribiste. Tú decides
        dónde y en qué presentación comprarlo.
      </p>
    </>
  )
}
