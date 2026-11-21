import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { loadStripe } from '@stripe/stripe-js'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import { AuthShell } from '#/components/auth-shell'
import { mxn } from '#/lib/catalog'
import {
  addThanksTool,
  confirmThanksTool,
  getThanksOrder,
} from '#/lib/checkout'
import { track } from '#/lib/track-client'
import { purchaseEventId } from '#/lib/tracking-events'
import { seo, siteUrlFrom } from '#/lib/seo'

export const Route = createFileRoute('/gracias')({
  // Sin orden, con una que no existe o que no inició este navegador → inicio (sin error).
  // La orden propia que aún no está pagada → de vuelta al checkout.
  validateSearch: z.object({ orden: z.string().optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ orderId: search.orden }),
  loader: async ({ deps }) => {
    if (!deps.orderId) throw redirect({ to: '/' })
    const order = await getThanksOrder({ data: { orderId: deps.orderId } })
    if (!order) throw redirect({ to: '/' })
    if (order.status !== 'PAID') throw redirect({ to: '/checkout' })
    return order
  },
  head: ({ matches }) => ({
    meta: seo({
      title: 'Pago exitoso',
      base: siteUrlFrom(matches),
      noindex: true,
    }),
  }),
  component: Gracias,
})

type ThanksOrder = NonNullable<Awaited<ReturnType<typeof getThanksOrder>>>

const primaryBtn =
  'box-border flex min-h-13.5 w-full items-center justify-center rounded-12 border-0 bg-landing-primary text-17 font-black text-white no-underline md:min-h-14.5 md:text-19'

// Video de gracias (Bunny, por HLS), en 16:9 dentro de la página. Solo si hay id en
// `SiteSettings.thanksVideoId`.
function ThanksVideo({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = video.current
    if (!el) return
    let hls: { destroy: () => void } | undefined
    let cancelled = false
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        const player = new Hls()
        player.loadSource(src)
        player.attachMedia(el)
        hls = player
      } else {
        el.src = src
      }
    })
    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])
  return (
    <video
      ref={video}
      controls
      playsInline
      aria-label="Video de gracias"
      className="block aspect-video w-full rounded-xl bg-black md:rounded-16"
    />
  )
}

// A dónde lleva entrar a sus cursos: con sesión, directo; sin ella (cuenta que ya existía), a
// Entrar con su correo.
function accessLink(order: ThanksOrder, slug?: string) {
  if (!order.signedIn) {
    return { to: '/entrar', search: { correo: order.email } } as const
  }
  return slug
    ? ({ to: '/mis-cursos/$slug', params: { slug } } as const)
    : ({ to: '/mis-cursos' } as const)
}

// Accesos a los cursos de la compra (Navidad y Aprende a Costear).
function CourseAccess({ order }: { order: ThanksOrder }) {
  const courses = order.items.filter((i) => i.product.kind === 'COURSE')
  return (
    <div className="box-border flex w-full flex-col gap-2.5 rounded-xl border border-landing-line bg-white p-4 text-left md:gap-3 md:rounded-16 md:p-6">
      <div className="text-15 font-black md:text-base">Tus cursos</div>
      {courses.map((item) => (
        <Link
          key={item.id}
          {...accessLink(order, item.product.slug)}
          className="flex items-center justify-between gap-3 rounded-12 border border-landing-line px-3.5 py-3 text-sm text-landing-ink no-underline md:text-15"
        >
          <span className="font-bold">{item.product.name}</span>
          <span className="flex-none font-black text-landing-primary">
            Empezar
          </span>
        </Link>
      ))}
    </div>
  )
}

