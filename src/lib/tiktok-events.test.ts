import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { Server } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ServerEvent } from '#/lib/meta-capi'
import { buildTikTokEvent, sendTikTokEvent } from '#/lib/tiktok-events'
import { dispatchServerEvent, eventFromRequest } from '#/lib/track-core'
import { TIKTOK_EVENT } from '#/lib/tracking-events'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

const base: ServerEvent = {
  name: 'Lead',
  eventId: 'evt-123456',
  time: 1_800_000_000,
  sourceUrl: 'https://capagla.com/clase-gratis',
  email: '  Ana.Lopez@Correo.COM ',
  ip: '189.1.2.3',
  userAgent: 'Mozilla/5.0 test',
  ttp: 'TTP-COOKIE-1',
  ttclid: 'TTCLID-9',
}

describe('TIKTOK_EVENT', () => {
  it('traduce los nombres de la maqueta', () => {
    expect(TIKTOK_EVENT.Lead).toBe('SubmitForm')
    // TikTok ya llama Purchase a la compra (su píxel convierte CompletePayment a Purchase).
    expect(TIKTOK_EVENT.Purchase).toBe('Purchase')
    expect(TIKTOK_EVENT.AddToCart).toBe('AddToCart')
    expect(TIKTOK_EVENT.InitiateCheckout).toBe('InitiateCheckout')
    expect(TIKTOK_EVENT.ViewContent).toBe('ViewContent')
  })
})

describe('buildTikTokEvent', () => {
  it('cifra el correo y no cifra ttp, ttclid, IP ni navegador', () => {
    const ev = buildTikTokEvent(base)
    expect(ev.event).toBe('SubmitForm')
    expect(ev.event_id).toBe('evt-123456')
    expect(ev.event_time).toBe(1_800_000_000)
    expect(ev.page).toEqual({ url: 'https://capagla.com/clase-gratis' })
    expect(ev.user).toEqual({
      email: sha('ana.lopez@correo.com'),
      ip: '189.1.2.3',
      user_agent: 'Mozilla/5.0 test',
      ttp: 'TTP-COOKIE-1',
      ttclid: 'TTCLID-9',
    })
    expect(JSON.stringify(ev)).not.toContain('correo.com')
  })

  it('la compra va como Purchase con valor, moneda y productos', () => {
    const ev = buildTikTokEvent({
      name: 'Purchase',
      eventId: 'purchase-1',
      time: 1,
      params: {
        value: 497,
        contentIds: ['postres-navidad', 'costos'],
        contentName: 'Curso',
      },
    })
    expect(ev.event).toBe('Purchase')
    expect(ev.properties).toEqual({
      value: 497,
      currency: 'MXN',
      content_type: 'product',
      contents: [
        { content_id: 'postres-navidad', quantity: 1 },
        { content_id: 'costos', quantity: 1 },
      ],
      content_name: 'Curso',
    })
  })

  it('sin datos manda solo lo que hay', () => {
    const ev = buildTikTokEvent({ name: 'AddToCart', eventId: 'e', time: 1 })
    expect(ev.user).toEqual({})
    expect(ev.properties).toEqual({})
    expect(ev).not.toHaveProperty('page')
  })
})

describe('sendTikTokEvent', () => {
  let server: Server
  let url = ''
  let reply: { status: number; body: unknown } = {
    status: 200,
    body: { code: 0 },
  }
  const calls: {
    path: string
    token: string | undefined
    body: Record<string, unknown>
  }[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        calls.push({
          path: req.url ?? '',
          token: req.headers['access-token'] as string | undefined,
          body: JSON.parse(raw),
        })
        res.statusCode = reply.status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(reply.body))
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const a = server.address()
    url = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`
  })
  afterAll(() => new Promise((r) => server.close(r)))

  it('manda el evento al píxel con el token en la cabecera y el código de prueba', async () => {
    calls.length = 0
    reply = { status: 200, body: { code: 0, message: 'OK' } }
    const ok = await sendTikTokEvent(
      {
        pixelId: 'PIXEL123',
        token: 'TT-TOKEN',
        testCode: 'TEST9',
        apiUrl: url,
      },
      base,
    )
    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/event/track/')
    expect(calls[0].token).toBe('TT-TOKEN')
    expect(calls[0].body.event_source).toBe('web')
    expect(calls[0].body.event_source_id).toBe('PIXEL123')
    expect(calls[0].body.test_event_code).toBe('TEST9')
    // El token va solo en la cabecera, no en el cuerpo.
    expect(JSON.stringify(calls[0].body)).not.toContain('TT-TOKEN')
    const data = calls[0].body.data as { event: string; event_id: string }[]
    expect(data[0].event).toBe('SubmitForm')
    expect(data[0].event_id).toBe('evt-123456')
  })

  it('TikTok responde 200 con un código de error: cuenta como fallo', async () => {
    reply = {
      status: 200,
      body: { code: 40001, message: 'Invalid access token' },
    }
    expect(
      await sendTikTokEvent({ pixelId: 'P', token: 't', apiUrl: url }, base),
    ).toBe(false)
  })

  it('si no responde o rechaza devuelve false y no lanza', async () => {
    reply = { status: 500, body: {} }
    expect(
      await sendTikTokEvent({ pixelId: 'P', token: 't', apiUrl: url }, base),
    ).toBe(false)
    expect(
      await sendTikTokEvent(
        { pixelId: 'P', token: 't', apiUrl: 'http://127.0.0.1:1' },
        base,
      ),
    ).toBe(false)
  })

  it('dispatchServerEvent manda a las dos plataformas, a una sola o a ninguna', async () => {
    calls.length = 0
    reply = { status: 200, body: { code: 0 } }
    const tiktok = { pixelId: 'P', token: 't', apiUrl: url }
    expect(await dispatchServerEvent({ meta: null, tiktok }, base)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(await dispatchServerEvent({ meta: null, tiktok: null }, base)).toBe(
      false,
    )
    expect(calls).toHaveLength(1)
  })
})

describe('eventFromRequest con TikTok', () => {
  it('lleva la cookie _ttp y el ttclid de la atribución', () => {
    const ev = eventFromRequest(
      { name: 'Lead', eventId: 'evt-abcdef', url: 'https://x.test/' },
      { attribution: { ttclid: 'CLICK-T' }, ttp: 'TTP-1' },
    )
    expect(ev.ttp).toBe('TTP-1')
    expect(ev.ttclid).toBe('CLICK-T')
  })
})
