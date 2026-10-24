import { Link, useNavigate, useRouter } from '@tanstack/react-router'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
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
import { formatSaved, quoteSchema, quoteSummary } from '#/lib/cost-quotes'
import { formatPrice, parseDecimal } from '#/lib/costs'
import { deleteQuote, saveQuote } from '#/lib/tool-quotes'
import type { getQuoteForm } from '#/lib/tool-quotes'

type Loaded = Awaited<ReturnType<typeof getQuoteForm>>
type Extra = { key: string; name: string; cost: number }

const hoursText = (value: number | undefined) => (value ? String(value) : '')
const hoursLabel = (value: number) => `${Math.round(value * 100) / 100} h`
const enteros = (n: number) => `${n} ${n === 1 ? 'entero' : 'enteros'}`

// Horas escritas por la persona: vacío es 0; algo que no es número, `null`.
const parseHours = (text: string) =>
  text.trim() === '' ? 0 : parseDecimal(text)

function Line({
  label,
  value,
  strong,
  last,
}: {
  label: string
  value: string
  strong?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-4 py-2.5 ${last ? '' : 'border-b'} ${strong ? 'font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function QuoteForm({ data }: { data: Loaded }) {
  const { quote, products, rate, saved } = data
  const navigate = useNavigate()
  const router = useRouter()
  const [productId, setProductId] = useState(
    quote?.productId ?? products.at(0)?.id ?? '',
  )
  const [quantity, setQuantity] = useState(String(quote?.quantity ?? 1))
  const [decor, setDecor] = useState(hoursText(quote?.decorHours))
  const [sourcing, setSourcing] = useState(hoursText(quote?.sourcingHours))
  const [extras, setExtras] = useState<Extra[]>(
    () => quote?.extras.map((e) => ({ key: newKey(), ...e })) ?? [],
  )
  const [extraName, setExtraName] = useState('')
  const [extraCost, setExtraCost] = useState('')
  const [extraError, setExtraError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const product = products.find((p) => p.id === productId)
  const parsedQuantity = parseDecimal(quantity)
  const validQuantity =
    parsedQuantity !== null &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1
  const decorHours = parseHours(decor)
  const sourcingHours = parseHours(sourcing)
  const q = validQuantity ? parsedQuantity : 0

  const summary = quoteSummary({
    unitCost: validQuantity ? (product?.cost ?? null) : null,
    quantity: q,
    decorHours: decorHours ?? 0,
    sourcingHours: sourcingHours ?? 0,
    rate,
    extras: extras.map((e) => e.cost),
  })

  function addExtra() {
    const cost = parseDecimal(extraCost)
    if (!extraName.trim()) return setExtraError('Escribe el extra.')
    if (!cost || cost <= 0) return setExtraError('Escribe el costo del extra.')
    setExtraError(null)
    setExtras((list) => [
      ...list,
      { key: newKey(), name: extraName.trim(), cost },
    ])
    setExtraName('')
    setExtraCost('')
  }

  async function save() {
    setMessage(null)
    if (!productId) return setError('Elige el producto.')
    if (!validQuantity) {
      return setError('Escribe cuántos enteros cotizas (un número entero).')
    }
    if (decorHours === null || sourcingHours === null) {
      return setError('Escribe las horas con números (por ejemplo 2.5).')
    }
    const values = {
      productId,
      quantity: q,
      decorHours,
      sourcingHours,
      extras: extras.map(({ name, cost }) => ({ name, cost })),
    }
    const check = quoteSchema.safeParse(values)
    if (!check.success) {
      return setError(check.error.issues[0]?.message ?? 'Revisa los datos.')
    }
    setError(null)
    setBusy(true)
    try {
      const result = await saveQuote({
        data: { id: quote?.id ?? null, values },
      })
      if (!result.id) {
        setBusy(false)
        return setError(result.error ?? 'No se pudo guardar.')
      }
      await router.invalidate()
      if (quote) {
        setMessage('Cotización guardada.')
        setBusy(false)
      } else {
        await navigate({
          to: '/herramienta/cotizador/$id',
          params: { id: result.id },
        })
      }
    } catch {
      setBusy(false)
      setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
    }
  }

  async function remove() {
    if (!quote) return
    setBusy(true)
    try {
      await deleteQuote({ data: { id: quote.id } })
      await router.invalidate()
      await navigate({ to: '/herramienta/cotizador' })
    } catch {
      setConfirmDelete(false)
      setBusy(false)
      setError('No se pudo borrar. Inténtalo de nuevo.')
    }
  }

  const total = (value: number | null) =>
    value === null ? '—' : formatPrice(value)

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="flex flex-col gap-6"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              Cotizador
            </h1>
            <Button type="submit" disabled={busy || products.length === 0}>
              Guardar cotización
            </Button>
          </div>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Para cotizar un pedido a partir de un producto que ya tienes. Te
            dice lo mínimo que puedes cobrar. Puedes guardar la cotización para
            consultarla o repetirla después.
          </p>
        </div>

        {error && <p className="m-0 text-sm text-destructive">{error}</p>}
        {message && <p className="m-0 text-sm text-success">{message}</p>}

        <div className="flex max-w-220 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Elige el producto</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {products.length === 0 ? (
                <p className="m-0 text-muted-foreground">
                  Aún no tienes productos.{' '}
                  <Link
                    to="/herramienta/productos/nuevo"
                    className="text-primary underline"
                  >
                    Crea el primero
                  </Link>{' '}
                  para cotizar.
                </p>
              ) : (
                <div className="flex flex-wrap items-start gap-4">
                  <Field className="w-80 max-w-full">
                    <FieldLabel>Producto</FieldLabel>
                    <Picker
                      aria-label="Producto"
                      items={products.map((p) => ({
                        id: p.id,
                        label: p.name,
                        hint: p.sells,
                      }))}
                      value={productId}
                      onChange={setProductId}
                      placeholder="Elige el producto"
                      searchPlaceholder="Buscar producto"
                    />
                  </Field>
                  <Field className="w-auto">
                    <FieldLabel htmlFor="cantidad">Cantidad</FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="cantidad"
                        inputMode="numeric"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>
                          {q === 1 ? 'entero' : 'enteros'}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </div>
              )}
              {product && (
                <div className="flex flex-wrap gap-6 tabular-nums">
                  <div>
                    <div className="text-13 text-muted-foreground">
                      Costo del producto
                    </div>
                    <div className="font-semibold">{total(product.cost)}</div>
                  </div>
                  <div>
                    <div className="text-13 text-muted-foreground">
                      Horas habituales de trabajo (ya incluidas)
                    </div>
                    <div className="font-semibold">
                      {product.laborHours === null
                        ? '—'
                        : hoursLabel(product.laborHours)}
                    </div>
                  </div>
                </div>
              )}
              {product && product.cost === null && (
                <p className="m-0 text-sm text-muted-foreground">
                  Este producto aún no tiene costo: le faltan recetas o una
                  receta no tiene ingredientes.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Horas extra de este pedido</CardTitle>
              <CardDescription className="leading-normal">
                Las horas habituales del producto no se tocan. Aquí solo sumas
                el tiempo extra: decorado, y también el que te toma conseguir
                los insumos extra, como ir a la tienda por el muñeco.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4">
                <Field className="w-auto">
                  <FieldLabel htmlFor="horas-decorado">
                    Horas extra de decorado
                  </FieldLabel>
                  <InputGroup className="w-32">
                    <InputGroupInput
                      id="horas-decorado"
                      inputMode="decimal"
                      placeholder="0"
                      value={decor}
                      onChange={(e) => setDecor(e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>h</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field className="w-auto">
                  <FieldLabel htmlFor="horas-insumos">
                    Horas extra para conseguir insumos
                  </FieldLabel>
                  <InputGroup className="w-32">
                    <InputGroupInput
                      id="horas-insumos"
                      inputMode="decimal"
                      placeholder="0"
                      value={sourcing}
                      onChange={(e) => setSourcing(e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>h</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
              <div className="text-13 text-muted-foreground">
                {rate === null ? (
                  <>
                    Para cobrar estas horas falta tu mano de obra en{' '}
                    <Link
                      to="/herramienta/ajustes"
                      className="text-primary underline"
                    >
                      Ajustes
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Se cobran a tu tarifa de mano de obra de Ajustes (
                    {formatPrice(rate)} por hora).
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Extras de este pedido</CardTitle>
              <CardDescription className="leading-normal">
                Cosas sueltas que lleva este pedido y no son parte del producto.
                No hace falta que existan como ingrediente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {extras.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-115 tabular-nums">
                    <TableBody>
                      {extras.map((e) => (
                        <TableRow key={e.key}>
                          <TableCell className="px-4 py-3 font-medium">
                            {e.name}
                          </TableCell>
                          <TableCell className="w-35 text-right">
                            {formatPrice(e.cost)}
                          </TableCell>
                          <TableCell className="w-24 pr-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExtras((list) =>
                                  list.filter((x) => x.key !== e.key),
                                )
                              }
                            >
                              Quitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <Field className="w-55 max-w-full">
                  <FieldLabel htmlFor="extra-nombre">Extra</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="extra-nombre"
                      maxLength={80}
                      value={extraName}
                      onChange={(e) => setExtraName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        addExtra()
                      }}
                    />
                  </InputGroup>
                </Field>
                <Field className="w-28">
                  <FieldLabel htmlFor="extra-costo">Costo</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="extra-costo"
                      inputMode="decimal"
                      value={extraCost}
                      onChange={(e) => setExtraCost(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        addExtra()
                      }}
                    />
                  </InputGroup>
                </Field>
                <Button type="button" onClick={addExtra}>
                  Agregar extra
                </Button>
              </div>
              {extraError && (
                <p className="m-0 text-sm text-destructive">{extraError}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menos de esto no puedes cobrar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div>
                <Line
                  label={`Costo del producto (${enteros(q)})`}
                  value={total(summary.product)}
                />
                <Line
                  label={`Horas extra (${hoursLabel(summary.hours)} × ${rate === null ? '—' : formatPrice(rate)})`}
                  value={total(summary.hoursCost)}
                />
                <Line
                  label={`Extras (${extras.length})`}
                  value={total(summary.extras)}
                />
                <Line
                  strong
                  last
                  label="Menos de esto no puedes cobrar"
                  value={total(summary.floor)}
                />
              </div>
              <p className="m-0 text-13 leading-normal text-muted-foreground">
                Es el piso: cubre tus costos y tu tiempo, sin ganancia. Tu
                precio normal sigue en el producto.
              </p>
            </CardContent>
          </Card>

          {quote && (
            <div>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Borrar cotización
              </Button>
            </div>
          )}
        </div>
      </form>

      {saved.length > 0 && (
        <Card className="max-w-220">
          <CardHeader>
            <CardTitle>Cotizaciones guardadas</CardTitle>
            <CardDescription>
              Se recalculan con los costos de hoy.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-115 tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Producto</TableHead>
                  <TableHead>Guardada</TableHead>
                  <TableHead className="pr-4 text-right">Mínimo hoy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saved.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="py-3 pl-4">
                      <Link
                        to="/herramienta/cotizador/$id"
                        params={{ id: s.id }}
                        className="font-medium"
                      >
                        {s.product} · {enteros(s.quantity)}
                      </Link>
                      {s.id === quote?.id && (
                        <Badge variant="outline" className="ml-2">
                          Abierta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatSaved(s.savedAt)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {total(s.floor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              No se puede deshacer. El producto no se modifica.
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
