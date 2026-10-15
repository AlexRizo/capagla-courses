import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthShell } from '#/components/auth-shell'
import { mxn } from '#/lib/catalog'
import { getOrder } from '#/lib/checkout'

export const Route = createFileRoute('/gracias')({
  validateSearch: z.object({ orden: z.string() }),
  loaderDeps: ({ search }) => ({ orderId: search.orden }),
  loader: async ({ deps }) => {
    const order = await getOrder({ data: { orderId: deps.orderId } })
    if (order.status !== 'PAID') throw redirect({ to: '/checkout' })
    return order
  },
  component: Gracias,
})

function Gracias() {
  const order = Route.useLoaderData()
  // El curso de costos gratis no es una línea cobrada: solo se listan los pagos.
  const lines = order.items.filter((item) => item.amountMxn > 0)

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
          Tu pago se confirmó. También te enviamos un correo con un enlace para
          entrar cuando quieras
          <span className="hidden md:inline"> desde cualquier dispositivo</span>
          .
        </p>

        <div className="box-border flex w-full flex-col gap-2.5 rounded-xl border border-landing-line bg-white p-4 text-left md:gap-3 md:rounded-16 md:p-6">
          <div className="text-15 font-black md:text-base">Tu compra</div>
          {lines.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-2 text-sm md:text-15"
            >
              <span>{item.product.name}</span>
              <span className="flex-none">{mxn(item.amountMxn)}</span>
            </div>
          ))}
          <div className="h-px bg-landing-line" />
          <div className="flex justify-between text-base font-black md:text-17">
            <span>Total pagado</span>
            <span>{mxn(order.amountMxn)}</span>
          </div>
          <div className="text-xs text-landing-muted md:text-13">
            Recibo enviado a {order.email}
          </div>
        </div>

        <Link
          to="/mis-cursos"
          className="box-border flex min-h-13.5 w-full items-center justify-center rounded-12 bg-landing-primary text-17 font-black text-white no-underline md:min-h-14.5 md:text-19"
        >
          Empezar el curso
        </Link>
        <div className="text-13 leading-145 text-landing-muted md:text-sm md:leading-normal">
          ¿No llegó el correo? Revisa tu carpeta de spam o escríbenos desde
          Contacto.
        </div>
      </div>
    </AuthShell>
  )
}
