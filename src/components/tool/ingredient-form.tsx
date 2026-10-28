import { useForm } from '@tanstack/react-form'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

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
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '#/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
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
  COST_UNITS,
  KINDS,
  UNITS,
  avgPieceGrams,
  costPerBase,
  formatQuantity,
  formatUnitCost,
  ingredientSchema,
  parseDecimal,
} from '#/lib/costs'
import type { CostKind, CostUnit } from '#/lib/costs'
import {
  createIngredient,
  setIngredientArchived,
  updateIngredient,
} from '#/lib/tool-ingredients'
import type { getIngredient } from '#/lib/tool-ingredients'
import type { getPlaces } from '#/lib/tool-places'
import { getIngredientUsage } from '#/lib/tool-recipes'

type Ingredient = Awaited<ReturnType<typeof getIngredient>>
type Place = Awaited<ReturnType<typeof getPlaces>>[number]

const NO_PLACE = 'none'
const UNIT_NAME = { g: 'gramo', ml: 'mililitro', pza: 'pieza' } as const

// Lo que se ve en el formulario son textos; se convierten a números al guardar.
type Values = {
  name: string
  kind: CostKind
  placeId: string
  price: string
  quantity: string
  unit: CostUnit
  flexible: boolean
  sampleCount: string
  sampleGrams: string
  wasteEnabled: boolean
  yieldPct: string
}

const plain = (n: number | null) => (n === null ? '' : String(n))

function initialValues(i?: Ingredient): Values {
  return {
    name: i?.name ?? '',
    kind: i?.kind ?? 'INGREDIENT',
    placeId: i?.placeId ?? NO_PLACE,
    price: i ? i.price.toFixed(2) : '',
    quantity: plain(i?.quantity ?? null),
    unit: i?.unit ?? 'G',
    flexible: i?.flexible ?? false,
    sampleCount: plain(i?.sampleCount ?? null),
    sampleGrams: plain(i?.sampleGrams ?? null),
    wasteEnabled: i?.wasteEnabled ?? false,
    yieldPct: plain(i?.yieldPct ?? null),
  }
}

// Campo opcional: vacío es null (el esquema dice qué falta); un texto ilegible llega como NaN y el
// esquema lo rechaza.
const optionalNumber = (text: string) =>
  text.trim() === '' ? null : (parseDecimal(text) ?? Number.NaN)

function toInput(v: Values) {
  return {
    name: v.name,
    kind: v.kind,
    placeId: v.placeId === NO_PLACE ? null : v.placeId,
    price: parseDecimal(v.price) ?? Number.NaN,
    quantity: parseDecimal(v.quantity) ?? Number.NaN,
    unit: v.unit,
    flexible: v.flexible,
    sampleCount: v.flexible ? optionalNumber(v.sampleCount) : null,
    sampleGrams: v.flexible ? optionalNumber(v.sampleGrams) : null,
    wasteEnabled: v.wasteEnabled,
    yieldPct: v.wasteEnabled ? optionalNumber(v.yieldPct) : null,
  }
}

// Mensajes del esquema por campo (el primero de cada uno).
function fieldErrors(values: Values) {
  const result = ingredientSchema.safeParse(toInput(values))
  if (result.success) return null
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0])
    const nan = issue.code === 'invalid_type'
    fields[key] ??= nan ? 'Escribe un número.' : issue.message
  }
  return fields
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5 tabular-nums">
      {children}
    </div>
  )
}

