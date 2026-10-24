import { useForm } from '@tanstack/react-form'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useState } from 'react'

import {
  LinesEditor,
  lineProblems,
  lineResult,
  newKey,
} from '#/components/tool/lines-editor'
import type {
  IngredientOption,
  Line,
  PremixOption,
} from '#/components/tool/lines-editor'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { Switch } from '#/components/ui/switch'
import { recipeBreakdown } from '#/lib/cost-engine'
import { recipeSchema } from '#/lib/cost-recipes'
import { formatPrice, parseDecimal } from '#/lib/costs'
import { getRecipeUsage } from '#/lib/tool-products'
import { saveRecipe, setRecipeArchived } from '#/lib/tool-recipes'
import type { getRecipeForm } from '#/lib/tool-recipes'
import { cn } from '#/lib/utils'

type Loaded = Awaited<ReturnType<typeof getRecipeForm>>

// Vacío es "sin escribir" (null); un texto ilegible llega como NaN y el esquema lo rechaza.
const optionalNumber = (t: string) =>
  t.trim() === '' ? null : (parseDecimal(t) ?? Number.NaN)
const text = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n)

type Values = {
  name: string
  tagName: string
  yieldPieces: string
  laborHours: string
  ovenHours: string
  includeLabor: boolean
  includeFixed: boolean
  includeWaste: boolean
  wastePct: string
}

