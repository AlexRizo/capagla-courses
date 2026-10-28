import { useForm } from '@tanstack/react-form'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { newKey } from '#/components/tool/lines-editor'
import { Picker } from '#/components/tool/picker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { productionSchema, productionSummary } from '#/lib/cost-shopping'
import { formatAmount, formatPrice, parseDecimal } from '#/lib/costs'
import { deleteProduction, saveProduction } from '#/lib/tool-productions'
import type { getProductionForm } from '#/lib/tool-productions'

type Loaded = Awaited<ReturnType<typeof getProductionForm>>
type Row = { key: string; productId: string; quantity: string }

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

// "Producción del 24 de oct": el nombre con que arranca una producción nueva.
const defaultName = () => {
  const d = new Date()
  return `Producción del ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

function Tile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="flex min-w-37.5 flex-1 flex-col gap-0.5 rounded-lg border px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

export function ProductionForm({ data }: { data: Loaded }) {
  const { production, products } = data
  const navigate = useNavigate()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(
    () =>
      production?.items.map((i) => ({
        key: newKey(),
        productId: i.productId,
        quantity: String(i.quantity),
      })) ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<'list' | 'direct'>('list')

  const byId = new Map(products.map((p) => [p.id, p]))

  const toValues = (name: string) => ({
    name,
    items: rows.map((r) => ({
      productId: r.productId,
      quantity: parseDecimal(r.quantity) ?? Number.NaN,
    })),
  })

  const form = useForm({
    defaultValues: { name: production?.name ?? defaultName() },
    validators: {
      onSubmit: ({ value }) => {
        const result = productionSchema.safeParse(toValues(value.name))
        if (result.success) return undefined
        const fields: Record<string, string> = {}
        for (const issue of result.error.issues) {
          if (issue.path[0] === 'name') fields.name = issue.message
        }
        return Object.keys(fields).length > 0 ? { fields } : undefined
      },
    },
    onSubmit: async ({ value }) => {
      // Cada renglón necesita un producto y una cantidad entera de 1 en adelante.
      const bad = rows.some((r) => {
        const q = parseDecimal(r.quantity)
        return !r.productId || !q || !Number.isInteger(q) || q < 1
      })
      if (bad) {
        setError('Elige el producto y escribe cuántos en cada renglón.')
        return
      }
      setError(null)
      try {
        const result = await saveProduction({
          data: { id: production?.id ?? null, values: toValues(value.name) },
        })
        if (!result.id) return setError(result.error ?? 'No se pudo guardar.')
        await router.invalidate()
        await navigate(
          target === 'list'
            ? {
                to: '/herramienta/lista',
                search: { produccion: result.id },
              }
            : { to: '/herramienta/lista', search: {} },
        )
      } catch {
        setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
      }
    },
  })

  async function remove() {
    if (!production) return
    setBusy(true)
    try {
      await deleteProduction({ data: { id: production.id } })
      await router.invalidate()
      await navigate({ to: '/herramienta/producciones' })
    } catch {
      setError('No se pudo borrar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  const errorsOf = (meta: { errors: unknown[] }) =>
    meta.errors.map((e) => (typeof e === 'string' ? { message: e } : undefined))

  const summary = productionSummary(
    rows.map((r) => ({
      quantity: parseDecimal(r.quantity) ?? 0,
      metrics: byId.get(r.productId)?.metrics ?? null,
    })),
  )
  const hours = (n: number) => `${Math.round(n * 100) / 100} h`

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            <form.Subscribe selector={(s) => s.values.name}>
              {(name) => name || 'Nueva producción'}
            </form.Subscribe>
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Elige qué vas a hornear y cuántos. Después proyectas la producción y
            te armamos la lista de compra.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <form.Field name="name">
                {(f) => (
                  <Field
                    className="w-90 max-w-full"
                    data-invalid={f.state.meta.errors.length > 0}
                  >
                    <FieldLabel htmlFor="nombre">
                      Nombre de la producción
                    </FieldLabel>
                    <Input
                      id="nombre"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      maxLength={80}
                      aria-invalid={f.state.meta.errors.length > 0}
                    />
                    <FieldError errors={errorsOf(f.state.meta)} />
                  </Field>
                )}
              </form.Field>
              <Badge variant="outline" className="mb-1.5">
                Se guarda 30 días
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3">
              <Tile
                label="Horas de trabajo"
                value={hours(summary.laborHours)}
              />
              <Tile label="Horas de horno" value={hours(summary.ovenHours)} />
              <Tile
                label="Dinero para comprar"
                value={formatPrice(summary.buy)}
                note="Ingredientes y empaque"
              />
              <Tile
                label="Costo de producción"
                value={formatPrice(summary.cost)}
                note={`Incluye tu tiempo ${formatPrice(summary.labor)} y gastos fijos ${formatPrice(summary.fixed)}`}
              />
              <Tile label="Ventas" value={formatPrice(summary.sales)} />
              <Tile label="Ganancia" value={formatPrice(summary.profit)} />
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              “Dinero para comprar” es lo que cuestan los ingredientes y el
              empaque. En la tienda gastarás un poco más porque compras paquetes
              completos; ese total sale en la lista de compra.
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              Si no te rindió lo esperado, revisa tu proceso para evitar
              pérdidas.
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              Hasta aquí es lo que te cuesta producir. Si entregas, suma
              gasolina, tu tiempo de traslado y comisiones.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Picker
            aria-label="Agregar producto"
            items={products
              .filter((p) => !rows.some((r) => r.productId === p.id))
              .map((p) => ({ id: p.id, label: p.name, hint: p.sells }))}
            value=""
            onChange={(id) =>
              setRows((rs) => [
                ...rs,
                { key: newKey(), productId: id, quantity: '1' },
              ])
            }
            placeholder="+ Agregar producto"
            searchPlaceholder="Buscar producto"
            className="w-72"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table className="min-w-190 tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Producto</TableHead>
                  <TableHead className="w-44">Cantidad</TableHead>
                  <TableHead className="text-right">Costo c/u</TableHead>
                  <TableHead className="text-right">Venta c/u</TableHead>
                  <TableHead className="text-right">
                    Costo de producción
                  </TableHead>
                  <TableHead className="text-right">Venta total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const product = byId.get(r.productId)
                  const q = parseDecimal(r.quantity) ?? 0
                  const m = product?.metrics ?? null
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="py-3 pl-4">
                        <Link
                          to="/herramienta/productos/$id"
                          params={{ id: r.productId }}
                          className="font-medium"
                        >
                          {product?.name}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {product?.sells}
                        </div>
                      </TableCell>
                      <TableCell>
                        <InputGroup>
                          <InputGroupInput
                            aria-label="Cantidad"
                            inputMode="numeric"
                            value={r.quantity}
                            onChange={(e) =>
                              setRows((rs) =>
                                rs.map((x) =>
                                  x.key === r.key
                                    ? { ...x, quantity: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>enteros</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </TableCell>
                      <TableCell className="text-right">
                        {m ? formatPrice(m.cost) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {m?.price == null ? '—' : formatPrice(m.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {m
                          ? formatAmount(Math.round(q * m.cost * 100) / 100)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {m?.price == null
                          ? '—'
                          : formatAmount(Math.round(q * m.price * 100) / 100)}
                      </TableCell>
                      <TableCell className="pr-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar producto"
                          onClick={() =>
                            setRows((rs) => rs.filter((x) => x.key !== r.key))
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Aún no hay productos. Agrégalos con “+ Agregar producto”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {rows.some((r) => !byId.get(r.productId)?.metrics) && (
          <p className="m-0 text-sm text-muted-foreground">
            Un producto sin recetas o con una receta sin ingredientes no suma
            costos todavía.
          </p>
        )}

        {error && (
          <p className="m-0 text-center text-sm text-destructive">{error}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <>
                <Button
                  type="submit"
                  disabled={submitting}
                  onClick={() => setTarget('list')}
                >
                  Proyectar producción →
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setTarget('direct')}
                >
                  Ir directo a la lista de compra
                </Button>
              </>
            )}
          </form.Subscribe>
          {production && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Borrar producción
            </Button>
          )}
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar “{production?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra también su lista de compra. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
