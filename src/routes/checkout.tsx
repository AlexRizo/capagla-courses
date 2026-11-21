import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import type { StripeCardNumberElement } from '@stripe/stripe-js'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import { z } from 'zod'

import {
  RENEWAL_DISCOUNT_PCT,
  TOOL_RENEWAL_DISCOUNT_PCT,
  mxn,
} from '#/lib/catalog'
import { getCheckoutData, getThanksOrder, startCheckout } from '#/lib/checkout'
import { track } from '#/lib/track-client'
import { CONTACT_EMAIL } from '#/lib/contact'
import { seo, siteUrlFrom } from '#/lib/seo'

export const Route = createFileRoute('/checkout')({
  validateSearch: z.object({
    promo: z.string().optional(),
    prueba: z.string().optional().catch(undefined),
    // Desde "Quiero el curso" de Mis cursos: al pagar vuelve a Mis cursos (no a /gracias).
    desde: z.literal('mis-cursos').optional().catch(undefined),
    // Renovación del acceso a ese curso (desde Mis cursos).
    renovar: z.string().optional().catch(undefined),
    // Herramienta de costos sola, a precio normal (desde Mis cursos).
    producto: z.string().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({
    promo: search.promo,
    prueba: search.prueba,
    renovar: search.renovar,
    producto: search.producto,
  }),
  loader: ({ deps }) => getCheckoutData({ data: deps }),
  head: ({ matches }) => ({
    meta: seo({ title: 'Pago', base: siteUrlFrom(matches), noindex: true }),
  }),
  component: Checkout,
})

const label = 'text-sm font-bold md:text-15'
const input =
  'box-border h-12.5 rounded-12 border-1.5 border-landing-field bg-white px-3.5 text-base text-landing-ink md:h-13 md:px-4 md:text-17 disabled:opacity-60'
const payBtn =
  'cursor-pointer items-center justify-center gap-2.5 rounded-12 border-none bg-landing-primary font-black text-white no-underline disabled:cursor-wait'
const strike = 'text-landing-strike line-through'
// Contacto para dudas del pago (pedido del cliente; no está en la maqueta).
const SUPPORT_EMAIL = CONTACT_EMAIL

// Campos de Stripe con los colores de la maqueta (los dibuja Stripe en un iframe).
const stripeFonts = [
  {
    cssSrc:
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap',
  },
]
const stripeOptions = { locale: 'es-419' as const, fonts: stripeFonts }
const cardStyle = (fontSize: string) => ({
  base: {
    color: '#2a1233',
    fontFamily: 'Lato, sans-serif',
    fontSize,
    '::placeholder': { color: '#5b4663' },
  },
  invalid: { color: '#b42318' },
})
// Caja de cada campo de tarjeta; el borde cambia con el foco y con un error.
const cardField =
  'box-border flex h-12 items-center rounded-12 border-1.5 bg-white px-3.5 transition-colors [&>*]:w-full'
// Etapas del pago, para que la alumna vea qué está pasando después de dar clic.
type Stage = 'idle' | 'preparing' | 'confirming' | 'activating'
const stageText: Record<Exclude<Stage, 'idle'>, string> = {
  preparing: 'Preparando tu pago…',
  confirming: 'Confirmando con tu banco…',
  activating: '¡Pago aprobado! Activando tu acceso…',
}

// Una orden gratis no pasa por el banco ni "aprueba un pago".
const freeStageText: Record<Exclude<Stage, 'idle'>, string> = {
  preparing: 'Activando tu acceso…',
  confirming: 'Activando tu acceso…',
  activating: '¡Listo! Activando tu acceso…',
}

function Spinner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} flex-none motion-safe:animate-spin`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LockIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} fill-none stroke-landing-lock`}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

type Line = { name: string; normalMxn: number; priceMxn: number }

// "[valor real]" mientras el curso no tenga precio normal (como en la maqueta).
const normalText = (line: Line) =>
  line.normalMxn > 0 ? mxn(line.normalMxn) : '[valor real]'

