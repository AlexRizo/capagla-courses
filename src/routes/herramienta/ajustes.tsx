import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Info, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Label } from '#/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Switch } from '#/components/ui/switch'
import {
  ACCOUNTING_NOTE,
  DEFAULT_MACHINERY_YEARS,
  DEFAULT_MOLDS_YEARS,
  fixedCostPerHour,
  fullHour,
  laborPerHour,
  monthlyHours,
  multiplierExample,
  settingsSchema,
  taxTypesSchema,
  WEEKS_PER_MONTH,
} from '#/lib/cost-settings'
import type { CostSettingsValues, LaborMode } from '#/lib/cost-settings'
import { formatAmount, formatPrice, parseDecimal } from '#/lib/costs'
import { getCostSettings, saveCostSettings } from '#/lib/tool-settings'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/herramienta/ajustes')({
  // Sin caché: tras guardar, la pantalla muestra siempre lo último.
  gcTime: 0,
  staleTime: 0,
  loader: () => getCostSettings(),
  component: Ajustes,
})

// Los números se escriben como texto y se convierten al guardar.
const NUMBERS = [
  'hoursPerWeek',
  'electricityMonthly',
  'gasMonthly',
  'rentMonthly',
  'rentSharePct',
  'machineryCost',
  'machineryYears',
  'moldsCost',
  'moldsYears',
  'wantedMonthly',
  'dailyMinWage',
  'multiplier',
  'targetMultiplier',
  'defaultWastePct',
] as const
type NumberKey = (typeof NUMBERS)[number]
type Values = Record<NumberKey, string> & {
  laborMode: LaborMode
  // Modo pro: la alumna cambia los años de vida del equipo (solo en pantalla).
  proYears: boolean
}

// Un impuesto en pantalla: los que ya existen llevan su `id`.
type TaxRow = { key: string; id: string | null; name: string; ratePct: string }

const text = (n: number | null) => (n === null ? '' : String(n))

function initialValues(s: CostSettingsValues): Values {
  const numbers = Object.fromEntries(
    NUMBERS.map((k) => [k, text(s[k])]),
  ) as Record<NumberKey, string>
  return {
    ...numbers,
    laborMode: s.laborMode,
    proYears: s.machineryYears !== null || s.moldsYears !== null,
  }
}

// Vacío es null; un texto ilegible llega como NaN y el esquema lo rechaza.
const parse = (t: string) =>
  t.trim() === '' ? null : (parseDecimal(t) ?? Number.NaN)

function toSettings(v: Values): CostSettingsValues {
  const numbers = Object.fromEntries(
    NUMBERS.map((k) => [k, parse(v[k])]),
  ) as Record<NumberKey, number | null>
  return {
    ...numbers,
    // Sin modo pro los años son los de por defecto.
    machineryYears: v.proYears ? numbers.machineryYears : null,
    moldsYears: v.proYears ? numbers.moldsYears : null,
    laborMode: v.laborMode,
  }
}

// Para mostrar los cálculos en vivo: lo que no se entiende cuenta como vacío.
function forDisplay(v: Values): CostSettingsValues {
  const s = toSettings(v)
  for (const k of NUMBERS) if (Number.isNaN(s[k])) s[k] = null
  return s
}

const perHour = (value: number | null) =>
  value === null ? '—' : `${formatPrice(value)} / h`

const LABOR_NOTE: Record<LaborMode, (full: number | null) => string> = {
  WANTED: () =>
    'Úsala como guía: si una receta te toma 3 horas, su tiempo ya cuesta tres veces la hora de trabajo.',
  MINIMUM_WAGE: () =>
    'Escribe el salario mínimo diario para ver el valor de tu hora.',
  NONE: (full) =>
    `Sin mano de obra solo cuentas el gasto fijo${full === null ? '' : `: ${formatPrice(full)} por hora`}. Los resultados dirán “te queda (incluye tu trabajo)”.`,
}

const LEGEND = [
  ['bg-danger-soft text-danger', 'Rojo: vendes por debajo de tu costo'],
  [
    'bg-warning-soft text-warning',
    'Amarillo: cubres tu costo, pero no llegas a tu mínimo',
  ],
  ['bg-success-soft text-success', 'Verde: entre tu mínimo y tu meta'],
  ['bg-success text-white', 'Verde brillante, «Excelente»: pasas de tu meta'],
] as const

