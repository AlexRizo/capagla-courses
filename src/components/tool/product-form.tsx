import { useForm } from '@tanstack/react-form'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CircleX,
  Trash2,
} from 'lucide-react'
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
import {
  VERDICT_LABEL,
  productSchema,
  productSummary,
  verdictText,
} from '#/lib/cost-product'
import type { Margin, Verdict } from '#/lib/cost-product'
import { formatAmount, formatPrice, parseDecimal } from '#/lib/costs'
import { saveProduct, setProductArchived } from '#/lib/tool-products'
import type { getProductForm } from '#/lib/tool-products'
import { cn } from '#/lib/utils'

type Loaded = Awaited<ReturnType<typeof getProductForm>>

const optionalNumber = (t: string) =>
  t.trim() === '' ? null : (parseDecimal(t) ?? Number.NaN)
const text = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n)

type RecipeRow = { key: string; recipeId: string; piecesSold: string }

const TONE: Record<Verdict, { box: string; icon: typeof CircleCheck }> = {
  LOSS: { box: 'border-danger/30 bg-danger-soft text-danger', icon: CircleX },
  LOW: {
    box: 'border-warning/30 bg-warning-soft text-warning',
    icon: CircleAlert,
  },
  GOOD: {
    box: 'border-success/30 bg-success-soft text-success',
    icon: CircleCheck,
  },
  COVERED: { box: 'bg-muted text-foreground', icon: CircleMinus },
  NONE: { box: 'bg-muted text-muted-foreground', icon: CircleMinus },
}

// "Ganas $96.44 · 18.5%" o "Pierdes $12.51 · −3.3%".
export function marginText(m: Margin) {
  const loss = m.gain < 0
  const pct = Math.abs(m.gainPct).toFixed(1)
  return `${loss ? 'Pierdes' : 'Ganas'} ${formatPrice(Math.abs(m.gain))} · ${loss ? '−' : ''}${pct}%`
}

function VerdictBox({
  verdict,
  multiplier,
  ratio,
}: {
  verdict: Verdict
  multiplier: number | null
  ratio: number | null
}) {
  const tone = TONE[verdict]
  const Icon = tone.icon
  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-lg border p-3', tone.box)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <div className="font-medium">{VERDICT_LABEL[verdict]}</div>
        <div className="text-sm opacity-90">
          {verdictText(verdict, { multiplier, ratio })}
        </div>
      </div>
    </div>
  )
}

const row = (label: string, value: string, strong = false) => (
  <div className={cn('flex justify-between gap-3', strong && 'font-semibold')}>
    <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
    <span className="shrink-0">{value}</span>
  </div>
)