// Casilla para agregar un nivel de la herramienta con el precio de la promoción. Con varios
// niveles hay una por nivel y se excluyen entre sí (lo controla el formulario).
function ToolBump({
  tool,
  checked,
  noneChosen,
  disabled,
  onToggle,
}: {
  tool: { slug: string; name: string; normalMxn: number; priceMxn: number }
  checked: boolean
  noneChosen: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const id = `bump-${tool.slug}`
  const toolDiscount = Math.round((1 - tool.priceMxn / tool.normalMxn) * 100)
  // Sin descuento (la promoción la vende a su precio normal) no se promete uno ni se presiona.
  const deal = toolDiscount > 0
  // «Herramienta de costos · Completo» → «Completo» (nombre del nivel, como la maqueta).
  const toolTier = tool.name.split(' · ')[1] ?? ''
  const warn = deal && !checked && noneChosen
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-1.5 p-3.5 md:gap-3.5 md:p-4.5 ${
        !warn
          ? 'border-landing-pink-line bg-landing-pink'
          : 'border-landing-warn-line bg-landing-warn'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 size-5.5 flex-none accent-landing-primary md:mt-0.75"
      />
      <label
        htmlFor={id}
        className="flex flex-col gap-1 text-sm leading-145 md:gap-1.5 md:text-15 md:leading-normal"
      >
        <span className="text-15 font-black md:text-base">
          {!warn
            ? `Agrega la herramienta de costos${toolTier ? ` ${toolTier}` : ''}${deal ? ` con ${toolDiscount}% de descuento` : ''}`
            : '¿Seguro que no la quieres?'}
        </span>
        <span className="text-landing-muted">
          {!deal ? (
            'Es opcional y se suma a tu compra.'
          ) : !warn ? (
            <>
              <span className="md:hidden">
                Normalmente cuesta más. Si la agregas ahora, te llevas un
                descuento especial.
              </span>
              <span className="hidden md:inline">
                Normalmente cuesta más, pero si la agregas ahora te llevas un
                descuento especial. Se suma a tu compra.
              </span>
            </>
          ) : (
            <>
              <span className="md:hidden">
                Esta promoción no se repite: después cuesta ${tool.normalMxn}.
                Marca la casilla para conservar tu descuento.
              </span>
              <span className="hidden md:inline">
                Esta promoción no se repite: después la herramienta cuesta $
                {tool.normalMxn}. Marca la casilla para conservar tu descuento.
              </span>
            </>
          )}
        </span>
        <span className="flex items-baseline gap-2">
          <span className={strike}>{mxn(tool.normalMxn)}</span>
          <span className="text-base font-black md:text-lg">
            {mxn(tool.priceMxn)}
          </span>
        </span>
      </label>
    </div>
  )
}

// Curso adicional de la promoción, con su precio especial (0 = incluido gratis).
function IncludedCourse({
  course,
  until,
  desktop,
}: {
  course: Line
  until: string | null
  desktop?: boolean
}) {
  const free = course.priceMxn === 0
  const when = until ? ` hasta el ${until}` : ''
  return (
    <div
      className={
        desktop
          ? 'hidden flex-col gap-1.5 rounded-12 border-1.5 border-landing-pink-line bg-landing-pink p-3.5 md:flex'
          : 'flex flex-col gap-0.75 rounded-lg border-1.5 border-landing-pink-line bg-landing-pink px-3 py-2.5 md:hidden'
      }
    >
      <div
        className={`font-black tracking-landing-caps text-landing-accent ${desktop ? 'text-xs' : 'text-11'}`}
      >
        {free ? 'INCLUIDO GRATIS' : 'CURSO ADICIONAL'}
      </div>
      <div
        className={`flex justify-between gap-2 ${desktop ? 'items-baseline text-15' : 'text-sm'}`}
      >
        <span className="font-bold">Curso: {course.name}</span>
        <span
          className={`flex flex-none gap-1.5 ${desktop ? 'items-baseline md:gap-2' : ''}`}
        >
          <span className={strike}>{normalText(course)}</span>
          <span className="font-black">
            {free ? 'Gratis' : mxn(course.priceMxn)}
          </span>
        </span>
      </div>
      {(free || until) && (
        <div
          className={`text-landing-muted ${desktop ? 'text-13' : 'text-xs'}`}
        >
          {free ? 'Incluido gratis con tu curso.' : `Precio especial${when}.`}
        </div>
      )}
    </div>
  )
}

type Buyer = { email: string; name: string }

// El correo ya tiene el curso vigente: el servidor no deja cobrarlo otra vez y la
// alumna va a Entrar con su correo (no tiene nada que pagar).
class AlreadyOwned extends Error {}

// Apple Pay y Google Pay. Stripe solo los muestra si el navegador y el dispositivo los
// admiten; si no hay ninguno no se ve nada (ni el separador "o paga con tarjeta").
function Wallets({
  getBuyer,
  pay,
  onPaid,
  onOwned,
  onError,
}: {
  getBuyer: () => Partial<Buyer>
  pay: (buyer: Buyer) => Promise<{ orderId: string; clientSecret: string }>
  onPaid: (orderId: string) => void
  onOwned: (email: string) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [available, setAvailable] = useState(false)

  return (
    <div className={available ? 'flex flex-col gap-2.5 md:gap-2.5' : undefined}>
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonTheme: { applePay: 'black', googlePay: 'white' },
          layout: { maxColumns: 2, maxRows: 1 },
          emailRequired: true,
          paymentMethods: {
            applePay: 'auto',
            googlePay: 'auto',
            link: 'never',
            amazonPay: 'never',
            paypal: 'never',
          },
        }}
        onReady={({ availablePaymentMethods }) =>
          setAvailable(
            !!availablePaymentMethods &&
              Object.values(availablePaymentMethods).some(Boolean),
          )
        }
        onConfirm={async (event) => {
          if (!stripe || !elements) return
          const form = getBuyer()
          const email = form.email || event.billingDetails?.email
          const name = form.name || event.billingDetails?.name
          if (!email || !name) {
            event.paymentFailed({ reason: 'invalid_shipping_address' })
            onError('Escribe tu correo y tu nombre para continuar.')
            return
          }
          try {
            const submitted = await elements.submit()
            if (submitted.error) throw submitted.error
            const { orderId, clientSecret } = await pay({ email, name })
            const result = await stripe.confirmPayment({
              elements,
              clientSecret,
              confirmParams: {
                return_url: `${window.location.origin}/gracias?orden=${orderId}`,
              },
              redirect: 'if_required',
            })
            if (result.error) throw result.error
            onPaid(orderId)
          } catch (error) {
            event.paymentFailed({ reason: 'fail' })
            if (error instanceof AlreadyOwned) return onOwned(email)
            onError(
              error instanceof Error && error.message
                ? error.message
                : 'No se pudo procesar el pago. Intenta de nuevo.',
            )
          }
        }}
      />
      {available && (
        <div className="flex items-center gap-2.5 text-xs text-landing-muted md:gap-3 md:text-13">
          <div className="h-px flex-1 bg-landing-line" />
          o paga con tarjeta
          <div className="h-px flex-1 bg-landing-line" />
        </div>
      )}
    </div>
  )
}

