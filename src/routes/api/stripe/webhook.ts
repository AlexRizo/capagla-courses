import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { handleStripeEvent } from '#/lib/purchases'
import { getStripe } from '#/lib/stripe'

// Webhook de Stripe: confirma pagos (`payment_intent.succeeded`) y rechazos
// (`payment_intent.payment_failed`). La firma se valida con el cuerpo sin tocar.
// En desarrollo: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!env.STRIPE_WEBHOOK_SECRET) {
          return new Response('Webhook sin configurar', { status: 501 })
        }
        const signature = request.headers.get('stripe-signature')
        if (!signature) return new Response('Falta la firma', { status: 400 })

        const body = await request.text()
        let event
        try {
          event = getStripe().webhooks.constructEvent(
            body,
            signature,
            env.STRIPE_WEBHOOK_SECRET,
          )
        } catch {
          return new Response('Firma inválida', { status: 400 })
        }

        try {
          await handleStripeEvent(event)
        } catch (error) {
          // 500 para que Stripe reintente.
          console.error('[stripe] Falló el evento', event.type, error)
          return new Response('Error', { status: 500 })
        }
        return Response.json({ received: true })
      },
    },
  },
})