// La herramienta con un clic (Cheko, 2026-11-19, Fase 2): se cobra con la tarjeta de la compra.
// Si el banco pide autenticar, Stripe lo muestra aquí mismo. Al pagarse manda su propio Purchase.
function ToolOffer({ order }: { order: ThanksOrder }) {
  const tool = order.tool!
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const discount = Math.round((1 - tool.priceMxn / tool.normalMxn) * 100)
  // «Herramienta de costos · Completo» → «Completo» (como la casilla del checkout).
  const tier = tool.name.split(' · ')[1] ?? ''

  async function add() {
    setBusy(true)
    setError(null)
    try {
      const result = await addThanksTool({ data: { orderId: order.id } })
      if ('error' in result) {
        setError(result.error ?? 'No se pudo cobrar con tu tarjeta.')
        return
      }
      if (result.clientSecret) {
        const stripe = order.stripeKey
          ? await loadStripe(order.stripeKey)
          : null
        if (!stripe) throw new Error()
        const action = await stripe.handleNextAction({
          clientSecret: result.clientSecret,
        })
        if (action.error) {
          setError(action.error.message ?? 'No se pudo cobrar con tu tarjeta.')
          return
        }
        const confirmed = await confirmThanksTool({
          data: { orderId: order.id, upsellId: result.upsellId },
        })
        if (!confirmed.paid) {
          setError('No se pudo cobrar con tu tarjeta. Intenta de nuevo.')
          return
        }
      }
      // Marketing: la segunda compra cuenta aparte, con su valor (el servidor manda la suya con el
      // mismo `eventId`).
      track('Purchase', {
        eventId: purchaseEventId(result.upsellId),
        params: {
          value: result.amountMxn,
          currency: 'MXN',
          transactionId: result.upsellId,
          contentIds: [tool.slug],
          contentName: tool.name,
        },
      })
      setAdded(true)
    } catch {
      setError('No se pudo cobrar con tu tarjeta. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (added) return <ToolAdded order={order} name={tool.name} />

  return (
    <div className="box-border flex w-full flex-col gap-3 rounded-xl border-1.5 border-landing-pink-line bg-landing-pink p-4 text-left md:gap-3.5 md:rounded-16 md:p-6">
      <div className="text-15 font-black md:text-lg">
        {discount > 0
          ? `Agrégala y ahorra ${discount} %`
          : `Agrega la herramienta de costos${tier ? ` ${tier}` : ''}`}
      </div>
      <div className="text-sm leading-145 text-landing-muted md:text-15 md:leading-normal">
        Solo en tu compra de hoy: la herramienta de costos
        {tier ? ` ${tier}` : ''}, que te dice cuánto te cuesta cada postre y en
        cuánto venderlo.
      </div>
      <div className="flex items-baseline gap-2">
        {discount > 0 && (
          <span className="text-sm text-landing-muted line-through md:text-15">
            {mxn(tool.normalMxn)}
          </span>
        )}
        <span className="text-xl font-black md:text-22">
          {mxn(tool.priceMxn)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void add()}
        disabled={busy}
        aria-busy={busy}
        className={`${primaryBtn} cursor-pointer disabled:opacity-70`}
      >
        {busy ? 'Agregando…' : 'Agregar con un clic'}
      </button>
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
      <Link
        {...accessLink(order)}
        className="text-center text-sm font-bold text-landing-muted md:text-15"
      >
        No, gracias, ir a mis cursos
      </Link>
    </div>
  )
}

function ToolAdded({ order, name }: { order: ThanksOrder; name: string }) {
  return (
    <div className="box-border flex w-full flex-col gap-2 rounded-xl border-1.5 border-landing-pink-line bg-landing-pink p-4 text-left md:rounded-16 md:p-6">
      <div className="text-15 font-black md:text-lg">
        Listo, agregamos la {name.replace(' · ', ' ').toLowerCase()}
      </div>
      <div className="text-sm leading-145 text-landing-muted md:text-15">
        Se cobró con la tarjeta de tu compra. Te enviamos el recibo a{' '}
        {order.email}.
      </div>
      <Link
        {...accessLink(order)}
        className="text-sm font-bold text-landing-primary md:text-15"
      >
        Ir a mis cursos
      </Link>
    </div>
  )
}

function Gracias() {
  const order = Route.useLoaderData()
  // Una orden gratis (promoción que regala el curso) no tiene pagos: se listan sus productos.
  const free = order.amountMxn === 0
  // Compra con la oferta de la herramienta (/navidad): accesos a sus cursos y la tarjeta de la
  // herramienta en vez del botón «Empezar el curso».
  const offer = !!order.tool || !!order.toolAdded

  // Marketing: compra confirmada (navegador). El servidor manda la suya con el mismo `eventId`,
  // así que `track` no la repite al servidor. Una renovación no cuenta como compra de anuncio.
  useEffect(() => {
    // Ni una renovación ni una orden gratis cuentan como compra de anuncio.
    if (order.renewal || free) return
    track('Purchase', {
      eventId: purchaseEventId(order.id),
      params: {
        value: order.amountMxn,
        currency: 'MXN',
        transactionId: order.id,
        contentIds: order.items.map((i) => i.product.slug),
        contentName: order.items.map((i) => i.product.name).join(', '),
      },
    })
  }, [order.id, order.renewal, free, order.amountMxn, order.items])

  return (
    <AuthShell logoLink={false}>
      <div className="mx-auto flex w-full max-w-160 flex-col items-center gap-4 px-4 py-7 text-center md:gap-6 md:px-8 md:py-18">
        <div className="flex size-16 items-center justify-center rounded-full bg-landing-ok-soft md:size-18">
          <svg
            viewBox="0 0 24 24"
            className="size-8 fill-none stroke-landing-lock md:size-9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className="m-0 text-3xl leading-110 font-black tracking-landing-title-md md:text-40 md:leading-normal md:tracking-landing-title-2xl">
          ¡Listo, ya tienes tu curso!
        </h1>
        <p className="m-0 text-15 leading-normal text-landing-muted md:text-lg md:leading-155">
          {free ? 'Tu acceso ya está activo.' : 'Tu pago se confirmó.'} También
          te enviamos un correo con un enlace para entrar cuando quieras
          <span className="hidden md:inline"> desde cualquier dispositivo</span>
          .
        </p>

        {order.video && <ThanksVideo src={order.video} />}

        {offer && <CourseAccess order={order} />}
        {order.tool && <ToolOffer order={order} />}
        {order.toolAdded && (
          <ToolAdded order={order} name={order.toolAdded.name} />
        )}

        <div className="box-border flex w-full flex-col gap-2.5 rounded-xl border border-landing-line bg-white p-4 text-left md:gap-3 md:rounded-16 md:p-6">
          <div className="text-15 font-black md:text-base">Tu compra</div>
          {/* Todo lo que incluye la orden, también lo regalado ($0 → «Gratis»): en la promoción
              gratis el curso es justo el renglón de $0 y antes no salía. */}
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-2 text-sm md:text-15"
            >
              <span>{item.product.name}</span>
              <span className="flex-none">
                {item.amountMxn === 0 ? 'Gratis' : mxn(item.amountMxn)}
              </span>
            </div>
          ))}
          <div className="h-px bg-landing-line" />
          <div className="flex justify-between text-base font-black md:text-17">
            <span>{free ? 'Total' : 'Total pagado'}</span>
            <span>{free ? 'Gratis' : mxn(order.amountMxn)}</span>
          </div>
          <div className="text-xs text-landing-muted md:text-13">
            {free ? 'Acceso enviado a' : 'Recibo enviado a'} {order.email}
          </div>
        </div>

        {/* Sin sesión (cuenta que ya existía) entra por el enlace del correo o con su correo. */}
        {!offer && (
          <Link {...accessLink(order)} className={primaryBtn}>
            Empezar el curso
          </Link>
        )}
        <div className="text-13 leading-145 text-landing-muted md:text-sm md:leading-normal">
          ¿No llegó el correo? Revisa tu carpeta de spam o escríbenos desde
          Contacto.
        </div>
      </div>
    </AuthShell>
  )
}
