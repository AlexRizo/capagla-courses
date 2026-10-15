import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { magicLink } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'
import { env } from '#/env'

// Las cuentas se crean solo al comprar (ver lib/purchases.ts), por eso
// ningún método de acceso permite registrarse (disableSignUp).
// Sin servicio de correo todavía: el enlace se imprime en consola.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  // El rol solo lo asigna el servidor (seed); `input: false` impide que llegue del cliente.
  user: {
    additionalFields: {
      role: {
        type: ['ADMIN', 'STUDENT'],
        defaultValue: 'STUDENT',
        input: false,
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        console.log(`[correo] Enlace de acceso para ${email}: ${url}`)
      },
    }),
    tanstackStartCookies(),
  ],
})
