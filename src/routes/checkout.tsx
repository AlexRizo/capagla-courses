import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { COURSE_LIST_PRICE_MXN, TOOL_BUMP_PRICE_MXN, mxn } from '#/lib/catalog'
import { getCheckoutData, startCheckout } from '#/lib/checkout'

export const Route = createFileRoute('/checkout')({
  loader: () => getCheckoutData(),
  component: Checkout,
})

const label = 'text-sm font-bold md:text-15'
const input =
  'box-border h-12.5 rounded-12 border-1.5 border-landing-field bg-white px-3.5 text-base text-landing-ink md:h-13 md:px-4 md:text-17'
const payBtn =
  'cursor-pointer items-center justify-center rounded-12 border-none bg-landing-primary font-black text-white no-underline'
const strike = 'text-landing-strike line-through'

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

function FreeCourse({ desktop }: { desktop?: boolean }) {
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
        INCLUIDO GRATIS
      </div>
      <div
        className={`flex justify-between gap-2 ${desktop ? 'items-baseline text-15' : 'text-sm'}`}
      >
        <span className="font-bold">
          {desktop
            ? 'Curso: cómo calcular costos de tus postres'
            : 'Curso: cómo calcular costos'}
        </span>
        <span
          className={`flex flex-none gap-1.5 ${desktop ? 'items-baseline md:gap-2' : ''}`}
        >
          <span className={strike}>[valor real]</span>
          <span className="font-black">Gratis</span>
        </span>
      </div>
      <div className={`text-landing-muted ${desktop ? 'text-13' : 'text-xs'}`}>
        Gratis solo hasta el 17 de noviembre.
      </div>
    </div>
  )
}