export function IngredientForm({
  ingredient,
  places,
}: {
  ingredient?: Ingredient
  places: Place[]
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [usage, setUsage] = useState({ recipes: 0, premixes: 0 })
  const [busy, setBusy] = useState(false)

  const form = useForm({
    defaultValues: initialValues(ingredient),
    validators: {
      onSubmit: ({ value }) => {
        const fields = fieldErrors(value)
        return fields ? { fields } : undefined
      },
    },
    onSubmit: async ({ value }) => {
      setError(null)
      const input = toInput(value)
      try {
        if (ingredient) {
          await updateIngredient({ data: { id: ingredient.id, values: input } })
        } else {
          const created = await createIngredient({ data: input })
          if (!created.id)
            return setError(created.error ?? 'No se pudo guardar.')
        }
        await router.invalidate()
        await navigate({ to: '/herramienta/ingredientes' })
      } catch {
        setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
      }
    },
  })

  // Antes de archivar se cuenta qué recetas y premezclas lo usan, para avisar.
  async function askArchive() {
    if (!ingredient) return
    try {
      setUsage(await getIngredientUsage({ data: { id: ingredient.id } }))
    } catch {
      setUsage({ recipes: 0, premixes: 0 })
    }
    setConfirmArchive(true)
  }

  async function archive(archived: boolean) {
    if (!ingredient) return
    setBusy(true)
    try {
      await setIngredientArchived({ data: { id: ingredient.id, archived } })
      await router.invalidate()
      await navigate({ to: '/herramienta/ingredientes' })
    } catch {
      setError('No se pudo completar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  const errorsOf = (meta: { errors: unknown[] }) =>
    meta.errors.map((e) => (typeof e === 'string' ? { message: e } : undefined))

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">
          {ingredient ? ingredient.name : 'Nuevo ingrediente'}
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          {ingredient
            ? 'Editar ingrediente. Los cambios se aplican a todas las recetas que lo usan.'
            : 'Agrega algo que compras: un ingrediente o un empaque.'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        className="flex max-w-220 flex-col gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-4">
              <form.Field name="name">
                {(f) => (
                  <Field
                    className="w-75 max-w-full"
                    data-invalid={f.state.meta.errors.length > 0}
                  >
                    <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
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
              <form.Field name="kind">
                {(f) => (
                  <Field className="w-55 max-w-full">
                    <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
                    <Select
                      value={f.state.value}
                      onValueChange={(v) => f.handleChange(v as CostKind)}
                    >
                      <SelectTrigger id="tipo" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(KINDS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              <form.Field name="placeId">
                {(f) => (
                  <Field className="w-50 max-w-full">
                    <FieldLabel htmlFor="lugar">Lugar de compra</FieldLabel>
                    <Select
                      value={f.state.value}
                      onValueChange={f.handleChange}
                    >
                      <SelectTrigger id="lugar" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PLACE}>
                          Sin lugar asignado
                        </SelectItem>
                        {places.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>
            <p className="text-sm text-muted-foreground">
              Marca si es un ingrediente o un empaque (domos, cajas, discos de
              cartón) para verlos por separado. El lugar se administra en{' '}
              <Link
                to="/herramienta/lugares"
                className="text-primary underline underline-offset-3"
              >
                Lugares de compra
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compra</CardTitle>
            <CardDescription>Lo que pagas y cuánto trae.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start gap-4">
            <form.Field name="price">
              {(f) => (
                <Field
                  className="w-45 max-w-full"
                  data-invalid={f.state.meta.errors.length > 0}
                >
                  <FieldLabel htmlFor="precio">Precio</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="precio"
                      inputMode="decimal"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      aria-invalid={f.state.meta.errors.length > 0}
                    />
                  </InputGroup>
                  <FieldError errors={errorsOf(f.state.meta)} />
                </Field>
              )}
            </form.Field>
            <form.Field name="quantity">
              {(f) => (
                <Field
                  className="w-50 max-w-full"
                  data-invalid={f.state.meta.errors.length > 0}
                >
                  <FieldLabel htmlFor="cantidad">
                    Cantidad que compras
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="cantidad"
                      inputMode="decimal"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      aria-invalid={f.state.meta.errors.length > 0}
                    />
                  </InputGroup>
                  <FieldError errors={errorsOf(f.state.meta)} />
                </Field>
              )}
            </form.Field>
            <form.Field name="unit">
              {(f) => (
                <Field className="w-28">
                  <FieldLabel htmlFor="unidad">Unidad</FieldLabel>
                  <Select
                    value={f.state.value}
                    onValueChange={(v) => {
                      f.handleChange(v as CostUnit)
                      // El uso flexible solo existe para lo que se compra por pieza.
                      if (v !== 'PZA') form.setFieldValue('flexible', false)
                    }}
                  >
                    <SelectTrigger id="unidad" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {UNITS[u].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Subscribe
              selector={(s) =>
                [s.values.price, s.values.quantity, s.values.unit] as const
              }
            >
              {([price, quantity, unit]) => {
                const p = parseDecimal(price)
                const q = parseDecimal(quantity)
                if (p === null || !q) return null
                const cost = costPerBase(p, q, unit)
                return (
                  <div className="mt-6.5 flex h-9 items-center rounded-lg bg-muted px-3 tabular-nums">
                    <span className="text-muted-foreground">
                      Te cuesta&nbsp;
                    </span>
                    <strong className="font-semibold">
                      {formatUnitCost(cost)} por {UNIT_NAME[UNITS[unit].base]}
                    </strong>
                  </div>
                )
              }}
            </form.Subscribe>
          </CardContent>
        </Card>

        <form.Subscribe
          selector={(s) =>
            [
              s.values.unit,
              s.values.flexible,
              s.values.price,
              s.values.quantity,
            ] as const
          }
        >
          {([unit, flexible]) =>
            unit === 'PZA' && (
              <Card>
                <CardHeader>
                  <CardTitle>Uso flexible</CardTitle>
                  <CardDescription>
                    Un mismo ingrediente que en las recetas puedes escribir en
                    piezas o en gramos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      id="flexible"
                      checked={flexible}
                      onCheckedChange={(v) => form.setFieldValue('flexible', v)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="flexible"
                      className="flex cursor-pointer flex-col gap-0.5"
                    >
                      <span className="font-medium">Activar uso flexible</span>
                      <span className="text-sm text-muted-foreground">
                        Útil para huevo, limón o cualquier cosa que compras por
                        pieza y en la receta conviene pesar. Si no lo activas,
                        solo se usa en la unidad con la que lo compras. El peso
                        de cada pieza es el del huevo sin cascarón: rómpelos y
                        pésalos en tara.
                      </span>
                    </label>
                  </div>
                  {flexible && (
                    <>
                      <div className="flex flex-wrap items-start gap-4">
                        <form.Field name="sampleCount">
                          {(f) => (
                            <Field
                              className="w-45 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="piezas">
                                Piezas que pesé
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="piezas"
                                  inputMode="numeric"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>pza</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                        <form.Field name="sampleGrams">
                          {(f) => (
                            <Field
                              className="w-50 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="gramos">
                                Pesaron en total
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="gramos"
                                  inputMode="decimal"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>g</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                      </div>
                      <form.Subscribe
                        selector={(s) =>
                          [
                            s.values.sampleCount,
                            s.values.sampleGrams,
                            s.values.price,
                            s.values.quantity,
                          ] as const
                        }
                      >
                        {([count, grams, price, quantity]) => {
                          const c = parseDecimal(count)
                          const g = parseDecimal(grams)
                          const p = parseDecimal(price)
                          const q = parseDecimal(quantity)
                          if (!c || !g || p === null || !q) return null
                          const avg = avgPieceGrams(g, c)
                          return (
                            <Summary>
                              <span className="text-muted-foreground">
                                Peso promedio
                              </span>{' '}
                              <strong className="font-semibold">
                                {formatQuantity(Math.round(avg))} g por pieza
                              </strong>{' '}
                              ·{' '}
                              <span className="text-muted-foreground">
                                Cuesta
                              </span>{' '}
                              <strong className="font-semibold">
                                {formatUnitCost(costPerBase(p, q, 'PZA') / avg)}{' '}
                                por gramo
                              </strong>
                              <div className="mt-0.5 text-sm text-muted-foreground">
                                Al registrar una compra puedes volver a pesar
                                para actualizar el promedio.
                              </div>
                            </Summary>
                          )
                        }}
                      </form.Subscribe>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }
        </form.Subscribe>

        <Card>
          <CardHeader>
            <CardTitle>Desperdicio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form.Subscribe selector={(s) => s.values.wasteEnabled}>
              {(enabled) => (
                <>
                  <div className="flex items-start gap-3">
                    <Switch
                      id="merma"
                      checked={enabled}
                      onCheckedChange={(v) =>
                        form.setFieldValue('wasteEnabled', v)
                      }
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="merma"
                      className="flex cursor-pointer flex-col gap-0.5"
                    >
                      <span className="font-medium">Tiene desperdicio</span>
                      <span className="text-sm text-muted-foreground">
                        Actívalo si algo se tira al prepararlo (cáscaras,
                        huesos, hojas) y escribe cuánto aprovechas. Si pesaste
                        el huevo con cáscara, aquí va ese porcentaje.
                      </span>
                    </label>
                  </div>
                  {enabled && (
                    <form.Field name="yieldPct">
                      {(f) => (
                        <Field
                          className="w-45 max-w-full"
                          data-invalid={f.state.meta.errors.length > 0}
                        >
                          <FieldLabel htmlFor="aprovecho">
                            Porcentaje que aprovechas
                          </FieldLabel>
                          <InputGroup>
                            <InputGroupInput
                              id="aprovecho"
                              inputMode="numeric"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              aria-invalid={f.state.meta.errors.length > 0}
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupText>%</InputGroupText>
                            </InputGroupAddon>
                          </InputGroup>
                          <FieldDescription>De 1 a 99.</FieldDescription>
                          <FieldError errors={errorsOf(f.state.meta)} />
                        </Field>
                      )}
                    </form.Field>
                  )}
                </>
              )}
            </form.Subscribe>
          </CardContent>
        </Card>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/herramienta/ingredientes">Cancelar</Link>
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                {ingredient ? 'Guardar cambios' : 'Guardar ingrediente'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>

      {ingredient && (
        <Card className="max-w-220">
          <CardHeader>
            <CardTitle>
              {ingredient.archived
                ? 'Restaurar ingrediente'
                : 'Archivar ingrediente'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              {ingredient.archived
                ? 'Está archivado: no sale al elegir ingredientes en recetas nuevas. Si lo restauras vuelve a la lista.'
                : 'Si lo archivas, las recetas que ya lo usan siguen funcionando, pero ya no podrás elegirlo en recetas nuevas. Si alguna lo usa, te avisamos antes.'}
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  ingredient.archived ? void archive(false) : void askArchive()
                }
              >
                {ingredient.archived
                  ? 'Restaurar ingrediente'
                  : 'Archivar ingrediente'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar “{ingredient?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usage.recipes + usage.premixes > 0
                ? `Lo usan ${[
                    usage.recipes > 0
                      ? `${usage.recipes} ${usage.recipes === 1 ? 'receta' : 'recetas'}`
                      : '',
                    usage.premixes > 0
                      ? `${usage.premixes} ${usage.premixes === 1 ? 'premezcla' : 'premezclas'}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(
                      ' y ',
                    )}: siguen funcionando, pero ya no podrás elegirlo en nuevas. Puedes restaurarlo cuando quieras.`
                : 'Dejará de salir en la lista y no podrás elegirlo en recetas nuevas. Ninguna receta lo usa y puedes restaurarlo cuando quieras.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void archive(true)}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
