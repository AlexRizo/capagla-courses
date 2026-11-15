import { describe, expect, it } from 'vitest'

import { accessLinkMail } from '#/lib/emails'

describe('correo de compra', () => {
  it('dice cuántos días dura el acceso y cuándo vence, nunca «de por vida»', () => {
    const mail = accessLinkMail('ana@example.com', 'https://capagla.com/x', {
      kind: 'purchase',
      items: ['Postres para vender en Navidad'],
      access: 'Tu acceso es de 365 días: vence el 15 de noviembre de 2027.',
    })
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('365 días: vence el 15 de noviembre de 2027')
      expect(body).not.toMatch(/por vida|vitalici|para siempre/i)
    }
  })
})