type CardField = 'number' | 'expiry' | 'cvc'
type CardEvent = { complete: boolean; error?: { message: string } }
// Lo que el formulario usa de los campos de tarjeta al pagar.
type CardHandle = {
  card: () => StripeCardNumberElement | null
  focus: (field: CardField) => void
}
// Qué falta, si se intenta pagar con un campo vacío o a medias.
const missingText: Record<CardField, string> = {
  number: 'Escribe el número de tu tarjeta.',
  expiry: 'Escribe el vencimiento de tu tarjeta (MM/AA).',
  cvc: 'Escribe el CVC: 3 dígitos atrás de tu tarjeta (4 al frente en American Express).',
}

// Los datos de la tarjeta en tres campos de Stripe, iguales en celular y escritorio: número
// arriba, vencimiento y CVC abajo, cada uno con su etiqueta y su error. Antes el celular usaba
// un solo campo donde la fecha y el CVC aparecían hasta completar el número y luego todo se
// recorría, y había dos copias montadas (celular y escritorio): al pagar se leía la del ancho
// del momento, así que al girar el teléfono o cambiar el zoom se leía la vacía.
function CardFields({
  busy,
  onChange,
  getter,
}: {
  busy: boolean
  onChange: (field: CardField, event: CardEvent) => void
  getter: React.RefObject<CardHandle | null>
}) {
  const elements = useElements()
  const [errors, setErrors] = useState<Partial<Record<CardField, string>>>({})
  const [focused, setFocused] = useState<CardField | null>(null)
  const done = useRef<Record<CardField, boolean>>({
    number: false,
    expiry: false,
    cvc: false,
  })

  useEffect(() => {
    const element = (field: CardField) =>
      field === 'number'
        ? elements?.getElement(CardNumberElement)
        : field === 'expiry'
          ? elements?.getElement(CardExpiryElement)
          : elements?.getElement(CardCvcElement)
    getter.current = {
      card: () => elements?.getElement(CardNumberElement) ?? null,
      focus: (field) => element(field)?.focus(),
    }
  }, [elements, getter])

  function change(field: CardField, event: CardEvent) {
    const wasDone = done.current[field]
    done.current[field] = event.complete
    setErrors((prev) => ({ ...prev, [field]: event.error?.message }))
    onChange(field, event)
    // Al completar un campo, el cursor pasa al siguiente.
    if (event.complete && !wasDone) {
      if (field === 'number') elements?.getElement(CardExpiryElement)?.focus()
      if (field === 'expiry') elements?.getElement(CardCvcElement)?.focus()
    }
  }

  const box = (field: CardField) =>
    `${cardField} ${
      errors[field]
        ? 'border-destructive'
        : focused === field
          ? 'border-landing-primary'
          : 'border-landing-field'
    }`
  const fieldLabel = 'text-13 text-landing-muted'
  const errorText = (field: CardField) =>
    errors[field] && (
      <div className="text-13 leading-snug text-destructive">
        {errors[field]}
      </div>
    )
  const common = (field: CardField) => ({
    onChange: (e: CardEvent) => change(field, e),
    onFocus: () => setFocused(field),
    onBlur: () => setFocused((f) => (f === field ? null : f)),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className={fieldLabel}>Número de tarjeta</div>
        <div className={box('number')}>
          <CardNumberElement
            options={{
              style: cardStyle('16px'),
              showIcon: true,
              // Sin el botón de Link dentro del campo (H44).
              disableLink: true,
              disabled: busy,
            }}
            {...common('number')}
          />
        </div>
        {errorText('number')}
      </div>
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={fieldLabel}>Vencimiento</div>
          <div className={box('expiry')}>
            <CardExpiryElement
              options={{ style: cardStyle('16px'), disabled: busy }}
              {...common('expiry')}
            />
          </div>
          {errorText('expiry')}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={fieldLabel}>CVC (3 o 4 dígitos)</div>
          <div className={box('cvc')}>
            <CardCvcElement
              options={{ style: cardStyle('16px'), disabled: busy }}
              {...common('cvc')}
            />
          </div>
          {errorText('cvc')}
        </div>
      </div>
    </div>
  )
}

function Checkout() {
  const { stripeKey } = Route.useLoaderData()
  const stripePromise = useMemo(
    () => (stripeKey ? loadStripe(stripeKey) : null),
    [stripeKey],
  )
  return (
    <Elements stripe={stripePromise} options={stripeOptions}>
      <CheckoutForm stripePromise={stripePromise} />
    </Elements>
  )
}

function CheckoutForm({
  stripePromise,
}: {
  stripePromise: ReturnType<typeof loadStripe> | null
}) {
  const {
    course,
    bonuses,
    tools,
    special,
    until,
    account,
    renewal,
    upgradeUntil,
    saveCard,
  } = Route.useLoaderData()
  const { promo, prueba, desde, renovar, producto } = Route.useSearch()
  const days = upgradeUntil
    ? `hasta el ${upgradeUntil}`
    : `${course.accessDays} días${renewal ? ' más' : ''}`
  const navigate = useNavigate()
  const stripe = useStripe()
  const cardGetter = useRef<CardHandle | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  // Con el curso gratis (promoción de costeo) la herramienta es lo que se vende: arranca marcada y
  // quien solo quiere el curso la quita aquí. Si la promoción trae varios niveles (Básico y
  // Completo) se elige uno o ninguno, nunca los dos: arranca marcado el más caro (decisión del
  // usuario, 2026-11-11). Si el curso se cobra (/navidad) la herramienta no llega aquí: se ofrece
  // en /gracias después de pagar (Cheko, 2026-11-19, Fase 2).
  const [chosen, setChosen] = useState<string | null>(
    () =>
      tools.reduce<(typeof tools)[number] | null>(
        (best, t) => (!best || t.normalMxn > best.normalMxn ? t : best),
        null,
      )?.slug ?? null,
  )
  const [stage, setStage] = useState<Stage>('idle')
  const busy = stage !== 'idle'
  const [error, setErrorText] = useState<string | null>(null)
  // Si cada campo de Stripe (número, vencimiento y CVC) está completo, y el error del que tenga
  // uno (se muestra bajo su campo; aquí se usa al intentar pagar).
  const cardFields = useRef<Record<string, boolean>>({})
  const [fieldError, setFieldError] = useState<{
    field: string
    message: string
  } | null>(null)
  // Orden y cobro del último intento: se reutilizan si los datos no cambian, para que
  // reintentar con otra tarjeta no deje órdenes de más.
  const attempt = useRef<{
    key: string
    orderId: string
    // null: orden gratis, ya completada en el servidor (no hay cobro).
    clientSecret: string | null
  } | null>(null)

  const tool = tools.find((t) => t.slug === chosen) ?? null
  const addTool = tool !== null
  const courseStrike = course.priceMxn < course.normalMxn
  const total =
    course.priceMxn +
    bonuses.reduce((sum, b) => sum + b.priceMxn, 0) +
    (addTool ? tool.priceMxn : 0)
  // Total $0 (promoción que regala el curso y sin la herramienta): no hay cobro ni tarjeta.
  const free = total === 0
  const payText = free ? 'Obtener gratis' : `Pagar ${mxn(total)}`
  const cartParams = {
    value: total,
    currency: 'MXN',
    contentName: course.name,
    contentIds: [course.slug],
  }
  // Marketing: llegar al pago es "agregar al carrito" e "iniciar pago" (navegador y servidor), una
  // vez por visita. InitiateCheckout salía solo al dar «Pagar» con la tarjeta completa, así que
  // Meta no veía a quien abría el checkout y no pagaba (Cheko, 2026-11-19).
  const cartTracked = useRef(false)
  useEffect(() => {
    if (cartTracked.current) return
    cartTracked.current = true
    track('AddToCart', { email: account?.email, params: cartParams })
    track('InitiateCheckout', { email: account?.email, params: cartParams })
  }, [])
  const stageLabel = free ? freeStageText : stageText
  const payLabel =
    stage === 'idle' ? (
      payText
    ) : (
      <>
        <Spinner className="size-5" />
        {stageLabel[stage]}
      </>
    )
  const shownError = error

  function onCardChange(field: CardField, event: CardEvent) {
    cardFields.current[field] = event.complete
    setErrorText(null)
    if (event.error) setFieldError({ field, message: event.error.message })
    else if (fieldError?.field === field) setFieldError(null)
  }

  function setError(message: string | null) {
    setErrorText(message)
    if (message) {
      setTimeout(() => errorRef.current?.scrollIntoView({ block: 'center' }), 0)
    }
  }

  // Crea la orden y su cobro en el servidor (o reutiliza los del intento anterior).
  async function startPayment(buyer: Buyer) {
    const key = JSON.stringify([
      buyer.email,
      buyer.name,
      chosen,
      promo,
      prueba,
      renovar,
      producto,
    ])
    if (attempt.current?.key === key) return attempt.current
    const result = await startCheckout({
      data: {
        // Con sesión el servidor usa el correo y el nombre de la cuenta (el nombre solo se
        // manda si la cuenta aún no tiene uno real).
        ...(!account ? buyer : account.nameLocked ? {} : { name: buyer.name }),
        withTool: addTool,
        toolSlug: tool?.slug,
        promo,
        prueba,
        renovar,
        producto,
        replaces: attempt.current?.orderId,
        saveCard,
      },
    })
    if ('error' in result) throw new AlreadyOwned()
    if ('free' in result) {
      attempt.current = { key, orderId: result.orderId, clientSecret: null }
      return attempt.current
    }
    if (!result.clientSecret) throw new Error('No se pudo iniciar el pago.')
    attempt.current = {
      key,
      orderId: result.orderId,
      clientSecret: result.clientSecret,
    }
    return attempt.current
  }

  // Pagos con tarjeta o cartera digital: solo existen con un total mayor a $0, así que siempre hay cobro.
  async function startCardPayment(buyer: Buyer) {
    const { orderId, clientSecret } = await startPayment(buyer)
    if (!clientSecret) throw new Error('No se pudo iniciar el pago.')
    return { orderId, clientSecret }
  }

  const goToLogin = (email: string) =>
    navigate({ to: '/entrar', search: { correo: email } })

  async function goToThanks(orderId: string) {
    if (desde === 'mis-cursos') {
      // Confirma la orden (activa el acceso aunque el webhook no haya llegado) y vuelve.
      const order = await getThanksOrder({ data: { orderId } })
      if (order?.status === 'PAID') return navigate({ to: '/mis-cursos' })
    }
    return navigate({ to: '/gracias', search: { orden: orderId } })
  }

  // Orden gratis: el servidor la completa sin cobro y se va directo a "Listo".
  async function getFree(buyer: Buyer) {
    setStage('preparing')
    setError(null)
    try {
      const { orderId } = await startPayment(buyer)
      setStage('activating')
      await goToThanks(orderId)
    } catch (err) {
      if (err instanceof AlreadyOwned) {
        await goToLogin(buyer.email)
        return
      }
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo activar tu acceso. Intenta de nuevo.',
      )
      setStage('idle')
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const buyer = {
      email: String(form.correo.value).trim(),
      name: String(form.nombre.value).trim(),
    }
    if (free) return getFree(buyer)
    if (!stripe) return
    const card = cardGetter.current?.card()
    if (!card) return
    // Sin la tarjeta completa no se crea la orden: se dice qué falta y el cursor va ahí.
    const fields: CardField[] = ['number', 'expiry', 'cvc']
    const missing = fields.find((f) => !cardFields.current[f])
    if (missing) {
      setError(
        fieldError?.field === missing
          ? fieldError.message
          : missingText[missing],
      )
      cardGetter.current?.focus(missing)
      return
    }

    setStage('preparing')
    setError(null)
    try {
      const { orderId, clientSecret } = await startPayment(buyer)
      // Sin sesión el servidor puede quitar un adicional que ya tenías: si con eso el total quedó
      // en $0, la orden ya está activa y no hay nada que cobrar.
      if (!clientSecret) {
        setStage('activating')
        await goToThanks(orderId)
        return
      }
      setStage('confirming')
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: { name: buyer.name, email: buyer.email },
        },
      })
      if (result.error) {
        setError(result.error.message ?? 'No se pudo procesar el pago.')
        setStage('idle')
        return
      }
      setStage('activating')
      await goToThanks(orderId)
    } catch (err) {
      if (err instanceof AlreadyOwned) {
        await goToLogin(buyer.email)
        return
      }
      setError('No se pudo procesar el pago. Intenta de nuevo.')
      setStage('idle')
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      aria-busy={busy}
      className="flex min-h-screen flex-col bg-landing-page font-sans text-landing-ink"
    >
      <span role="status" className="sr-only">
        {stage === 'idle' ? '' : stageLabel[stage]}
      </span>
      <div className="flex items-center justify-between border-b border-landing-line bg-white px-4 py-3.5 md:px-8 md:py-4">
        <Link
          to="/"
          className="text-22 font-black tracking-landing-logo text-landing-primary no-underline md:text-2xl"
        >
          Capagla
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-landing-muted md:gap-2 md:text-sm">
          <LockIcon className="size-3.5 md:size-4" />
          Pago seguro con Stripe
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-260 flex-1 flex-col gap-4 px-4 py-5 md:flex-none md:flex-row md:flex-wrap md:items-start md:gap-10 md:px-8 md:pt-12 md:pb-16">
        {/* Resumen compacto (móvil) */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-landing-line bg-white p-3.5 md:hidden">
          <div className="flex items-center gap-3">
            {course.image && (
              <div className="h-13 w-16 flex-none overflow-hidden rounded-md">
                <img
                  src={course.image}
                  alt=""
                  className="block size-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <span className="font-black">{course.name}</span>
              <span className="text-landing-muted">
                {course.recipes && `${course.recipes} recetas · `}
                {days}
              </span>
            </div>
            <div className="flex flex-col items-end text-sm">
              {courseStrike && (
                <span className={strike}>${course.normalMxn}</span>
              )}
              <span className="text-base font-black">${course.priceMxn}</span>
            </div>
          </div>
          {bonuses.map((b) => (
            <IncludedCourse key={b.name} course={b} until={until} />
          ))}
        </div>

        <div className="flex flex-col gap-4 md:grow md:basis-110 md:gap-5.5">
          <h1 className="m-0 hidden text-34 font-black tracking-landing-title-md md:block">
            {renewal ? 'Renueva tu acceso' : 'Finaliza tu compra'}
          </h1>

          {stripePromise && !free && (
            <Elements
              stripe={stripePromise}
              options={{
                mode: 'payment',
                amount: total * 100,
                currency: 'mxn',
                allowedPaymentMethodTypes: ['card'],
                // Igual que el cobro del servidor: la tarjeta se guarda para la oferta de /gracias.
                ...(saveCard && { setupFutureUsage: 'on_session' as const }),
                locale: 'es-419',
                fonts: stripeFonts,
                appearance: { variables: { borderRadius: '12px' } },
              }}
            >
              <Wallets
                getBuyer={() => ({
                  email: formRef.current?.correo.value.trim(),
                  name: formRef.current?.nombre.value.trim(),
                })}
                pay={startCardPayment}
                onOwned={(email) => void goToLogin(email)}
                onPaid={(orderId) => {
                  setStage('activating')
                  void goToThanks(orderId)
                }}
                onError={setError}
              />
            </Elements>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="correo" className={label}>
              Correo
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              placeholder="tucorreo@ejemplo.com"
              defaultValue={account?.email}
              required
              disabled={busy || !!account}
              className={input}
            />
            <div className="hidden text-13 text-landing-muted md:block">
              Aquí recibirás tu acceso al curso.
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className={label}>
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Tu nombre completo"
              defaultValue={account?.name}
              required
              disabled={busy || !!account?.nameLocked}
              className={input}
            />
          </div>

          {free && (
            <div className="rounded-12 border-1.5 border-landing-pink-line bg-landing-pink p-3.5 text-sm leading-145 text-landing-muted md:p-4.5 md:text-15">
              <strong className="text-landing-ink">
                No necesitas tarjeta.
              </strong>{' '}
              Tu curso es gratis: solo escribe tu correo y tu nombre.
            </div>
          )}

          <div className={free ? 'hidden' : 'flex flex-col gap-1.5 md:gap-2.5'}>
            <div className={label}>Tarjeta de crédito o débito</div>
            <Elements stripe={stripePromise} options={stripeOptions}>
              <div className="rounded-12 border-1.5 border-landing-field bg-landing-soft p-3.5 md:p-4.5">
                <CardFields
                  busy={busy}
                  onChange={onCardChange}
                  getter={cardGetter}
                />
              </div>
            </Elements>
            {shownError && (
              <div
                ref={errorRef}
                role="alert"
                className="text-sm text-destructive"
              >
                {shownError}
              </div>
            )}
          </div>

          {tools.map((t) => (
            <ToolBump
              key={t.slug}
              tool={t}
              checked={chosen === t.slug}
              // Nada elegido: cada nivel con descuento insiste («¿Seguro que no la quieres?»).
              noneChosen={chosen === null}
              disabled={busy}
              onToggle={() => setChosen(chosen === t.slug ? null : t.slug)}
            />
          ))}

          <button
            type="submit"
            disabled={busy || (!free && !stripe)}
            aria-busy={busy}
            className={`${payBtn} hidden min-h-14.5 text-19 md:flex`}
          >
            {payLabel}
          </button>

          <div className="hidden items-start justify-center gap-2.5 text-13 leading-normal text-landing-muted md:flex">
            <LockIcon className="mt-px size-4.5 flex-none" />
            <span>
              <strong className="text-landing-ink">
                Pago seguro con Stripe.
              </strong>{' '}
              Tus datos viajan cifrados y no guardamos los datos de tu tarjeta.
              Al pagar aceptas los{' '}
              <Link
                to="/terminos"
                target="_blank"
                rel="noopener"
                className="text-landing-muted"
              >
                términos y condiciones
              </Link>
              .
            </span>
          </div>
          <div className="hidden justify-center text-13 text-landing-muted md:flex">
            <span>
              ¿Dudas o aclaraciones? Escríbenos a{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-bold text-landing-primary"
              >
                {SUPPORT_EMAIL}
              </a>
            </span>
          </div>
        </div>

        {/* Resumen (escritorio) */}
        <div className="hidden max-w-100 grow basis-80 flex-col gap-4 rounded-18 border border-landing-line bg-white p-6 md:flex">
          <div className="text-lg font-black">Resumen</div>
          <div className="flex items-center gap-3.5">
            {course.image && (
              <div className="h-16 w-21 flex-none overflow-hidden rounded-lg">
                <img
                  src={course.image}
                  alt=""
                  className="block size-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-0.5 text-15">
              <span className="font-bold">{course.name}</span>
              <span className="text-landing-muted">
                {course.recipes && `${course.recipes} recetas · `}acceso por{' '}
                {days}
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between text-15">
            <span>
              {renewal
                ? 'Renovación'
                : upgradeUntil
                  ? 'Mejora de nivel'
                  : course.label}
            </span>
            <span className="flex items-baseline gap-2">
              {courseStrike && (
                <span className={strike}>{mxn(course.normalMxn)}</span>
              )}
              <span className="font-bold">{mxn(course.priceMxn)}</span>
            </span>
          </div>

          {bonuses.map((b) => (
            <IncludedCourse key={b.name} course={b} until={until} desktop />
          ))}

          {addTool && (
            <div className="flex items-baseline justify-between text-15">
              <span>Herramienta de costos</span>
              <span className="flex items-baseline gap-2">
                <span className={strike}>{mxn(tool.normalMxn)}</span>
                <span className="font-bold">{mxn(tool.priceMxn)}</span>
              </span>
            </div>
          )}

          <div className="h-px bg-landing-line" />
          <div className="flex justify-between text-19 font-black">
            <span>Total</span>
            <span>{mxn(total)}</span>
          </div>
          <div className="text-13 leading-normal text-landing-muted">
            {special && `Precio especial${until ? ` hasta el ${until}` : ''}. `}
            {renewal &&
              `${`Precio de renovación (${course.label === 'Herramienta' ? TOOL_RENEWAL_DISCOUNT_PCT : RENEWAL_DISCOUNT_PCT}% de descuento)`}. Los días que te queden se suman. `}
            {upgradeUntil &&
              `Pagas solo la diferencia con tu nivel actual y conservas tu vencimiento (${upgradeUntil}). `}
            Acceso inmediato.
          </div>
        </div>
      </div>

      {/* Barra de pago (móvil) */}
      <div className="flex flex-col gap-2.5 border-t border-landing-line bg-white px-4 pt-3.5 pb-5 md:hidden">
        <div className="flex justify-between text-17 font-black">
          <span>Total</span>
          <span>{mxn(total)}</span>
        </div>
        <button
          type="submit"
          disabled={busy || (!free && !stripe)}
          aria-busy={busy}
          className={`${payBtn} flex min-h-14 text-lg`}
        >
          {payLabel}
        </button>
        <div className="text-center text-xs leading-140 text-landing-muted">
          <strong className="text-landing-ink">Pago seguro con Stripe.</strong>{' '}
          No guardamos los datos de tu tarjeta. Al pagar aceptas los términos y
          condiciones.
        </div>
        <div className="text-center text-xs text-landing-muted">
          ¿Dudas? Escríbenos a{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-bold text-landing-primary"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </form>
  )
}