export function RecipeForm({ data }: { data: Loaded }) {
  const { recipe, ingredients, premixes, rates, tags } = data
  const navigate = useNavigate()
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>(
    () =>
      recipe?.lines.map((l) => ({
        key: newKey(),
        kind: l.kind,
        refId: l.refId,
        quantity: String(l.quantity),
        unit: l.unit,
      })) ?? [],
  )
  const [badLines, setBadLines] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [usedBy, setUsedBy] = useState(0)
  const [busy, setBusy] = useState(false)

  const ingById = new Map<string, IngredientOption>(
    ingredients.map((i) => [i.id, i]),
  )
  const premixById = new Map<string, PremixOption>(
    premixes.map((p) => [p.id, p]),
  )

  function toValues(v: Values) {
    return {
      name: v.name,
      tagName: v.tagName,
      yieldPieces: optionalNumber(v.yieldPieces),
      laborHours: optionalNumber(v.laborHours),
      ovenHours: optionalNumber(v.ovenHours),
      includeLabor: v.includeLabor,
      includeFixed: v.includeFixed,
      includeWaste: v.includeWaste,
      wastePct: v.includeWaste ? optionalNumber(v.wastePct) : null,
      lines: lines.map((l) => ({
        kind: l.kind,
        refId: l.refId,
        quantity: parseDecimal(l.quantity) ?? Number.NaN,
        unit: l.unit,
      })),
    }
  }

  const form = useForm({
    defaultValues: {
      name: recipe?.name ?? '',
      tagName: recipe?.tagName ?? '',
      yieldPieces: text(recipe?.yieldPieces),
      laborHours: text(recipe?.laborHours),
      ovenHours: text(recipe?.ovenHours),
      includeLabor: recipe?.includeLabor ?? true,
      includeFixed: recipe?.includeFixed ?? true,
      includeWaste: recipe?.includeWaste ?? true,
      // En una receta nueva arranca con la merma por defecto de Ajustes.
      wastePct: recipe ? text(recipe.wastePct) : text(rates.defaultWastePct),
    } satisfies Values,
    validators: {
      onSubmit: ({ value }) => {
        const bad = lineProblems(lines)
        setBadLines(bad)
        const fields: Record<string, string> = {}
        const result = recipeSchema.safeParse(toValues(value))
        if (!result.success) {
          for (const issue of result.error.issues) {
            const key = String(issue.path[0])
            if (key === 'lines') continue
            fields[key] ??=
              issue.code === 'invalid_type'
                ? 'Escribe un número.'
                : issue.message
          }
        }
        return Object.keys(fields).length > 0 ? { fields } : undefined
      },
    },
    onSubmit: async ({ value }) => {
      // Un renglón sin elegir o sin cantidad no deja guardar (se marca en rojo).
      const bad = lineProblems(lines)
      setBadLines(bad)
      if (bad.size > 0) {
        setError('Elige qué es y escribe la cantidad en cada renglón.')
        return
      }
      setError(null)
      try {
        const result = await saveRecipe({
          data: { id: recipe?.id ?? null, values: toValues(value) },
        })
        if (!result.id) return setError(result.error ?? 'No se pudo guardar.')
        await router.invalidate()
        await navigate({ to: '/herramienta/recetas' })
      } catch {
        setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
      }
    },
  })

  // Antes de archivar se cuenta cuántos productos la usan, para avisar.
  async function askArchive() {
    if (!recipe) return
    try {
      setUsedBy((await getRecipeUsage({ data: { id: recipe.id } })).products)
    } catch {
      setUsedBy(0)
    }
    setConfirmArchive(true)
  }

  async function archive(archived: boolean) {
    if (!recipe) return
    setBusy(true)
    try {
      await setRecipeArchived({ data: { id: recipe.id, archived } })
      await router.invalidate()
      await navigate({ to: '/herramienta/recetas' })
    } catch {
      setError('No se pudo completar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  const errorsOf = (meta: { errors: unknown[] }) =>
    meta.errors.map((e) => (typeof e === 'string' ? { message: e } : undefined))

  // Cuánto cuestan los ingredientes y premezclas de la receta con lo que hay escrito.
  const ingredientsCost = lines.reduce(
    (sum, l) => sum + (lineResult(l, ingById, premixById).cost ?? 0),
    0,
  )

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              {recipe ? recipe.name : 'Nueva receta'}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Receta: lo que lleva y cuánto cuesta hacer una pieza completa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/herramienta/recetas">Cancelar</Link>
            </Button>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={submitting}>
                  Guardar
                </Button>
              )}
            </form.Subscribe>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-1 basis-140 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la receta</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-4">
                  <form.Field name="name">
                    {(f) => (
                      <Field
                        className="w-70 max-w-full"
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
                  <form.Field name="tagName">
                    {(f) => (
                      <Field
                        className="w-55 max-w-full"
                        data-invalid={f.state.meta.errors.length > 0}
                      >
                        <FieldLabel htmlFor="etiqueta">Etiqueta</FieldLabel>
                        <Input
                          id="etiqueta"
                          list="etiquetas-sugeridas"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          placeholder="Escribe o elige una etiqueta"
                          autoComplete="off"
                          maxLength={40}
                        />
                        <datalist id="etiquetas-sugeridas">
                          {tags.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                        <FieldError errors={errorsOf(f.state.meta)} />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="yieldPieces">
                    {(f) => (
                      <Field
                        className="w-40 max-w-full"
                        data-invalid={f.state.meta.errors.length > 0}
                      >
                        <FieldLabel htmlFor="rinde">Rinde</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="rinde"
                            inputMode="numeric"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            aria-invalid={f.state.meta.errors.length > 0}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>piezas</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldError errors={errorsOf(f.state.meta)} />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <p className="m-0 text-sm text-muted-foreground">
                  La etiqueta solo sirve para filtrar tus recetas: al escribirla
                  te sugerimos las que ya tienes. El rendimiento siempre va en
                  piezas.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ingredientes</CardTitle>
                <CardDescription>
                  Cantidad por una receta completa.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <LinesEditor
                  lines={lines}
                  onChange={setLines}
                  ingredients={ingredients}
                  premixes={premixes}
                  invalid={badLines}
                />
                <div className="flex justify-between rounded-lg bg-muted px-4 py-3 font-semibold tabular-nums">
                  <span>Ingredientes</span>
                  <span>{formatPrice(ingredientsCost)}</span>
                </div>
                <Alert>
                  <Info />
                  <AlertTitle>
                    Gramos o piezas, es el mismo ingrediente
                  </AlertTitle>
                  <AlertDescription>
                    En ingredientes como el huevo puedes escribir gramos o
                    piezas (si activaste su uso flexible). Para que la receta
                    salga igual cada vez, conviene usar gramos.
                  </AlertDescription>
                </Alert>
                {error && (
                  <p className="m-0 text-sm text-destructive">{error}</p>
                )}
              </CardContent>
            </Card>

            <form.Subscribe selector={(s) => s.values}>
              {(values) => {
                const labor = parseDecimal(values.laborHours)
                const oven = parseDecimal(values.ovenHours)
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Tiempo</CardTitle>
                      <CardDescription>
                        Dos horas distintas: lo que trabajas tú y lo que gasta
                        tu cocina.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <form.Field name="laborHours">
                          {(f) => (
                            <Field
                              className="w-45 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="horas-trabajo">
                                Horas de trabajo
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="horas-trabajo"
                                  inputMode="decimal"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>h</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                        {labor && rates.laborPerHour !== null && (
                          <span className="mt-7 tabular-nums">
                            {labor} h × {formatPrice(rates.laborPerHour)} ={' '}
                            <strong className="font-semibold">
                              {formatPrice(labor * rates.laborPerHour)}
                            </strong>{' '}
                            de mano de obra
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-start gap-4">
                        <form.Field name="ovenHours">
                          {(f) => (
                            <Field
                              className="w-45 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="horas-horno">
                                Horas de horno y cocina
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="horas-horno"
                                  inputMode="decimal"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>h</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                        {oven && rates.fixedPerHour !== null && (
                          <span className="mt-7 tabular-nums">
                            {oven} h × {formatPrice(rates.fixedPerHour)} ={' '}
                            <strong className="font-semibold">
                              {formatPrice(oven * rates.fixedPerHour)}
                            </strong>{' '}
                            de gasto fijo
                          </span>
                        )}
                      </div>
                      <p className="m-0 text-sm text-muted-foreground">
                        Los valores por hora se definen una vez en{' '}
                        <Link
                          to="/herramienta/ajustes"
                          className="text-primary underline underline-offset-3"
                        >
                          Ajustes de costos
                        </Link>
                        .
                      </p>
                    </CardContent>
                  </Card>
                )
              }}
            </form.Subscribe>

            <Card>
              <CardHeader>
                <CardTitle>Qué sumar al costo</CardTitle>
                <CardDescription>
                  Todo es opcional. Apaga lo que no quieras contar en esta
                  receta.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {(
                  [
                    ['includeLabor', 'Mano de obra', 'Tu trabajo, por hora.'],
                    [
                      'includeFixed',
                      'Gasto fijo',
                      'Luz, gas, renta y desgaste del equipo, por hora.',
                    ],
                    [
                      'includeWaste',
                      'Merma de la receta',
                      'Lo que se pierde al hornear, cortar o decorar.',
                    ],
                  ] as const
                ).map(([name, title, help]) => (
                  <form.Field key={name} name={name}>
                    {(f) => (
                      <div className="flex items-start gap-3">
                        <Switch
                          id={name}
                          checked={f.state.value}
                          onCheckedChange={f.handleChange}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={name}
                          className="flex cursor-pointer flex-col gap-0.5"
                        >
                          <span className="font-medium">{title}</span>
                          <span className="text-sm text-muted-foreground">
                            {help}
                          </span>
                        </label>
                      </div>
                    )}
                  </form.Field>
                ))}
                <form.Subscribe selector={(s) => s.values.includeWaste}>
                  {(on) =>
                    on && (
                      <form.Field name="wastePct">
                        {(f) => (
                          <Field
                            className="w-45 max-w-full"
                            data-invalid={f.state.meta.errors.length > 0}
                          >
                            <FieldLabel htmlFor="merma">
                              Porcentaje de merma
                            </FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                id="merma"
                                inputMode="decimal"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                aria-invalid={f.state.meta.errors.length > 0}
                              />
                              <InputGroupAddon align="inline-end">
                                <InputGroupText>%</InputGroupText>
                              </InputGroupAddon>
                            </InputGroup>
                            <FieldError errors={errorsOf(f.state.meta)} />
                          </Field>
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
              </CardContent>
            </Card>
          </div>

          <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80">
            <form.Subscribe selector={(s) => s.values}>
              {(values) => {
                const yieldPieces = parseDecimal(values.yieldPieces)
                const b = recipeBreakdown({
                  ingredients: ingredientsCost,
                  includeWaste: values.includeWaste,
                  wastePct: parseDecimal(values.wastePct),
                  includeLabor: values.includeLabor,
                  laborHours: parseDecimal(values.laborHours),
                  laborPerHour: rates.laborPerHour,
                  includeFixed: values.includeFixed,
                  ovenHours: parseDecimal(values.ovenHours),
                  fixedPerHour: rates.fixedPerHour,
                  yieldPieces,
                })
                const row = (
                  label: string,
                  value: number | null,
                  show = true,
                ) =>
                  show && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span>{value === null ? '—' : formatPrice(value)}</span>
                    </div>
                  )
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Costo de la receta</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 tabular-nums">
                      {row('Ingredientes', b.ingredients)}
                      {row(
                        `Merma ${values.wastePct || 0}%`,
                        b.waste,
                        values.includeWaste,
                      )}
                      {row(
                        `Mano de obra · ${values.laborHours || 0} h`,
                        b.labor,
                        values.includeLabor,
                      )}
                      {row(
                        `Gasto fijo · ${values.ovenHours || 0} h`,
                        b.fixed,
                        values.includeFixed,
                      )}
                      <div className="border-t" />
                      <div className="flex justify-between text-lg font-semibold">
                        <span>
                          {yieldPieces
                            ? `Cuesta hacer ${yieldPieces} ${yieldPieces === 1 ? 'pieza' : 'piezas'}`
                            : 'Cuesta hacer la receta'}
                        </span>
                        <span>{formatPrice(b.total)}</span>
                      </div>
                      {b.perPiece !== null && yieldPieces !== 1 && (
                        <div className={cn('flex justify-between')}>
                          <span className="text-muted-foreground">
                            Por pieza
                          </span>
                          <span className="font-medium">
                            {formatPrice(b.perPiece)}
                          </span>
                        </div>
                      )}
                      {b.missingSettings && (
                        <Alert>
                          <Info />
                          <AlertTitle>Faltan tus ajustes</AlertTitle>
                          <AlertDescription>
                            Llena tus{' '}
                            <Link
                              to="/herramienta/ajustes"
                              className="text-primary underline underline-offset-3"
                            >
                              Ajustes de costos
                            </Link>{' '}
                            para sumar la mano de obra y el gasto fijo.
                          </AlertDescription>
                        </Alert>
                      )}
                      <p className="m-0 text-sm text-muted-foreground">
                        Aquí no hay precio ni empaque. Eso se define en el
                        producto.
                      </p>
                      <Link
                        to="/herramienta/productos"
                        className="text-sm text-primary underline underline-offset-3"
                      >
                        Fijar el precio en el producto →
                      </Link>
                    </CardContent>
                  </Card>
                )
              }}
            </form.Subscribe>
          </aside>
        </div>
      </form>

      {recipe && (
        <Card className="max-w-220">
          <CardHeader>
            <CardTitle>
              {recipe.archived ? 'Restaurar receta' : 'Archivar receta'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="m-0 text-muted-foreground">
              {recipe.archived
                ? 'Está archivada: no sale en las listas ni en productos nuevos. Si la restauras vuelve a la lista.'
                : 'Si la archivas, deja de aparecer en listas y en productos nuevos. Los productos y producciones que ya la usan siguen funcionando. Antes de archivar te avisamos cuántos la usan.'}
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  recipe.archived ? void archive(false) : void askArchive()
                }
              >
                {recipe.archived ? 'Restaurar receta' : 'Archivar receta'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar “{recipe?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usedBy > 0
                ? `La usan ${usedBy} ${usedBy === 1 ? 'producto' : 'productos'}: siguen funcionando, pero ya no podrás elegirla en productos nuevos. Puedes restaurarla cuando quieras.`
                : 'Dejará de salir en la lista y en productos nuevos. Ningún producto la usa y puedes restaurarla cuando quieras.'}
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