function Checkout() {
  const { course, tool } = Route.useLoaderData()
  const navigate = useNavigate()
  const [withTool, setWithTool] = useState(true)
  const [loading, setLoading] = useState(false)

  const total = course.priceMxn + (withTool ? TOOL_BUMP_PRICE_MXN : 0)
  const payText = `Pagar ${mxn(total)}`

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setLoading(true)
    const orderId = await startCheckout({
      data: { email: form.correo.value, name: form.nombre.value, withTool },
    })
    navigate({ to: '/pago-prueba', search: { orden: orderId } })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-screen flex-col bg-landing-page font-sans text-landing-ink"
    >
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
            <div className="h-13 w-16 flex-none overflow-hidden rounded-md">
              <img
                src="/images/postres-navidad.jpg"
                alt=""
                className="block size-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <span className="font-black">{course.name}</span>
              <span className="text-landing-muted">11 recetas · 365 días</span>
            </div>
            <div className="flex flex-col items-end text-sm">
              <span className={strike}>${COURSE_LIST_PRICE_MXN}</span>
              <span className="text-base font-black">${course.priceMxn}</span>
            </div>
          </div>
          <FreeCourse />
        </div>

        <div className="flex flex-col gap-4 md:grow md:basis-110 md:gap-5.5">
          <h1 className="m-0 hidden text-34 font-black tracking-landing-title-md md:block">
            Finaliza tu compra
          </h1>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="correo" className={label}>
              Correo
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              placeholder="tucorreo@ejemplo.com"
              required
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
              required
              className={input}
            />
          </div>

          <div
            className={`flex items-start gap-3 rounded-xl border-1.5 p-3.5 md:gap-3.5 md:p-4.5 ${
              withTool
                ? 'border-landing-pink-line bg-landing-pink'
                : 'border-landing-warn-line bg-landing-warn'
            }`}
          >
            <input
              id="bump"
              type="checkbox"
              checked={withTool}
              onChange={() => setWithTool(!withTool)}
              className="mt-0.5 size-5.5 flex-none accent-landing-primary md:mt-0.75"
            />
            <label
              htmlFor="bump"
              className="flex flex-col gap-1 text-sm leading-145 md:gap-1.5 md:text-15 md:leading-normal"
            >
              <span className="text-15 font-black md:text-base">
                {withTool
                  ? 'Agrega la herramienta de costos con 50% de descuento'
                  : '¿Seguro que no la quieres?'}
              </span>
              <span className="text-landing-muted">
                {withTool ? (
                  <>
                    <span className="md:hidden">
                      Normalmente cuesta más. Si la agregas ahora, te llevas un
                      descuento especial.
                    </span>
                    <span className="hidden md:inline">
                      Normalmente cuesta más, pero si la agregas ahora te llevas
                      un descuento especial. Se suma a tu compra.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="md:hidden">
                      Esta promoción no se repite: después cuesta $
                      {tool.priceMxn}. Marca la casilla para conservar tu
                      descuento.
                    </span>
                    <span className="hidden md:inline">
                      Esta promoción no se repite: después la herramienta cuesta
                      ${tool.priceMxn}. Marca la casilla para conservar tu
                      descuento.
                    </span>
                  </>
                )}
              </span>
              <span className="flex items-baseline gap-2">
                <span className={strike}>{mxn(tool.priceMxn)}</span>
                <span className="text-base font-black md:text-lg">
                  {mxn(TOOL_BUMP_PRICE_MXN)}
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${payBtn} hidden min-h-14.5 text-19 md:flex`}
          >
            {payText}
          </button>

          <div className="hidden items-start justify-center gap-2.5 text-13 leading-normal text-landing-muted md:flex">
            <LockIcon className="mt-px size-4.5 flex-none" />
            <span>
              <strong className="text-landing-ink">
                Pago seguro con Stripe.
              </strong>{' '}
              Tus datos viajan cifrados y no guardamos los datos de tu tarjeta.
              Al pagar aceptas los{' '}
              <a href="#" className="text-landing-muted">
                términos y condiciones
              </a>
              .
            </span>
          </div>
        </div>

        {/* Resumen (escritorio) */}
        <div className="hidden max-w-100 grow basis-80 flex-col gap-4 rounded-18 border border-landing-line bg-white p-6 md:flex">
          <div className="text-lg font-black">Resumen</div>
          <div className="flex items-center gap-3.5">
            <div className="h-16 w-21 flex-none overflow-hidden rounded-lg">
              <img
                src="/images/postres-navidad.jpg"
                alt=""
                className="block size-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 text-15">
              <span className="font-bold">{course.name}</span>
              <span className="text-landing-muted">
                11 recetas · acceso por 365 días
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between text-15">
            <span>Curso</span>
            <span className="flex items-baseline gap-2">
              <span className={strike}>{mxn(COURSE_LIST_PRICE_MXN)}</span>
              <span className="font-bold">{mxn(course.priceMxn)}</span>
            </span>
          </div>

          <FreeCourse desktop />

          {withTool && (
            <div className="flex items-baseline justify-between text-15">
              <span>Herramienta de costos</span>
              <span className="flex items-baseline gap-2">
                <span className={strike}>{mxn(tool.priceMxn)}</span>
                <span className="font-bold">{mxn(TOOL_BUMP_PRICE_MXN)}</span>
              </span>
            </div>
          )}

          <div className="h-px bg-landing-line" />
          <div className="flex justify-between text-19 font-black">
            <span>Total</span>
            <span>{mxn(total)}</span>
          </div>
          <div className="text-13 leading-normal text-landing-muted">
            Precio especial hasta el 17 de noviembre. Acceso inmediato.
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
          disabled={loading}
          className={`${payBtn} flex min-h-14 text-lg`}
        >
          {payText}
        </button>
        <div className="text-center text-xs leading-140 text-landing-muted">
          <strong className="text-landing-ink">Pago seguro con Stripe.</strong>{' '}
          No guardamos los datos de tu tarjeta. Al pagar aceptas los términos y
          condiciones.
        </div>
      </div>
    </form>
  )
}
