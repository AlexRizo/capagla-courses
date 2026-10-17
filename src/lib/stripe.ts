import Stripe from 'stripe'

import { env } from '#/env'

let client: Stripe | undefined

// Cliente de Stripe (solo servidor). Sin `STRIPE_SECRET_KEY` en `.env` no se puede cobrar.
export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Falta STRIPE_SECRET_KEY en .env.')
  }
  return (client ??= new Stripe(env.STRIPE_SECRET_KEY))
}
