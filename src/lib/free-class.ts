import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { findFreeLesson } from '#/lib/free-lesson'
import { saveLead } from '#/lib/leads'
import { placeholderName } from '#/lib/account-name'
import {
  ATTRIBUTION_COOKIE,
  attributionJson,
  parseAttribution,
} from '#/lib/attribution'
import { auth } from '#/lib/auth'
import { CONSENT_COOKIE, parseConsent } from '#/lib/consent'
import { withLinkPurpose } from '#/lib/mailer'
import { tooManyAttempts } from '#/lib/rate-limit'
import { clientIp } from '#/lib/track-core'

// La página /clase-gratis solo existe si hay una clase gratis que entregar.
export const requireFreeClass = createServerFn().handler(async () => {
  if (!(await findFreeLesson())) throw notFound()
})

// "Ver la clase gratis": registra el correo como lead (con su aceptación del aviso de privacidad)
// y le manda un enlace para entrar directo a la clase. Responde igual aunque el correo ya exista.
export const joinFreeClass = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().trim().email(),
      consent: z.literal(true),
      // Casilla opcional de novedades (H22).
      newsletter: z.boolean().default(false),
      // Campo trampa invisible: una persona lo deja vacío; un bot que llena todo, no.
      website: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const email = data.email.toLowerCase()
    const ip = clientIp(headers.get('x-forwarded-for')) ?? ''
    // Anti-spam en el servidor: el campo trampa lleno se responde igual que un registro normal,
    // sin crear nada ni mandar correo. Límites: 5 por correo + IP cada 15 min y 20 registros por
    // IP cada hora (que una misma IP no pueda dar de alta correos ajenos en masa).
    if (data.website?.trim()) return { next: 'link' as const }
    if (
      tooManyAttempts(`gratis|${email}|${ip}`) ||
      tooManyAttempts(`gratis-ip|${ip}`, 20, 60 * 60 * 1000)
    ) {
      return { next: 'blocked' as const }
    }

    const lesson = await findFreeLesson()
    if (!lesson) throw notFound()

    const ctx = await auth.$context
    const existing = await ctx.internalAdapter.findUserByEmail(email)
    // Sin cuenta se crea una sin contraseña; el correo se da por verificado al abrir el enlace.
    const user =
      existing?.user ??
      (await ctx.internalAdapter.createUser(
        { email, name: placeholderName(email), emailVerified: false },
        { method: 'free-class' },
      ))
    // Si llegó por un anuncio, el lead guarda esa atribución (la primera, no se pisa después).
    const attribution = parseAttribution(getCookie(ATTRIBUTION_COOKIE))
    const consent = parseConsent(getCookie(CONSENT_COOKIE))
    await saveLead({
      email,
      userId: user.id,
      newsletter: data.newsletter,
      attribution: attributionJson(attribution),
      marketingConsent: consent === null ? undefined : consent === 'accepted',
    })

    await withLinkPurpose({ kind: 'free-class' }, () =>
      auth.api.signInMagicLink({
        body: {
          email,
          callbackURL: `/mis-cursos/${lesson.slug}/${lesson.lessonId}`,
        },
        headers,
      }),
    )
    return { next: 'link' as const }
  })
