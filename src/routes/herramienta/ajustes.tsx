import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Info } from 'lucide-react'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  fixedCostPerHour,
  fullHour,
  laborPerHour,
  monthlyHours,
  multiplierExample,
  settingsSchema,
  WEEKS_PER_MONTH,
} from '#/lib/cost-settings'
import type {
  CostSettingsValues,
  LaborMode,
  PriceBase,
} from '#/lib/cost-settings'
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
  'ovenKw',
  'kwhPrice',
  'gasKgPerHour',
  'gasPricePerKg',
  'rentMonthly',
  'rentSharePct',
  'equipCost',
  'equipLifeHours',
  'wantedMonthly',
  'dailyMinWage',
  'multiplier',
  'defaultWastePct',
  'taxPct',
] as const
type NumberKey = (typeof NUMBERS)[number]
type Values = Record<NumberKey, string> & {
  laborMode: LaborMode
  priceBase: PriceBase
  sellsAsBusiness: boolean
}

const text = (n: number | null) => (n === null ? '' : String(n))

function initialValues(s: CostSettingsValues): Values {
  const numbers = Object.fromEntries(
    NUMBERS.map((k) => [k, text(s[k])]),
  ) as Record<NumberKey, string>
  return {
    ...numbers,
    laborMode: s.laborMode,
    priceBase: s.priceBase,
    sellsAsBusiness: s.sellsAsBusiness,
  }
}

// Vacío es null; un texto ilegible llega como NaN y el esquema lo rechaza.
const parse = (t: string) =>
  t.trim() === '' ? null : (parseDecimal(t) ?? Number.NaN)

function toSettings(v: Values): CostSettingsValues {
  return {
    ...(Object.fromEntries(NUMBERS.map((k) => [k, parse(v[k])])) as Record<
      NumberKey,
      number | null
    >),
    laborMode: v.laborMode,
    priceBase: v.priceBase,
    sellsAsBusiness: v.sellsAsBusiness,
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

const BASE_NOTE: Record<PriceBase, string> = {
  TOTAL:
    'Tu costo total: ingredientes, empaque, tu trabajo, el gas y la luz. Es lo más honesto, y por eso el múltiplo es chico.',
  INGREDIENTS:
    'Solo lo que compras. Es la regla de las redes de “multiplica por 3 tus ingredientes”: de ahí tienen que salir tu trabajo, tus gastos y tu ganancia.',
}

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
    'Amarillo: cubres tu costo, pero no llegas a tu múltiplo',
  ],
  ['bg-success-soft text-success', 'Verde: alcanzas tu múltiplo'],
] as const

function Ajustes() {
  const settings = Route.useLoaderData()
  const router = useRouter()
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)

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
      try {
        await saveCostSettings({ data: toSettings(value) })
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
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Gasto fijo por hora</CardTitle>
                    <CardDescription>
                      Lo que cuesta tener la cocina encendida una hora, sin
                      contar tu sueldo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {[
                      {
                        title: 'Luz',
                        value: fixed.electricity,
                        fields: [
                          num('ovenKw', 'Consumo del horno', { suffix: 'kW' }),
                          num('kwhPrice', 'Precio', {
                            prefix: '$',
                            suffix: '/ kWh',
                          }),
                        ],
                      },
                      {
                        title: 'Gas',
                        value: fixed.gas,
                        fields: [
                          num('gasKgPerHour', 'Consumo', { suffix: 'kg / h' }),
                          num('gasPricePerKg', 'Precio', {
                            prefix: '$',
                            suffix: '/ kg',
                          }),
                        ],
                      },
                      {
                        title: 'Renta',
                        value: fixed.rent,
                        fields: [
                          num('rentMonthly', 'Renta al mes', { prefix: '$' }),
                          num('rentSharePct', 'Parte que usas', {
                            suffix: '%',
                          }),
                        ],
                      },
                      {
                        title: 'Depreciación del horno',
                        value: fixed.depreciation,
                        fields: [
                          num('equipCost', 'Costo del equipo', { prefix: '$' }),
                          num('equipLifeHours', 'Dura', { suffix: 'horas' }),
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
                    <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 font-semibold tabular-nums">
                      <span>Gasto fijo por hora</span>
                      <span>{formatPrice(fixed.total)}</span>
                    </div>
                    {fixed.rent !== null && hours && (
                      <p className="m-0 text-sm text-muted-foreground">
                        La renta se reparte entre tus horas al mes:{' '}
                        {formatAmount(d.rentMonthly ?? 0)} ×{' '}
                        {d.rentSharePct ?? 0}% ÷ {hours} h ={' '}
                        {formatPrice(fixed.rent)}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            }}
          </form.Subscribe>

          <Card>
            <CardHeader>
              <CardTitle>Mano de obra por hora</CardTitle>
              <CardDescription>
                Lo que vale tu trabajo. Es distinto al gasto fijo: aquí va lo
                que tú quieres ganar.
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
                      aria-label="Cómo calcular tu mano de obra"
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
                Con cuántas veces tu costo vendes. Es un múltiplo, no un
                porcentaje.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-4">
                {num('multiplier', 'Quiero vender a', {
                  suffix: '× mi costo',
                  placeholder: '1.43',
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
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium">Aplicar sobre</div>
                <form.Field name="priceBase">
                  {(f) => (
                    <>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={f.state.value}
                        onValueChange={(v) =>
                          v && f.handleChange(v as PriceBase)
                        }
                        aria-label="Base del múltiplo"
                        className="self-start"
                      >
                        <ToggleGroupItem value="TOTAL">
                          Costo total
                        </ToggleGroupItem>
                        <ToggleGroupItem value="INGREDIENTS">
                          Solo ingredientes y empaque
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <p className="m-0 text-sm text-muted-foreground">
                        {BASE_NOTE[f.state.value]}
                      </p>
                    </>
                  )}
                </form.Field>
              </div>
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
              <CardDescription>Solo si vendes como negocio.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form.Subscribe selector={(s) => s.values.sellsAsBusiness}>
                {(business) => (
                  <>
                    <div className="flex items-start gap-3">
                      <Switch
                        id="negocio"
                        checked={business}
                        onCheckedChange={(v) =>
                          form.setFieldValue('sellsAsBusiness', v)
                        }
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="negocio"
                        className="flex cursor-pointer flex-col gap-0.5"
                      >
                        <span className="font-medium">Vendo como negocio</span>
                        <span className="text-sm text-muted-foreground">
                          Si lo activas, sumamos tu porcentaje al precio
                          sugerido.
                        </span>
                      </label>
                    </div>
                    {num('taxPct', 'Porcentaje de impuesto', {
                      suffix: '%',
                      placeholder: 'Tu %',
                      className: 'w-45',
                      disabled: !business,
                    })}
                  </>
                )}
              </form.Subscribe>
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
                        Mano de obra
                      </span>
                      <span>{labor === null ? '—' : formatPrice(labor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gasto fijo</span>
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