export function ProductForm({ data }: { data: Loaded }) {
  const { product, recipes, packaging, settings } = data
  const navigate = useNavigate()
  const router = useRouter()

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(
    () =>
      product?.recipes.map((r) => ({
        key: newKey(),
        recipeId: r.recipeId,
        piecesSold: String(r.piecesSold),
      })) ?? [],
  )
  const toLines = (scope: 'WHOLE' | 'SLICE'): Line[] =>
    product?.packaging
      .filter((p) => p.scope === scope)
      .map((p) => ({
        key: newKey(),
        kind: 'ingredient' as const,
        refId: p.ingredientId,
        quantity: String(p.quantity),
        unit: p.unit,
      })) ?? []
  const [wholeLines, setWholeLines] = useState<Line[]>(() => toLines('WHOLE'))
  const [sliceLines, setSliceLines] = useState<Line[]>(() => toLines('SLICE'))
  const [badLines, setBadLines] = useState<Set<string>>(new Set())
  const [badRecipes, setBadRecipes] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)

  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const packagingById = new Map<string, IngredientOption>(
    packaging.map((i) => [i.id, i]),
  )
  const noPremixes = new Map<string, PremixOption>()

  const lineCost = (lines: Line[]) =>
    lines.reduce(
      (sum, l) => sum + (lineResult(l, packagingById, noPremixes).cost ?? 0),
      0,
    )

  function toValues(v: {
    name: string
    price: string
    sellsSlices: boolean
    slicesPerPiece: string
    slicePrice: string
    withTax: boolean
    multiplier: string
  }) {
    const pack = (lines: Line[], scope: 'WHOLE' | 'SLICE') =>
      lines.map((l) => ({
        scope,
        ingredientId: l.refId,
        quantity: parseDecimal(l.quantity) ?? Number.NaN,
        unit: l.unit,
      }))
    return {
      name: v.name,
      price: optionalNumber(v.price),
      sellsSlices: v.sellsSlices,
      slicesPerPiece: optionalNumber(v.slicesPerPiece),
      slicePrice: optionalNumber(v.slicePrice),
      withTax: v.withTax,
      multiplier: optionalNumber(v.multiplier),
      recipes: recipeRows.map((r) => ({
        recipeId: r.recipeId,
        piecesSold: parseDecimal(r.piecesSold) ?? Number.NaN,
      })),
      packaging: [...pack(wholeLines, 'WHOLE'), ...pack(sliceLines, 'SLICE')],
    }
  }

  const problems = (v: { sellsSlices: boolean }) => {
    const badPack = new Set([
      ...lineProblems(wholeLines),
      ...(v.sellsSlices ? lineProblems(sliceLines) : []),
    ])
    const badRec = new Set(
      recipeRows
        .filter((r) => {
          const n = parseDecimal(r.piecesSold)
          return !r.recipeId || !n || !Number.isInteger(n) || n < 1
        })
        .map((r) => r.key),
    )
    return { badPack, badRec }
  }

  const form = useForm({
    defaultValues: {
      name: product?.name ?? '',
      price: text(product?.price),
      sellsSlices: product?.sellsSlices ?? false,
      slicesPerPiece: text(product?.slicesPerPiece),
      slicePrice: text(product?.slicePrice),
      withTax: product?.withTax ?? settings.sellsAsBusiness,
      multiplier: text(settings.multiplier),
    },
    validators: {
      onSubmit: ({ value }) => {
        const { badPack, badRec } = problems(value)
        setBadLines(badPack)
        setBadRecipes(badRec)
        const fields: Record<string, string> = {}
        const result = productSchema.safeParse(toValues(value))
        if (!result.success) {
          for (const issue of result.error.issues) {
            const key = String(issue.path[0])
            if (key === 'recipes' || key === 'packaging') continue
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
      const { badPack, badRec } = problems(value)
      setBadLines(badPack)
      setBadRecipes(badRec)
      if (badRec.size > 0) {
        setError('Elige la receta y cuántas piezas vendes en cada renglón.')
        return
      }
      if (badPack.size > 0) {
        setError('Elige el empaque y escribe la cantidad en cada renglón.')
        return
      }
      setError(null)
      try {
        const result = await saveProduct({
          data: { id: product?.id ?? null, values: toValues(value) },
        })
        if (!result.id) return setError(result.error ?? 'No se pudo guardar.')
        await router.invalidate()
        await navigate({ to: '/herramienta/productos' })
      } catch {
        setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
      }
    },
  })

  async function archive(archived: boolean) {
    if (!product) return
    setBusy(true)
    try {
      await setProductArchived({ data: { id: product.id, archived } })
      await router.invalidate()
      await navigate({ to: '/herramienta/productos' })
    } catch {
      setError('No se pudo completar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  const errorsOf = (meta: { errors: unknown[] }) =>
    meta.errors.map((e) => (typeof e === 'string' ? { message: e } : undefined))

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
              {product ? product.name : 'Nuevo producto'}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Producto: lo que vendes. Junta recetas y empaque, y fija el
              precio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/herramienta/productos">Cancelar</Link>
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
          <div className="flex min-w-0 flex-1 basis-130 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Datos del producto</CardTitle>
              </CardHeader>
              <CardContent>
                <form.Field name="name">
                  {(f) => (
                    <Field
                      className="w-90 max-w-full"
                      data-invalid={f.state.meta.errors.length > 0}
                    >
                      <FieldLabel htmlFor="nombre">
                        Nombre del producto
                      </FieldLabel>
                      <Input
                        id="nombre"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        placeholder="Ejemplo: Pastel de zanahoria"
                        maxLength={80}
                        aria-invalid={f.state.meta.errors.length > 0}
                      />
                      <FieldError errors={errorsOf(f.state.meta)} />
                    </Field>
                  )}
                </form.Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recetas</CardTitle>
                <CardDescription>
                  Lo que lleva el producto. Puedes juntar varias: por ejemplo un
                  pastel y un relleno.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {recipeRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    Aún no hay recetas. Agrega la primera; te preguntaremos
                    cuántas piezas te salieron para vender.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-[1fr_9rem_6rem_2.5rem] items-center gap-3 px-1 text-sm font-medium text-muted-foreground">
                      <span>Receta</span>
                      <span>Piezas que vendes</span>
                      <span className="text-right">Costo</span>
                      <span />
                    </div>
                    {recipeRows.map((r) => {
                      const recipe = recipeById.get(r.recipeId)
                      const bad = badRecipes.has(r.key)
                      return (
                        <div key={r.key} className="flex flex-col gap-1">
                          <div className="grid grid-cols-[1fr_9rem_6rem_2.5rem] items-start gap-3">
                            <div className="flex flex-col gap-1">
                              <Picker
                                aria-label="Receta"
                                items={recipes
                                  .filter(
                                    (x) => !x.archived || x.id === r.recipeId,
                                  )
                                  .map((x) => ({
                                    id: x.id,
                                    label: x.name,
                                    hint: x.tag ?? undefined,
                                  }))}
                                value={r.recipeId}
                                onChange={(id) =>
                                  setRecipeRows((rows) =>
                                    rows.map((x) =>
                                      x.key === r.key
                                        ? {
                                            ...x,
                                            recipeId: id,
                                            // Por defecto vende todas las que rinde.
                                            piecesSold: String(
                                              recipeById.get(id)?.yieldPieces ??
                                                1,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                placeholder="Elige una receta"
                                searchPlaceholder="Buscar receta"
                                invalid={bad && !r.recipeId}
                              />
                              {recipe && (
                                <span className="text-xs text-muted-foreground">
                                  {recipe.yieldPieces
                                    ? `Rinde ${recipe.yieldPieces} ${recipe.yieldPieces === 1 ? 'pieza' : 'piezas'}`
                                    : 'Aún no dice cuántas piezas rinde'}
                                </span>
                              )}
                            </div>
                            <InputGroup>
                              <InputGroupInput
                                aria-label="Piezas que vendes"
                                inputMode="numeric"
                                value={r.piecesSold}
                                onChange={(e) =>
                                  setRecipeRows((rows) =>
                                    rows.map((x) =>
                                      x.key === r.key
                                        ? { ...x, piecesSold: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                aria-invalid={bad}
                              />
                              {recipe?.yieldPieces && (
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>
                                    de {recipe.yieldPieces}
                                  </InputGroupText>
                                </InputGroupAddon>
                              )}
                            </InputGroup>
                            <span className="flex h-9 items-center justify-end tabular-nums">
                              {recipe?.total == null
                                ? '—'
                                : formatPrice(recipe.total)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Quitar receta"
                              onClick={() =>
                                setRecipeRows((rows) =>
                                  rows.filter((x) => x.key !== r.key),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          {recipe?.yieldPieces &&
                          recipe.total !== null &&
                          parseDecimal(r.piecesSold) ? (
                            <p className="m-0 text-sm text-muted-foreground">
                              {recipe.name} rinde {recipe.yieldPieces}{' '}
                              {recipe.yieldPieces === 1 ? 'pieza' : 'piezas'}.
                              ¿Cuántas te salieron para vender? Lo preguntamos
                              porque, si salen menos, cada pieza te cuesta más (
                              {formatPrice(
                                recipe.total /
                                  (parseDecimal(r.piecesSold) ?? 1),
                              )}{' '}
                              por pieza vendible).
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setRecipeRows((rows) => [
                        ...rows,
                        { key: newKey(), recipeId: '', piecesSold: '' },
                      ])
                    }
                  >
                    + Agregar receta
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Empaque del entero</CardTitle>
                <CardDescription>
                  Lo que usas para hornear, transportar y entregar la pieza
                  completa, aunque la clienta no se lo quede.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <LinesEditor
                  lines={wholeLines}
                  onChange={setWholeLines}
                  ingredients={packaging}
                  invalid={badLines}
                  labels={{
                    column: 'Empaque',
                    add: '+ Agregar empaque',
                    placeholder: 'Elige un empaque',
                    search: 'Buscar empaque',
                    empty: 'Sin empaque todavía.',
                  }}
                />
                {wholeLines.length > 0 &&
                  row('Total empaque', formatPrice(lineCost(wholeLines)), true)}
                {packaging.length === 0 && (
                  <p className="m-0 text-sm text-muted-foreground">
                    Aún no tienes empaques. Créalos en{' '}
                    <Link
                      to="/herramienta/ingredientes/nuevo"
                      className="text-primary underline underline-offset-3"
                    >
                      Ingredientes
                    </Link>{' '}
                    con el tipo “Empaque”.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Venta por rebanada</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form.Subscribe selector={(s) => s.values.sellsSlices}>
                  {(on) => (
                    <>
                      <div className="flex items-start gap-3">
                        <Switch
                          id="rebanadas"
                          checked={on}
                          onCheckedChange={(v) =>
                            form.setFieldValue('sellsSlices', v)
                          }
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="rebanadas"
                          className="flex cursor-pointer flex-col gap-0.5"
                        >
                          <span className="font-medium">
                            También se vende por rebanadas
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {on
                              ? 'Todo el costo se reparte entre las rebanadas, y cada una lleva su propio empaque.'
                              : 'Actívalo si este producto se vende por pedazos: pastel por rebanada, charola por cuadro.'}
                          </span>
                        </label>
                      </div>
                      {on && (
                        <>
                          <form.Field name="slicesPerPiece">
                            {(f) => (
                              <Field
                                className="w-45 max-w-full"
                                data-invalid={f.state.meta.errors.length > 0}
                              >
                                <FieldLabel htmlFor="rebanadas-pieza">
                                  Rebanadas por pieza
                                </FieldLabel>
                                <Input
                                  id="rebanadas-pieza"
                                  inputMode="numeric"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <FieldError errors={errorsOf(f.state.meta)} />
                              </Field>
                            )}
                          </form.Field>
                          <LinesEditor
                            lines={sliceLines}
                            onChange={setSliceLines}
                            ingredients={packaging}
                            invalid={badLines}
                            labels={{
                              column: 'Empaque por rebanada',
                              add: '+ Agregar empaque por rebanada',
                              placeholder: 'Elige un empaque',
                              search: 'Buscar empaque',
                              empty: 'Sin empaque por rebanada todavía.',
                            }}
                          />
                        </>
                      )}
                    </>
                  )}
                </form.Subscribe>
              </CardContent>
            </Card>
          </div>

          <form.Subscribe selector={(s) => s.values}>
            {(values) => {
              const multiplier = (() => {
                const m = parseDecimal(values.multiplier)
                return m && m >= 1 ? m : null
              })()
              const summary = productSummary({
                recipes: recipeRows.map((r) => {
                  const c = recipeById.get(r.recipeId)
                  return {
                    total: c?.total ?? null,
                    ingredients: c?.ingredients ?? 0,
                    empty: c?.empty ?? true,
                  }
                }),
                packagingWhole: lineCost(wholeLines),
                packagingSlice: lineCost(sliceLines),
                sellsSlices: values.sellsSlices,
                slicesPerPiece: (() => {
                  const n = parseDecimal(values.slicesPerPiece)
                  return n && n >= 2 ? Math.floor(n) : null
                })(),
                price: parseDecimal(values.price),
                slicePrice: parseDecimal(values.slicePrice),
                multiplier,
                priceBase: settings.priceBase,
                taxPct: settings.taxPct,
                withTax: values.withTax,
              })
              const w = summary.whole
              const sl = summary.slices
              return (
                <div className="flex min-w-0 flex-1 basis-100 flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Entero</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 tabular-nums">
                      {summary.incomplete ? (
                        <>
                          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                            {recipeRows.length === 0
                              ? 'Agrega una receta para ver cuánto te cuesta y cuánto ganas.'
                              : 'Alguna receta aún no tiene ingredientes: agrégaselos para ver cuánto te cuesta.'}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {row(
                            'Receta (ya incluye ingredientes, merma, gasto fijo y mano de obra)',
                            formatPrice(w.recipes),
                          )}
                          {row('Empaque del entero', formatPrice(w.packaging))}
                          <div className="border-t" />
                          {row('Te cuesta', formatPrice(w.cost), true)}
                        </div>
                      )}

                      <form.Field name="price">
                        {(f) => (
                          <Field
                            className="w-45 max-w-full"
                            data-invalid={f.state.meta.errors.length > 0}
                          >
                            <FieldLabel htmlFor="precio">Lo vendo a</FieldLabel>
                            <InputGroup>
                              <InputGroupAddon>
                                <InputGroupText>$</InputGroupText>
                              </InputGroupAddon>
                              <InputGroupInput
                                id="precio"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                aria-invalid={f.state.meta.errors.length > 0}
                              />
                            </InputGroup>
                            <FieldError errors={errorsOf(f.state.meta)} />
                          </Field>
                        )}
                      </form.Field>
                      {w.margin && (
                        <div
                          className={cn(
                            'font-medium',
                            w.margin.gain < 0 && 'text-danger',
                          )}
                        >
                          {marginText(w.margin)}
                        </div>
                      )}
                      <VerdictBox
                        verdict={w.verdict}
                        multiplier={multiplier}
                        ratio={w.margin?.ratio ?? null}
                      />

                      <div className="flex flex-wrap items-end gap-3">
                        <form.Field name="multiplier">
                          {(f) => (
                            <Field
                              className="w-52 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="multiplo">
                                Quiero vender a
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="multiplo"
                                  inputMode="decimal"
                                  value={f.state.value}
                                  placeholder="1.43"
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>× mi costo</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                        <div className="pb-2">
                          Precio sugerido{' '}
                          <strong className="font-semibold">
                            {w.suggested === null
                              ? '—'
                              : formatAmount(
                                  Math.round(w.suggested * 100) / 100,
                                )}
                          </strong>
                        </div>
                      </div>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={w.suggested === null}
                          onClick={() =>
                            w.suggested !== null &&
                            form.setFieldValue(
                              'price',
                              (Math.round(w.suggested * 100) / 100).toFixed(2),
                            )
                          }
                        >
                          Usar este precio
                        </Button>
                      </div>
                      <form.Field name="withTax">
                        {(f) => (
                          <div className="flex items-start gap-3">
                            <Switch
                              id="impuestos"
                              checked={f.state.value}
                              onCheckedChange={f.handleChange}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor="impuestos"
                              className="flex cursor-pointer flex-col gap-0.5"
                            >
                              <span className="font-medium">
                                Vendo como negocio (con impuestos)
                              </span>
                              <span className="text-sm text-muted-foreground">
                                Si lo activas, escribes tu % de impuesto en{' '}
                                <Link
                                  to="/herramienta/ajustes"
                                  className="text-primary underline underline-offset-3"
                                >
                                  Ajustes de costos
                                </Link>{' '}
                                y se suma al precio.
                                {f.state.value && !settings.taxPct && (
                                  <> Aún no escribes tu %.</>
                                )}
                              </span>
                            </label>
                          </div>
                        )}
                      </form.Field>
                    </CardContent>
                  </Card>

                  {sl && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Por rebanada</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4 tabular-nums">
                        <div className="flex flex-col gap-2">
                          {row(
                            `Parte del entero (÷ ${sl.count})`,
                            formatPrice(sl.portion),
                          )}
                          {row(
                            'Empaque de la rebanada',
                            formatPrice(sl.packaging),
                          )}
                          <div className="border-t" />
                          {row('Te cuesta', formatPrice(sl.cost), true)}
                        </div>
                        <form.Field name="slicePrice">
                          {(f) => (
                            <Field
                              className="w-45 max-w-full"
                              data-invalid={f.state.meta.errors.length > 0}
                            >
                              <FieldLabel htmlFor="precio-rebanada">
                                Lo vendo a
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupAddon>
                                  <InputGroupText>$</InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                  id="precio-rebanada"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  value={f.state.value}
                                  onChange={(e) =>
                                    f.handleChange(e.target.value)
                                  }
                                  aria-invalid={f.state.meta.errors.length > 0}
                                />
                              </InputGroup>
                              <FieldError errors={errorsOf(f.state.meta)} />
                            </Field>
                          )}
                        </form.Field>
                        {sl.margin && (
                          <div
                            className={cn(
                              'font-medium',
                              sl.margin.gain < 0 && 'text-danger',
                            )}
                          >
                            {marginText(sl.margin)}
                          </div>
                        )}
                        <VerdictBox
                          verdict={sl.verdict}
                          multiplier={multiplier}
                          ratio={sl.margin?.ratio ?? null}
                        />
                        {sl.allSold !== null && (
                          <p className="m-0 text-sm text-muted-foreground">
                            Si vendes las {sl.count} rebanadas a{' '}
                            {formatPrice(parseDecimal(values.slicePrice) ?? 0)},
                            la pieza te deja {formatPrice(sl.allSold)}
                            {parseDecimal(values.price)
                              ? ` contra ${formatPrice(parseDecimal(values.price) ?? 0)} del entero`
                              : ''}
                            .
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )
            }}
          </form.Subscribe>
        </div>
        {error && <p className="m-0 text-sm text-destructive">{error}</p>}
      </form>

      {product && (
        <Card className="max-w-220">
          <CardHeader>
            <CardTitle>
              {product.archived ? 'Restaurar producto' : 'Archivar producto'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="m-0 text-muted-foreground">
              {product.archived
                ? 'Está archivado: no sale en tu lista ni en producciones nuevas. Si lo restauras vuelve a la lista.'
                : 'Si lo archivas, deja de aparecer en tu lista y no podrás elegirlo en producciones nuevas. Las producciones guardadas que ya lo usan siguen funcionando. Si alguna lo usa, te avisamos antes.'}
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  product.archived
                    ? void archive(false)
                    : setConfirmArchive(true)
                }
              >
                {product.archived ? 'Restaurar producto' : 'Archivar producto'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar “{product?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de salir en tu lista y en producciones nuevas. Puedes
              restaurarlo cuando quieras.
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
