import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getOrder } from '#/lib/checkout'
import { completeOrder, failOrder } from '#/lib/purchases'

// Pantalla de prueba que simula Stripe. Se elimina cuando se integre.
const resolveOrder = createServerFn({ method: 'POST' })
  .validator(z.object({ orderId: z.string(), paid: z.boolean() }))
  .handler(async ({ data }) => {
    if (data.paid) await completeOrder(data.orderId)
    else await failOrder(data.orderId)
  })

export const Route = createFileRoute('/pago-prueba')({
  validateSearch: z.object({ orden: z.string() }),
  loaderDeps: ({ search }) => ({ orderId: search.orden }),
  loader: ({ deps }) => getOrder({ data: { orderId: deps.orderId } }),
  component: TestPayment,
})

function TestPayment() {
  const order = Route.useLoaderData()
  const navigate = useNavigate()

  async function resolve(paid: boolean) {
    await resolveOrder({ data: { orderId: order.id, paid } })
    if (paid) navigate({ to: '/gracias', search: { orden: order.id } })
    else navigate({ to: '/checkout' })
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <p className="text-sm text-muted-foreground">
        Pantalla de prueba (simula Stripe)
      </p>
      <h1 className="mt-2 text-2xl font-bold">${order.amountMxn} MXN</h1>
      <p className="mt-2">
        {order.name} · {order.email}
      </p>
      <ul className="mt-2 list-disc pl-5">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.product.name} · ${item.amountMxn}
          </li>
        ))}
      </ul>
      <p className="mt-2">Estado: {order.status}</p>
      {order.status === 'PENDING' && (
        <div className="mt-6 flex gap-3">
          <button
            className="rounded bg-green-600 px-4 py-2 text-white"
            onClick={() => resolve(true)}
          >
            Pago exitoso
          </button>
          <button
            className="rounded bg-red-600 px-4 py-2 text-white"
            onClick={() => resolve(false)}
          >
            Pago fallido
          </button>
        </div>
      )}
    </div>
  )
}
