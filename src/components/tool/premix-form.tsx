import { useForm } from '@tanstack/react-form'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  LinesEditor,
  lineProblems,
  newKey,
} from '#/components/tool/lines-editor'
import type { IngredientOption, Line } from '#/components/tool/lines-editor'
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
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { premixSummary } from '#/lib/cost-engine'
import { premixSchema } from '#/lib/cost-recipes'
import { UNITS, formatPrice, formatQuantity, parseDecimal } from '#/lib/costs'
import { savePremix, setPremixArchived } from '#/lib/tool-recipes'
import type { getPremix } from '#/lib/tool-recipes'

type Loaded = Awaited<ReturnType<typeof getPremix>>
type YieldUnit = 'G' | 'KG' | 'ML' | 'L'
const YIELD_UNITS: YieldUnit[] = ['G', 'KG', 'ML', 'L']

// Un texto vacío es "sin escribir" (null); uno ilegible llega como NaN y el esquema lo rechaza.
const optionalNumber = (t: string) =>
  t.trim() === '' ? null : (parseDecimal(t) ?? Number.NaN)

export function PremixForm({
  premix,
  ingredients,
}: {
  premix: NonNullable<Loaded['premix']> | null
  ingredients: Loaded['ingredients']
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>(
    () =>
      premix?.lines.map((l) => ({
        key: newKey(),
        kind: 'ingredient' as const,
        refId: l.ingredientId,
        quantity: String(l.quantity),
        unit: l.unit,
      })) ?? [],
  )
  const [badLines, setBadLines] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)

  const ingById = new Map<string, IngredientOption>(
    ingredients.map((i) => [i.id, i]),
  )

  function toValues(v: {
    name: string
    yieldQty: string
    yieldUnit: YieldUnit
  }) {
    return {
      name: v.name,
      yieldQty: optionalNumber(v.yieldQty),
      yieldUnit: v.yieldUnit,
      lines: lines.map((l) => ({
        ingredientId: l.refId,
        quantity: parseDecimal(l.quantity) ?? Number.NaN,
        unit: l.unit,
      })),
    }
  }

  const form = useForm({
    defaultValues: {
      name: premix?.name ?? '',
      yieldQty:
        premix?.yieldQty === null || !premix ? '' : String(premix.yieldQty),
      yieldUnit: (premix?.yieldUnit ?? 'G') as YieldUnit,
    },
    validators: {
      onSubmit: ({ value }) => {
        const bad = lineProblems(lines)
        setBadLines(bad)
        const fields: Record<string, string> = {}
        const result = premixSchema.safeParse(toValues(value))
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
        setError('Elige el ingrediente y escribe la cantidad en cada renglón.')
        return
      }
      setError(null)
      try {
        const result = await savePremix({
          data: { id: premix?.id ?? null, values: toValues(value) },
        })
        if (!result.id) return setError(result.error ?? 'No se pudo guardar.')
        await router.invalidate()
        await navigate({ to: '/herramienta/premezclas' })
      } catch {
        setError('No se pudo guardar. Revisa los datos e inténtalo de nuevo.')
      }
    },
  })

  async function archive(archived: boolean) {
    if (!premix) return
    setBusy(true)
    try {
      await setPremixArchived({ data: { id: premix.id, archived } })
      await router.invalidate()
      await navigate({ to: '/herramienta/premezclas' })
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
              {premix ? premix.name : 'Nueva premezcla'}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Premezcla: se cuesta por lo que realmente rinde.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/herramienta/premezclas">Cancelar</Link>
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

        <div className="flex max-w-220 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {premix ? premix.name : 'Datos de la premezcla'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form.Field name="name">
                {(f) => (
                  <Field
                    className="w-80 max-w-full"
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

              <div className="text-sm font-medium">Ingredientes</div>
              <LinesEditor
                lines={lines}
                onChange={setLines}
                ingredients={ingredients}
                invalid={badLines}
              />

              <div className="flex flex-wrap items-start gap-3">
                <form.Field name="yieldQty">
                  {(f) => (
                    <Field
                      className="w-55 max-w-full"
                      data-invalid={f.state.meta.errors.length > 0}
                    >
                      <FieldLabel htmlFor="rinde">
                        Rendimiento final real
                      </FieldLabel>
                      <Input
                        id="rinde"
                        inputMode="decimal"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        aria-invalid={f.state.meta.errors.length > 0}
                      />
                      <FieldError errors={errorsOf(f.state.meta)} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="yieldUnit">
                  {(f) => (
                    <Field className="w-30">
                      <FieldLabel htmlFor="unidad">Unidad</FieldLabel>
                      <Select
                        value={f.state.value}
                        onValueChange={(v) => f.handleChange(v as YieldUnit)}
                      >
                        <SelectTrigger id="unidad" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YIELD_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {UNITS[u].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>
              </div>

              <form.Subscribe selector={(s) => s.values}>
                {(values) => {
                  const summary = premixSummary(
                    lines.flatMap((l) => {
                      const ing = ingById.get(l.refId)
                      const q = parseDecimal(l.quantity)
                      return ing && q
                        ? [{ ingredient: ing, quantity: q, unit: l.unit }]
                        : []
                    }),
                    parseDecimal(values.yieldQty),
                    values.yieldUnit,
                  )
                  const small = summary.family === 'volume' ? 'ml' : 'g'
                  return (
                    <>
                      <p className="m-0 text-sm text-muted-foreground">
                        Pesa o mide lo que realmente te quedó. La unidad se
                        elige porque una mezcla de sólidos puede terminar
                        líquida y al revés (gramos, kilos, mililitros o litros).
                        Si rinde menos que la suma (
                        {formatQuantity(summary.sum)} {small}
                        ), la diferencia es merma y se reparte en el costo.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          [
                            'Suma de ingredientes',
                            `${formatQuantity(summary.sum)} ${small}`,
                          ],
                          ['Costo total', formatPrice(summary.cost)],
                          [
                            `Costo por ${summary.bulkUnit}`,
                            summary.perBulk === null
                              ? '—'
                              : formatPrice(summary.perBulk),
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="min-w-37.5 flex-1 rounded-lg border px-4 py-3"
                          >
                            <div className="text-sm text-muted-foreground">
                              {label}
                            </div>
                            <div className="text-xl font-semibold tabular-nums">
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                }}
              </form.Subscribe>
              {error && <p className="m-0 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          {premix && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {premix.archived
                    ? 'Restaurar premezcla'
                    : 'Archivar premezcla'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="m-0 text-muted-foreground">
                  {premix.archived
                    ? 'Está archivada: no sale al agregar ingredientes a recetas nuevas. Si la restauras vuelve a la lista.'
                    : 'Si la archivas, deja de aparecer al agregar ingredientes a recetas nuevas. Las recetas que ya la usan siguen funcionando. Si alguna la usa, te avisamos antes.'}
                </p>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      premix.archived
                        ? void archive(false)
                        : setConfirmArchive(true)
                    }
                  >
                    {premix.archived
                      ? 'Restaurar premezcla'
                      : 'Archivar premezcla'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </form>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar “{premix?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {premix && premix.usedBy > 0
                ? `La usan ${premix.usedBy} recetas: siguen funcionando, pero ya no podrás elegirla en recetas nuevas.`
                : 'Ninguna receta la usa. Puedes restaurarla cuando quieras.'}
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
