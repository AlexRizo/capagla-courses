import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

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
import {
  changeLabel,
  formatDay,
  priceChange,
  purchaseEditSchema,
} from '#/lib/cost-purchases'
import { UNITS, formatPrice, formatQuantity, parseDecimal } from '#/lib/costs'
import { updatePurchase } from '#/lib/tool-purchases'
import type { getPurchaseEdit } from '#/lib/tool-purchases'
import { cn } from '#/lib/utils'
import { HelpButton } from '#/components/tool/tool-help'

// Corregir una compra ya registrada (H42): tienda, día, lo que se pagó y el peso del paquete, o
// quitar un ingrediente. Para agregar uno que faltó se registra otra compra.

type Loaded = Awaited<ReturnType<typeof getPurchaseEdit>>
type Item = Loaded['purchase']['items'][number]
type Row = { item: Item; price: string; packGrams: string }

const NO_PLACE = 'none'

const CHANGE_TONE = {
  UP: 'text-warning',
  DOWN: 'text-success',
  SAME: 'text-muted-foreground',
  NEW: 'text-muted-foreground',
} as const

// "90.00" o "" (sin peso).
const asInput = (v: number | null) => (v === null ? '' : String(v))

export function PurchaseEditForm({ data }: { data: Loaded }) {
  const { places, purchase } = data
  const navigate = useNavigate()
  const router = useRouter()
  const [placeKey, setPlaceKey] = useState(purchase.placeId ?? NO_PLACE)
  const [date, setDate] = useState(purchase.date)
  const [rows, setRows] = useState<Row[]>(() =>
    purchase.items.map((item) => ({
      item,
      price: item.price.toFixed(2),
      packGrams: asInput(item.packGrams),
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const info = rows.map((r) => {
    const paid = parseDecimal(r.price)
    return {
      row: r,
      paid,
      change: paid === null ? null : priceChange(r.item.previousPrice, paid),
    }
  })
  // Recetas que cambian de costo: las de los ingredientes cuyo precio de hoy se mueve.
  const touched = [
    ...info.filter(
      (i) =>
        i.row.item.applies &&
        i.paid !== null &&
        Math.abs(i.paid - i.row.item.price) >= 0.005,
    ),
    ...purchase.items
      .filter((p) => p.applies && !rows.some((r) => r.item.itemId === p.itemId))
      .map((p) => ({ row: { item: p } })),
  ]
  const recipes = new Set(touched.flatMap((t) => t.row.item.recipeIds))
  const update = (itemId: string, patch: Partial<Row>) =>
    setRows((rs) =>
      rs.map((r) => (r.item.itemId === itemId ? { ...r, ...patch } : r)),
    )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (info.some((i) => i.paid === null)) {
      setError('Escribe cuánto pagaste en cada ingrediente.')
      return
    }
    const input = {
      placeId: placeKey === NO_PLACE ? null : placeKey,
      date,
      items: info.map((i) => ({
        itemId: i.row.item.itemId,
        price: i.paid ?? Number.NaN,
        packGrams:
          i.row.packGrams.trim() === ''
            ? null
            : (parseDecimal(i.row.packGrams) ?? Number.NaN),
      })),
    }
    const parsed = purchaseEditSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await updatePurchase({
        data: { id: purchase.id, values: input },
      })
      if (!('id' in result)) return setError(result.error)
      await router.invalidate()
      await navigate({
        to: '/herramienta/compras/$id',
        params: { id: purchase.id },
      })
    } catch {
      setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <h1 className="m-0 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          Corregir compra del {formatDay(purchase.date)}
          <HelpButton />
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Cambia lo que pagaste o quita un ingrediente que no compraste. Para
          agregar uno que faltó, registra otra compra.
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
            <div className="flex min-w-44 flex-col gap-0.5 rounded-lg border px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Recetas que cambiarán de costo
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {recipes.size}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table className="min-w-170 tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Ingrediente</TableHead>
                  <TableHead className="text-right">Precio anterior</TableHead>
                  <TableHead className="w-44">Pagaste</TableHead>
                  <TableHead className="w-28">Cambio</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.map(({ row, change }) => {
                  const it = row.item
                  return (
                    <TableRow key={it.itemId}>
                      <TableCell className="py-3 pl-4">
                        <div className="font-medium">{it.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                          por {formatQuantity(it.quantity)}{' '}
                          {UNITS[it.unit].label}
                          {it.weighable && (
                            <>
                              {' · pesaron '}
                              <Input
                                aria-label={`Peso del paquete: ${it.name}`}
                                inputMode="decimal"
                                value={row.packGrams}
                                onChange={(e) =>
                                  update(it.itemId, {
                                    packGrams: e.target.value,
                                  })
                                }
                                className="h-7 w-24 px-2 text-sm"
                              />{' '}
                              g (opcional)
                            </>
                          )}
                        </div>
                        {!it.applies && (
                          <div className="mt-1 max-w-sm text-xs whitespace-normal text-muted-foreground">
                            Solo se corrige el historial: el precio de hoy de
                            este ingrediente ya no viene de esta compra.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(it.previousPrice)}
                      </TableCell>
                      <TableCell>
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>$</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            aria-label={`Pagaste: ${it.name}`}
                            inputMode="decimal"
                            value={row.price}
                            onChange={(e) =>
                              update(it.itemId, { price: e.target.value })
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
                          aria-label={`Quitar ${it.name} de la compra`}
                          disabled={rows.length === 1}
                          onClick={() =>
                            setRows((rs) =>
                              rs.filter((r) => r.item.itemId !== it.itemId),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="m-0 text-sm text-muted-foreground">
          Si esta es tu compra más reciente de un ingrediente, su precio se
          corrige en tus recetas y productos. Si quitas uno, vuelve al precio
          que tenía antes de esta compra.
        </p>
        {error && <p className="m-0 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/herramienta/compras/$id" params={{ id: purchase.id }}>
              Cancelar
            </Link>
          </Button>
          <Button type="submit" disabled={busy}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </>
  )
}
