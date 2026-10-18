import { env } from '#/env'
import type { LinkPurpose, Mail } from '#/lib/mailer'
import { SUPPORT_EMAIL } from '#/lib/mailer'

// Correos de Capagla. La maqueta no trae diseño de correos: se usan los colores y la
// tipografía de la landing, en HTML de tablas con estilos en línea (lo que leen los
// clientes de correo).
const C = {
  bg: '#fdf7fc',
  ink: '#2a1233',
  muted: '#5b4663',
  primary: '#6b18a5',
  line: '#ead9ee',
}
const FONT = "Lato, 'Helvetica Neue', Arial, sans-serif"

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const siteUrl = () => env.BETTER_AUTH_URL.replace(/\/$/, '')

type Block = string

const p = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.muted}">${text}</p>`

const button = (url: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:12px;background:${C.primary}"><a href="${esc(url)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:17px;font-weight:900;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}</a></td></tr></table>`

const quote = (label: string, text: string) =>
  `<div style="margin:0 0 16px;padding:14px 16px;border:1px solid ${C.line};border-radius:12px;background:${C.bg}"><div style="font-size:12px;font-weight:900;letter-spacing:1px;color:${C.primary};margin-bottom:6px">${esc(label)}</div><div style="font-size:15px;line-height:1.55;color:${C.ink};white-space:pre-line">${esc(text)}</div></div>`

function layout(title: string, blocks: Block[]) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};font-family:${FONT}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px;font-size:26px;font-weight:900;color:${C.primary};letter-spacing:-0.5px">Capagla</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:20px;padding:32px 28px">
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;font-weight:900;color:${C.ink};letter-spacing:-0.6px">${esc(title)}</h1>
${blocks.join('\n')}
</td></tr>
<tr><td style="padding:20px 4px;font-size:13px;line-height:1.5;color:${C.muted}">¿Dudas? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.primary}">${SUPPORT_EMAIL}</a>.<br>© Capagla</td></tr>
</table></td></tr></table></body></html>`
}

const expiryNote = (url: string) =>
  p(
    `El botón sirve durante 15 minutos y una sola vez. Si ya no funciona, entra en <a href="${esc(`${siteUrl()}/entrar`)}" style="color:${C.primary}">${esc(siteUrl().replace(/^https?:\/\//, ''))}/entrar</a> con este correo.`,
  ) +
  `<p style="margin:0;font-size:12px;line-height:1.5;color:${C.muted};word-break:break-all">Si el botón no abre, copia este enlace: ${esc(url)}</p>`

// Enlace de acceso (Entrar, clase gratis o compra), según para qué se pidió.
export function accessLinkMail(
  to: string,
  url: string,
  purpose: LinkPurpose,
): Mail {
  const textTail = `\n\nEl enlace sirve 15 minutos y una sola vez. Si ya no funciona, entra en ${siteUrl()}/entrar con este correo.\n\n${url}`
  if (purpose.kind === 'free-class') {
    const title = 'Tu clase gratis está lista'
    return {
      to,
      subject: 'Tu clase gratis de Capagla',
      html: layout(title, [
        p(
          'Gracias por registrarte. Entra con este botón y empieza cuando quieras; no necesitas contraseña.',
        ),
        button(url, 'Ver la clase gratis'),
        expiryNote(url),
      ]),
      text: `${title}\n\nGracias por registrarte. Entra con este enlace y empieza cuando quieras; no necesitas contraseña.${textTail}`,
    }
  }
  if (purpose.kind === 'purchase' && purpose.renewedUntil) {
    const title = '¡Listo, renovaste tu acceso!'
    const list = purpose.items.map((i) => `• ${i}`).join('\n')
    const until = `Tu acceso ahora vence el ${purpose.renewedUntil}. Tu avance sigue donde lo dejaste.`
    return {
      to,
      subject: 'Renovaste tu acceso a Capagla',
      html: layout(title, [
        p('Tu pago se confirmó. Renovaste:'),
        quote('TU RENOVACIÓN', list),
        p(esc(until)),
        button(url, 'Entrar a mi curso'),
        expiryNote(url),
      ]),
      text: `${title}\n\nTu pago se confirmó. Renovaste:\n${list}\n\n${until}${textTail}`,
    }
  }
  if (purpose.kind === 'purchase') {
    const title = '¡Listo, ya tienes tu curso!'
    const list = purpose.items.map((i) => `• ${i}`).join('\n')
    return {
      to,
      subject: 'Tu compra en Capagla: ya tienes acceso',
      html: layout(title, [
        p('Tu pago se confirmó. Esto es lo que incluye tu compra:'),
        quote('TU COMPRA', list),
        p(
          'Entra a tu curso con este botón. No necesitas contraseña; si quieres, puedes crear una desde Mis cursos.',
        ),
        button(url, 'Entrar a mi curso'),
        expiryNote(url),
      ]),
      text: `${title}\n\nTu pago se confirmó. Tu compra incluye:\n${list}\n\nEntra a tu curso con este enlace (no necesitas contraseña).${textTail}`,
    }
  }
  const title = 'Tu enlace para entrar'
  return {
    to,
    subject: 'Tu enlace para entrar a Capagla',
    html: layout(title, [
      p('Pediste entrar a Capagla. Usa este botón; no necesitas contraseña.'),
      button(url, 'Entrar a Capagla'),
      p('Si no fuiste tú, ignora este correo: nadie puede entrar sin abrirlo.'),
      expiryNote(url),
    ]),
    text: `${title}\n\nPediste entrar a Capagla. Usa este enlace; no necesitas contraseña.${textTail}\n\nSi no fuiste tú, ignora este correo.`,
  }
}

// La chef respondió una pregunta de la alumna.
export function answerMail(input: {
  to: string
  lesson: string
  question: string
  answer: string
  lessonPath: string
}): Mail {
  const url = `${siteUrl()}${input.lessonPath}`
  const title = 'Gladis respondió tu pregunta'
  return {
    to: input.to,
    subject: `Respuesta a tu pregunta de «${input.lesson}»`,
    html: layout(title, [
      p(
        `En la lección <strong style="color:${C.ink}">${esc(input.lesson)}</strong>:`,
      ),
      quote('TU PREGUNTA', input.question),
      quote('RESPUESTA DE GLADIS · CHEF', input.answer),
      button(url, 'Ver en la lección'),
    ]),
    text: `${title}\n\nLección: ${input.lesson}\n\nTu pregunta:\n${input.question}\n\nRespuesta de Gladis:\n${input.answer}\n\nVer en la lección: ${url}`,
  }
}

// "Ayuda y reportar un fallo" de Mis cursos: llega a soporte; responder le contesta a la alumna.
export function ticketMail(input: {
  from: string
  kind: string
  detail: string
}): Mail {
  const title = `Reporte: ${input.kind}`
  return {
    to: SUPPORT_EMAIL,
    replyTo: input.from,
    subject: `[Capagla] ${title} · ${input.from}`,
    html: layout(title, [
      p(
        `De <strong style="color:${C.ink}">${esc(input.from)}</strong>. Responde este correo para contestarle.`,
      ),
      quote('DETALLE', input.detail),
    ]),
    text: `${title}\nDe: ${input.from}\n\n${input.detail}`,
  }
}