function Ajustes() {
  const settings = Route.useLoaderData()
  const router = useRouter()
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)

  const [taxRows, setTaxRows] = useState<TaxRow[]>(() =>
    settings.taxTypes.map((t) => ({
      key: t.id,
      id: t.id,
      name: t.name,
      ratePct: String(t.ratePct),
    })),
  )
  const [taxError, setTaxError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: initialValues(settings),
    validators: {
      onSubmit: ({ value }) => {
        const result = settingsSchema.safeParse(toSettings(value))
        if (result.success) return undefined
        const fields: Record<string, string> = {}
        for (const issue of result.error.issues) {
          fields[String(issue.path[0])] ??=
            issue.code === 'invalid_type' ? 'Escribe un número.' : issue.message
        }
        return { fields }
      },
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const taxes = taxTypesSchema.safeParse(
        taxRows.map((r) => ({
          id: r.id,
          name: r.name,
          ratePct: parse(r.ratePct) ?? Number.NaN,
        })),
      )
      if (!taxes.success) {
        setTaxError(
          taxes.error.issues[0].code === 'invalid_type'
            ? 'Escribe la tasa de cada impuesto.'
            : taxes.error.issues[0].message,
        )
        return
      }
      setTaxError(null)
      try {
        await saveCostSettings({
          data: { settings: toSettings(value), taxTypes: taxes.data },
        })
        await router.invalidate()
        setMessage({ text: 'Guardado', error: false })
      } catch {
        setMessage({
          text: 'No se pudo guardar. Inténtalo de nuevo.',
          error: true,
        })
      }
    },
  })

  const errorsOf = (meta: { errors: unknown[] }) =>
    meta.errors.map((e) => (typeof e === 'string' ? { message: e } : undefined))

  // Un campo numérico con su prefijo y sufijo ($, h, %, kW…).
  function num(
    name: NumberKey,
    label: string,
    opts: {
      prefix?: string
      suffix?: string
      placeholder?: string
      className?: string
      disabled?: boolean
    } = {},
  ) {
    return (
      <form.Field name={name}>
        {(f) => (
          <Field
            className={cn('w-52 max-w-full', opts.className)}
            data-invalid={f.state.meta.errors.length > 0}
          >
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <InputGroup>
              {opts.prefix && (
                <InputGroupAddon>
                  <InputGroupText>{opts.prefix}</InputGroupText>
                </InputGroupAddon>
              )}
              <InputGroupInput
                id={name}
                inputMode="decimal"
                value={f.state.value}
                placeholder={opts.placeholder}
                disabled={opts.disabled}
                onChange={(e) => f.handleChange(e.target.value)}
                aria-invalid={f.state.meta.errors.length > 0}
              />
              {opts.suffix && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{opts.suffix}</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
            <FieldError errors={errorsOf(f.state.meta)} />
          </Field>
        )}
      </form.Field>
    )
  }

  return (
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
            Ajustes de costos
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Datos que se escriben una sola vez y se usan en todas tus recetas.
            Tres nombres que verás en toda la herramienta:{' '}
            <strong className="font-semibold">costo de producción</strong> es lo
            que te cuesta hacer tu postre (el total),{' '}
            <strong className="font-semibold">tu tiempo</strong> es tu trabajo,
            o el de quien te ayuda, y{' '}
            <strong className="font-semibold">gastos fijos</strong> es lo que
            pagas cada mes para poder hacer postres.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span
              className={cn(
                'text-sm',
                message.error ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {message.text}
            </span>
          )}
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
              <CardTitle>Tus horas</CardTitle>
              <CardDescription>
                Cuántas horas a la semana horneas. Sirve para repartir la renta.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {num('hoursPerWeek', 'Horas por semana', {
                suffix: 'h',
                className: 'w-45',
              })}
              <form.Subscribe selector={(s) => s.values.hoursPerWeek}>
                {(raw) => {
                  const hours = parseDecimal(raw)
                  const month = monthlyHours({ hoursPerWeek: hours })
                  if (!month) return null
                  return (
                    <div className="mt-6.5 flex h-9 items-center rounded-lg bg-muted px-3 tabular-nums">
                      <span className="text-muted-foreground">≈&nbsp;</span>
                      <strong className="font-semibold">
                        {month} horas al mes
                      </strong>
                      <span className="text-muted-foreground">
                        &nbsp;({hours} × {WEEKS_PER_MONTH})
                      </span>
                    </div>
                  )
                }}
              </form.Subscribe>
            </CardContent>
          </Card>

          <form.Subscribe selector={(s) => s.values}>
            {(values) => {
              const d = forDisplay(values)
              const fixed = fixedCostPerHour(d)
              const hours = monthlyHours(d)
              const pro = values.proYears
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Gastos fijos por hora</CardTitle>
                    <CardDescription>
                      Lo que pagas cada mes para poder hacer postres (renta,
                      gas, luz y el desgaste de tu equipo), repartido entre tus
                      horas de producción. Escribe lo que pagas al mes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {[
                      {
                        title: 'Luz',
                        value: fixed.electricity,
                        fields: [
                          num('electricityMonthly', 'Lo que pagas al mes', {
                            prefix: '$',
                          }),
                        ],
                      },
                      {
                        title: 'Gas',
                        value: fixed.gas,
                        fields: [
                          num('gasMonthly', 'Lo que pagas al mes', {
                            prefix: '$',
                          }),
                        ],
                      },
                      {
                        title: 'Renta',
                        value: fixed.rent,
                        fields: [
                          num('rentMonthly', 'Renta al mes', { prefix: '$' }),
                          num('rentSharePct', 'Parte que ocupas', {
                            suffix: '%',
                          }),
                        ],
                      },
                      {
                        title: 'Desgaste del equipo',
                        value: fixed.depreciation,
                        fields: [
                          num(
                            'machineryCost',
                            'Maquinaria (horno, batidora…)',
                            { prefix: '$', className: 'w-60' },
                          ),
                          ...(pro
                            ? [
                                num('machineryYears', 'Años de vida', {
                                  suffix: 'años',
                                  placeholder: String(DEFAULT_MACHINERY_YEARS),
                                  className: 'w-40',
                                }),
                              ]
                            : []),
                          num('moldsCost', 'Moldes y charolas', {
                            prefix: '$',
                            className: 'w-60',
                          }),
                          ...(pro
                            ? [
                                num('moldsYears', 'Años de vida', {
                                  suffix: 'años',
                                  placeholder: String(DEFAULT_MOLDS_YEARS),
                                  className: 'w-40',
                                }),
                              ]
                            : []),
                        ],
                      },
                    ].map((row) => (
                      <div
                        key={row.title}
                        className="flex flex-wrap items-start gap-4 rounded-lg border p-4"
                      >
                        <div className="w-full font-medium sm:w-40 sm:pt-7">
                          {row.title}
                        </div>
                        {row.fields}
                        <div className="ml-auto pt-7 font-medium tabular-nums">
                          {perHour(row.value)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-3">
                      <Switch
                        id="anios"
                        checked={pro}
                        onCheckedChange={(v) =>
                          form.setFieldValue('proYears', v)
                        }
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="anios"
                        className="flex cursor-pointer flex-col gap-0.5"
                      >
                        <span className="font-medium">
                          Cambiar los años de vida del equipo
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Si no lo activas, usamos {DEFAULT_MACHINERY_YEARS}{' '}
                          años para la maquinaria y {DEFAULT_MOLDS_YEARS} para
                          moldes y charolas.
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 font-semibold tabular-nums">
                      <span>Gastos fijos por hora</span>
                      <span>{formatPrice(fixed.total)}</span>
                    </div>
                    {hours && (
                      <p className="m-0 text-sm text-muted-foreground">
                        Todo se reparte entre tus horas al mes ({hours} h).
                        {fixed.rent !== null && (
                          <>
                            {' '}
                            La renta: {formatAmount(d.rentMonthly ?? 0)} ×{' '}
                            {d.rentSharePct ?? 0}% ÷ {hours} h ={' '}
                            {formatPrice(fixed.rent)}.
                          </>
                        )}
                        {fixed.depreciationMonthly !== null && (
                          <>
                            {' '}
                            El equipo se desgasta{' '}
                            {formatPrice(fixed.depreciationMonthly)} al mes
                            (precio ÷ años × 12).
                          </>
                        )}
                      </p>
                    )}
                    <p className="m-0 text-sm text-muted-foreground">
                      {ACCOUNTING_NOTE}
                    </p>
                  </CardContent>
                </Card>
              )
            }}
          </form.Subscribe>

          <Card>
            <CardHeader>
              <CardTitle>Tu tiempo (mano de obra) por hora</CardTitle>
              <CardDescription>
                Tu trabajo, o el de quien te ayuda. Es distinto a los gastos
                fijos: aquí va lo que tú quieres ganar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Subscribe selector={(s) => s.values}>
                {(values) => {
                  const d = forDisplay(values)
                  const hours = monthlyHours(d)
                  const mode = values.laborMode
                  const option = (
                    value: LaborMode,
                    title: string,
                    help: string,
                    body?: React.ReactNode,
                  ) => (
                    <div
                      className={cn(
                        'flex flex-col gap-4 rounded-lg border p-4',
                        mode === value && 'border-primary bg-accent',
                      )}
                    >
                      <label
                        htmlFor={`mo-${value}`}
                        className="flex cursor-pointer items-start gap-3"
                      >
                        <RadioGroupItem
                          id={`mo-${value}`}
                          value={value}
                          className="mt-0.5"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{title}</span>
                          <span className="text-sm text-muted-foreground">
                            {help}
                          </span>
                        </span>
                      </label>
                      {mode === value && body}
                    </div>
                  )
                  return (
                    <RadioGroup
                      value={mode}
                      onValueChange={(v) =>
                        form.setFieldValue('laborMode', v as LaborMode)
                      }
                      aria-label="Cómo calcular tu tiempo"
                      className="gap-3"
                    >
                      {option(
                        'WANTED',
                        'Calcular con lo que quiero ganar al mes',
                        'Escribe cuánto quieres ganar y lo dividimos entre tus horas.',
                        <div className="flex flex-wrap items-center gap-4">
                          {num('wantedMonthly', 'Quiero ganar al mes', {
                            prefix: '$',
                          })}
                          {d.wantedMonthly !== null && hours ? (
                            <div className="mt-6.5 tabular-nums">
                              {formatAmount(d.wantedMonthly)} ÷ {hours} h ={' '}
                              <strong className="font-semibold">
                                {formatPrice(d.wantedMonthly / hours)} por hora
                              </strong>
                            </div>
                          ) : (
                            <div className="mt-6.5 text-sm text-muted-foreground">
                              Escribe tus horas y lo que quieres ganar.
                            </div>
                          )}
                        </div>,
                      )}
                      {option(
                        'MINIMUM_WAGE',
                        'No sé cuánto cobrar: partir del salario mínimo',
                        'Toma el salario mínimo diario de tu zona entre 8 horas. Es solo una base para empezar: tu trabajo vale más que eso.',
                        <div className="flex flex-wrap items-center gap-4">
                          {num('dailyMinWage', 'Salario mínimo diario', {
                            prefix: '$',
                            placeholder: 'Escribe el de tu zona',
                          })}
                          <div className="mt-6.5 tabular-nums">
                            {d.dailyMinWage ? (
                              <>
                                ÷ 8 h ={' '}
                                <strong className="font-semibold">
                                  {formatPrice(d.dailyMinWage / 8)} por hora
                                </strong>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                ÷ 8 h = por hora
                              </span>
                            )}
                          </div>
                        </div>,
                      )}
                      {option(
                        'NONE',
                        'No sumar mano de obra por ahora',
                        'El resultado dirá “te queda (incluye tu trabajo)” para que no creas que es ganancia limpia.',
                      )}
                    </RadioGroup>
                  )
                }}
              </form.Subscribe>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cómo fijas tu precio</CardTitle>
              <CardDescription>
                Con cuántas veces tu costo total (ingredientes, empaque, tu
                tiempo y gastos fijos) vendes. Es un múltiplo, no un porcentaje.
                El ×2.5 es el mínimo que recomienda la chef por su experiencia,
                y el ×3.5 es la meta.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-4">
                {num('multiplier', 'Múltiplo mínimo', {
                  suffix: '× mi costo',
                  placeholder: '2.5',
                })}
                {num('targetMultiplier', 'Meta', {
                  suffix: '× mi costo',
                  placeholder: '3.5',
                })}
                {num('defaultWastePct', 'Merma por defecto en recetas nuevas', {
                  suffix: '%',
                  className: 'w-72',
                })}
              </div>
              <form.Subscribe selector={(s) => s.values.multiplier}>
                {(raw) => {
                  const m = parseDecimal(raw)
                  if (!m || m < 1) return null
                  const e = multiplierExample(m)
                  return (
                    <div className="rounded-lg bg-muted px-4 py-3 tabular-nums">
                      <div className="text-sm text-muted-foreground">
                        Ejemplo con un costo de $100
                      </div>
                      <div>
                        Lo vendes a{' '}
                        <strong className="font-semibold">
                          {formatAmount(e.price)}
                        </strong>{' '}
                        ({m} × $100). Tu costo es el{' '}
                        <strong className="font-semibold">
                          {Math.round(e.costPct)}%
                        </strong>{' '}
                        del precio y ganas{' '}
                        <strong className="font-semibold">
                          {formatAmount(e.gain)}
                        </strong>
                        , el {Math.round(e.gainPct)}% del precio.
                      </div>
                    </div>
                  )
                }}
              </form.Subscribe>
              <Alert>
                <Info />
                <AlertTitle>Cuidado con los porcentajes</AlertTitle>
                <AlertDescription>
                  “Triplicar” es ×3, no 30%. Y ganar 30% sobre el costo ($100 →
                  $130) no es lo mismo que ganar el 30% del precio ($100 →
                  $143). Por eso aquí escribes cuántas veces tu costo: ×3 de
                  $100 es $300.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                {LEGEND.map(([style, label]) => (
                  <span
                    key={label}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      style,
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impuestos</CardTitle>
              <CardDescription>
                Da de alta tus tipos de impuesto (nombre y tasa) y en cada
                producto eliges cuál aplica, o ninguno. Tu precio ya incluye el
                impuesto: el margen y el semáforo se calculan sobre el precio ÷
                (1 + tasa).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {taxRows.map((row) => (
                <div key={row.key} className="flex flex-wrap items-end gap-3">
                  <div className="flex w-60 max-w-full flex-col gap-1.5">
                    <Label htmlFor={`imp-${row.key}`}>Nombre</Label>
                    <Input
                      id={`imp-${row.key}`}
                      value={row.name}
                      placeholder="IVA"
                      onChange={(e) =>
                        setTaxRows((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, name: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex w-36 flex-col gap-1.5">
                    <Label htmlFor={`tasa-${row.key}`}>Tasa</Label>
                    <InputGroup>
                      <InputGroupInput
                        id={`tasa-${row.key}`}
                        inputMode="decimal"
                        value={row.ratePct}
                        placeholder="16"
                        onChange={(e) =>
                          setTaxRows((rs) =>
                            rs.map((r) =>
                              r.key === row.key
                                ? { ...r, ratePct: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${row.name || 'impuesto'}`}
                    onClick={() =>
                      setTaxRows((rs) => rs.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {taxError && (
                <p className="m-0 text-sm text-destructive">{taxError}</p>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setTaxRows((rs) => [
                      ...rs,
                      {
                        key: crypto.randomUUID(),
                        id: null,
                        name: '',
                        ratePct: '',
                      },
                    ])
                  }
                >
                  <Plus /> Agregar impuesto
                </Button>
              </div>
              <p className="m-0 text-sm text-muted-foreground">
                Las compras no manejan impuestos: el precio de cada ingrediente
                es lo que pagaste. Te recomendamos confirmar las tasas con una
                contadora.
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80">
          <form.Subscribe selector={(s) => s.values}>
            {(values) => {
              const d = forDisplay(values)
              const labor = laborPerHour(d)
              const fixed = fixedCostPerHour(d).total
              const full = fullHour(d)
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Tu hora de trabajo con todo</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tu tiempo (mano de obra)
                      </span>
                      <span>{labor === null ? '—' : formatPrice(labor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Gastos fijos
                      </span>
                      <span>{formatPrice(fixed)}</span>
                    </div>
                    <div className="border-t" />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Hora con todo</span>
                      <span>{full === null ? '—' : formatPrice(full)}</span>
                    </div>
                    <p className="m-0 text-sm text-muted-foreground">
                      {LABOR_NOTE[values.laborMode](full)}
                    </p>
                  </CardContent>
                </Card>
              )
            }}
          </form.Subscribe>
        </aside>
      </div>
    </form>
  )
}
