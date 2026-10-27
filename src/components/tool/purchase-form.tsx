import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { newKey } from '#/components/tool/lines-editor'
import { Picker } from '#/components/tool/picker'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
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
import { changeLabel, priceChange, purchaseSchema } from '#/lib/cost-purchases'
import { UNITS, formatPrice, formatQuantity, parseDecimal } from '#/lib/costs'
import { toLocalInput } from '#/lib/promotions'
import { savePurchase } from '#/lib/tool-purchases'
import type { getPurchaseForm } from '#/lib/tool-purchases'
import { cn } from '#/lib/utils'

type Loaded = Awaited<ReturnType<typeof getPurchaseForm>>
type Row = {
  key: string
  ingredientId: string
  price: string
  packGrams: string
}

const NO_PLACE = 'none'

// Texto y color del cambio de un precio: sube en ámbar, baja en verde, igual en gris.
const CHANGE_TONE = {
  UP: 'text-warning',
  DOWN: 'text-success',
  SAME: 'text-muted-foreground',
  NEW: 'text-muted-foreground',
} as const

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-44 flex-col gap-0.5 rounded-lg border px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function PurchaseForm({ data }: { data: Loaded }) {
  const { places, ingredients } = data
  const navigate = useNavigate()
  const router = useRouter()
  const [placeKey, setPlaceKey] = useState(places.at(0)?.id ?? NO_PLACE)
  // Hoy, en hora de México (el día en que se compra).
  const [date, setDate] = useState(() => toLocalInput(new Date()).slice(0, 10))
  const [rows, setRows] = useState<Row[]>([])
  // El aviso solo vale para los renglones con los que se intentó guardar: en cuanto cambian, se va.
  const [failure, setFailure] = useState<{
    message: string
    rows: Row[]
  } | null>(null)
  const error = failure && failure.rows === rows ? failure.message : null
  const setError = (message: string | null) =>
    setFailure(message ? { message, rows } : null)
  const [busy, setBusy] = useState(false)

  const byId = new Map(ingredients.map((i) => [i.id, i]))

  const info = rows.map((r) => {
    const ing = byId.get(r.ingredientId)
    const paid = parseDecimal(r.price)
    const change = ing && paid !== null ? priceChange(ing.price, paid) : null
    return { row: r, ing, paid, change }
  })
  const changed = info.filter((i) => i.change && i.change.kind !== 'SAME')
  const recipes = new Set(changed.flatMap((i) => i.ing?.recipeIds ?? []))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      placeId: placeKey === NO_PLACE ? null : placeKey,
      date,
      items: info.map((i) => ({
        ingredientId: i.row.ingredientId,
        price: i.paid ?? Number.NaN,
        packGrams:
          i.row.packGrams.trim() === ''
            ? null
            : (parseDecimal(i.row.packGrams) ?? Number.NaN),
      })),
    }
    if (info.some((i) => i.paid === null)) {
      setError('Escribe cuánto pagaste en cada ingrediente.')
      return
    }
    const parsed = purchaseSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await savePurchase({ data: { values: input } })
      if (!result.id) return setError(result.error ?? 'No se pudo guardar.')
      await router.invalidate()
      await navigate({ to: '/herramienta/compras' })
    } catch {
      setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">
          Registrar compra
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Anota lo que pagaste. A la izquierda ves el último precio para
          comparar.
        </p>
      </div>

      <form onSubmit={save} className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="flex w-56 max-w-full flex-col gap-1.5">
              <Label htmlFor="tienda">Tienda</Label>
              <Select value={placeKey} onValueChange={setPlaceKey}>
                <SelectTrigger id="tienda" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {places.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_PLACE}>Sin tienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-48 flex-col gap-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Tile
              label="Precios que cambian"
              value={`${changed.length} de ${rows.length}`}
            />
            <Tile
              label="Recetas que cambiarán de costo"
              value={String(recipes.size)}
            />
          </CardContent>
        </Card>

        <Picker
          aria-label="Agregar ingrediente"
          items={ingredients
            .filter((i) => !rows.some((r) => r.ingredientId === i.id))
            .map((i) => ({ id: i.id, label: i.name }))}
          value=""
          onChange={(id) => {
            const ing = byId.get(id)
            if (!ing) return
            setRows((rs) => [
              ...rs,
              {
                key: newKey(),
                ingredientId: id,
                // Arranca con el último precio: solo se cambia lo que subió o bajó.
                price: ing.price.toFixed(2),
                packGrams: '',
              },
            ])
          }}
          placeholder="+ Agregar ingrediente"
          searchPlaceholder="Buscar ingrediente para agregar"
          className="w-80"
        />

        <Card>
          <CardContent className="p-0">
            <Table className="min-w-170 tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Ingrediente</TableHead>
                  <TableHead className="text-right">Último precio</TableHead>
                  <TableHead className="w-44">Pagaste hoy</TableHead>
                  <TableHead className="w-28">Cambio</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.map(({ row, ing, change }) => (
                  <TableRow key={row.key}>
                    <TableCell className="py-3 pl-4">
                      <div className="font-medium">{ing?.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        por {ing && formatQuantity(ing.quantity)}{' '}
                        {ing && UNITS[ing.unit].label}
                        {ing?.weighable && (
                          <>
                            {' · pesaron '}
                            <Input
                              aria-label={`Peso del paquete: ${ing.name}`}
                              inputMode="decimal"
                              value={row.packGrams}
                              placeholder={
                                ing.packGrams
                                  ? formatQuantity(ing.packGrams)
                                  : ''
                              }
                              onChange={(e) =>
                                setRows((rs) =>
                                  rs.map((x) =>
                                    x.key === row.key
                                      ? { ...x, packGrams: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                              className="h-7 w-24 px-2 text-sm"
                            />{' '}
                            g (opcional)
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {ing ? formatPrice(ing.price) : '—'}
                    </TableCell>
                    <TableCell>
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>$</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          aria-label={`Pagaste hoy: ${ing?.name}`}
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs.map((x) =>
                                x.key === row.key
                                  ? { ...x, price: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </InputGroup>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'font-medium',
                        change && CHANGE_TONE[change.kind],
                      )}
                    >
                      {change ? changeLabel(change) : '—'}
                    </TableCell>
                    <TableCell className="pr-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar ${ing?.name}`}
                        onClick={() =>
                          setRows((rs) => rs.filter((x) => x.key !== row.key))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Aún no hay ingredientes. Agrégalos con “+ Agregar
                      ingrediente”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="m-0 text-sm text-muted-foreground">
          Al guardar, los nuevos precios se usan en tus recetas y productos.
          Revisa el semáforo de los que quedaron más caros.
        </p>
        {error && <p className="m-0 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/herramienta/compras">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            Guardar compra
          </Button>
        </div>
      </form>
    </>
  )
}
