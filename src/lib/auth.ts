import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { magicLink } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'
import { env } from '#/env'
import { accessLinkMail } from '#/lib/emails'
import { currentLinkPurpose, sendMail } from '#/lib/mailer'

// Las cuentas se crean solo al comprar (ver lib/purchases.ts), por eso
// ningún método de acceso permite registrarse (disableSignUp).
// El enlace de acceso sale por correo (Brevo, `lib/mailer.ts`); sin configurar, en consola.
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
        await sendMail(accessLinkMail(email, url, currentLinkPurpose()))
      },
    }),
    tanstackStartCookies(),
  ],
})

// Sesión de la petición, o `null` si no hay. Better Auth convierte cualquier fallo interno
// al leerla (base caída, cookie de una sesión que ya no existe) en el error "Failed to get
// session"; aquí se trata como "sin sesión" para que las guardas manden a /entrar.
export async function readSession(headers: Headers) {
  try {
    return await auth.api.getSession({ headers })
  } catch (error) {
    console.error('[sesión] No se pudo leer la sesión:', error)
    return null
  }
}
