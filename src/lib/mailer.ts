import { AsyncLocalStorage } from 'node:async_hooks'

import { env } from '#/env'

// Correo saliente con Brevo (API de correos transaccionales). Sin `BREVO_API_KEY` o sin
// remitente, el correo solo se escribe en la consola del servidor (como hasta ahora).
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export const SUPPORT_EMAIL = env.SUPPORT_EMAIL ?? 'soporte@capagla.com'

export type Mail = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

export function mailConfigured() {
  return !!env.BREVO_API_KEY && !!env.MAIL_FROM_EMAIL
}

// Nunca lanza: un correo que no sale no debe tumbar una compra ni una respuesta. El fallo
// queda en el registro del servidor.
export async function sendMail(mail: Mail) {
  if (!mailConfigured()) {
    console.log(`[correo] Para ${mail.to} · ${mail.subject}\n${mail.text}`)
    return false
  }
  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: env.MAIL_FROM_NAME ?? 'Capagla',
          email: env.MAIL_FROM_EMAIL,
        },
        to: [{ email: mail.to }],
        replyTo: { email: mail.replyTo ?? SUPPORT_EMAIL },
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
      }),
    })
    if (!response.ok) {
      console.error(
        `[correo] Brevo rechazó el correo a ${mail.to} (${response.status}):`,
        await response.text(),
      )
      return false
    }
    return true
  } catch (error) {
    console.error(`[correo] No se pudo enviar el correo a ${mail.to}:`, error)
    return false
  }
}

// Para qué se pide un enlace de acceso: Better Auth no lo dice al enviar, así que quien lo
// pide lo marca con `withLinkPurpose` y `sendMagicLink` elige el correo.
export type LinkPurpose =
  | { kind: 'login' }
  | { kind: 'free-class' }
  | { kind: 'purchase'; items: string[] }

const linkPurpose = new AsyncLocalStorage<LinkPurpose>()

export const withLinkPurpose = <T>(
  purpose: LinkPurpose,
  fn: () => Promise<T>,
) => linkPurpose.run(purpose, fn)

export const currentLinkPurpose = (): LinkPurpose =>
  linkPurpose.getStore() ?? { kind: 'login' }
