import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { tooManyAttempts } from '#/lib/rate-limit'

// Primer paso de "Entrar". Devuelve 'password' solo si el correo tiene
// contraseña; en cualquier otro caso (sin contraseña o sin cuenta) responde
// igual, 'link', y solo envía el enlace si la cuenta existe.
export const startLogin = createServerFn({ method: 'POST' })
  .validator(
    z.object({ email: z.string().email(), forceLink: z.boolean().optional() }),
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const email = data.email.trim().toLowerCase()
    const ip = headers.get('x-forwarded-for') ?? ''

    if (tooManyAttempts(`${email}|${ip}`)) return { next: 'blocked' as const }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { where: { providerId: 'credential' } } },
    })

    // Una cuenta suspendida se trata como si no existiera: misma respuesta y sin correo.
    if (user?.suspendedAt) return { next: 'link' as const }

    if (user?.accounts.length && !data.forceLink) {
      return { next: 'password' as const }
    }

    // Better Auth generaría y enviaría el enlace aunque la cuenta no exista
    // (solo lo rechaza al abrirlo), así que aquí solo se envía a cuentas reales.
    if (user) {
      await auth.api.signInMagicLink({
        body: { email, callbackURL: '/mis-cursos' },
        headers,
      })
    }
    return { next: 'link' as const }
  })
