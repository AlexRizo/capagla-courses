import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
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
      // Cuenta suspendida desde el panel (ver lib/admin-users.ts). Solo lectura para el cliente.
      suspendedAt: { type: 'date', required: false, input: false },
    },
  },
  // Una cuenta suspendida no puede abrir sesión por ningún camino (enlace, contraseña o
  // la que se abre al pagar).
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { suspendedAt: true },
          })
          if (user?.suspendedAt) {
            throw new APIError('FORBIDDEN', {
              message: 'Esta cuenta está suspendida.',
            })
          }
        },
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const purpose = currentLinkPurpose()
        if (purpose.kind === 'capture') return purpose.onLink(url)
        await sendMail(accessLinkMail(email, url, purpose))
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
    const session = await auth.api.getSession({ headers })
    // Defensa extra: al suspender se borran sus sesiones, pero una suspendida nunca cuenta.
    return session?.user.suspendedAt ? null : session
  } catch (error) {
    console.error('[sesión] No se pudo leer la sesión:', error)
    return null
  }
}
