import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { Server } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildMetaEvent, sendMetaEvent } from '#/lib/meta-capi'
import type { ServerEvent } from '#/lib/meta-capi'
import {
  clientIp,
  dispatchServerEvent,
  eventFromRequest,
  resolveFbc,
  shouldTrack,
} from '#/lib/track-core'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

const base: ServerEvent = {
  name: 'Lead',
  eventId: 'evt-123456',
  time: 1_800_000_000,
  sourceUrl: 'https://capagla.com/clase-gratis',
  email: '  Ana.Lopez@Correo.COM ',
  fullName: 'Ana María López Pérez',
  ip: '189.1.2.3',
  userAgent: 'Mozilla/5.0 test',
  fbp: 'fb.1.1700000000000.123456789',
  fbc: 'fb.1.1700000000000.ABC',
}

describe('buildMetaEvent', () => {
  it('cifra el correo y el nombre, y no cifra fbp, fbc, IP ni navegador', () => {
    const ev = buildMetaEvent(base)
    expect(ev.event_name).toBe('Lead')
    expect(ev.event_id).toBe('evt-123456')
    expect(ev.event_time).toBe(1_800_000_000)
    expect(ev.action_source).toBe('website')
    expect(ev.event_source_url).toBe('https://capagla.com/clase-gratis')
    expect(ev.user_data).toEqual({
      em: [sha('ana.lopez@correo.com')],
      fn: [sha('ana')],
      ln: [sha('maría lópez pérez')],
      client_ip_address: '189.1.2.3',
      client_user_agent: 'Mozilla/5.0 test',
      fbp: 'fb.1.1700000000000.123456789',
      fbc: 'fb.1.1700000000000.ABC',
    })
    // Ningún dato personal en claro.
    expect(JSON.stringify(ev)).not.toContain('Ana')
    expect(JSON.stringify(ev)).not.toContain('correo.com')
  })

  it('sin datos del usuario manda solo lo que hay', () => {
    const ev = buildMetaEvent({ name: 'AddToCart', eventId: 'e1', time: 1 })
    expect(ev.user_data).toEqual({})
    expect(ev).not.toHaveProperty('custom_data')
    expect(ev).not.toHaveProperty('event_source_url')
  })

  it('lleva valor, moneda, nombre e ids del contenido', () => {
    const ev = buildMetaEvent({
      name: 'AddToCart',
      eventId: 'e1',
      time: 1,
      params: {
        value: 497,
        contentName: 'Postres',
        contentIds: ['postres-navidad'],
      },
    })
    expect(ev.custom_data).toEqual({
      value: 497,
      currency: 'MXN',
      content_name: 'Postres',
      content_ids: ['postres-navidad'],
      content_type: 'product',
    })
  })
})

describe('sendMetaEvent', () => {
  let server: Server
  let url = ''
  let status = 200
  const calls: { path: string; body: Record<string, unknown> }[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        calls.push({ path: req.url ?? '', body: JSON.parse(raw) })
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify(
            status === 200
              ? { events_received: 1 }
              : { error: { message: 'x' } },
          ),
        )
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const address = server.address()
    url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  })
  afterAll(() => new Promise((r) => server.close(r)))

  it('manda el evento al píxel con el token y el código de prueba', async () => {
    calls.length = 0
    status = 200
    const ok = await sendMetaEvent(
      {
        pixelId: '999000111',
        token: 'TOKEN-X',
        testCode: 'TEST123',
        apiUrl: url,
      },
      base,
    )
    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/999000111/events')
    expect(calls[0].body.access_token).toBe('TOKEN-X')
    expect(calls[0].body.test_event_code).toBe('TEST123')
    const data = calls[0].body.data as { event_id: string }[]
    expect(data).toHaveLength(1)
    expect(data[0].event_id).toBe('evt-123456')
  })

  it('sin código de prueba no lo manda', async () => {
    calls.length = 0
    await sendMetaEvent({ pixelId: '1', token: 't', apiUrl: url }, base)
    expect(calls[0].body).not.toHaveProperty('test_event_code')
  })

  it('si Meta rechaza o no responde devuelve false y no lanza', async () => {
    status = 400
    expect(
      await sendMetaEvent({ pixelId: '1', token: 't', apiUrl: url }, base),
    ).toBe(false)
    expect(
      await sendMetaEvent(
        { pixelId: '1', token: 't', apiUrl: 'http://127.0.0.1:1' },
        base,
      ),
    ).toBe(false)
  })

  it('dispatchServerEvent: sin Meta conectada no manda nada', async () => {
    calls.length = 0
    status = 200
    expect(await dispatchServerEvent({ meta: null, tiktok: null }, base)).toBe(
      false,
    )
    expect(calls).toHaveLength(0)
    expect(
      await dispatchServerEvent(
        { meta: { pixelId: '1', token: 't', apiUrl: url }, tiktok: null },
        base,
      ),
    ).toBe(true)
  })
})

describe('shouldTrack', () => {
  it('solo con las cookies aceptadas, sin admin ni robots', () => {
    expect(
      shouldTrack({
        consent: 'accepted',
        isAdmin: false,
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(true)
    expect(shouldTrack({ consent: 'rejected', isAdmin: false })).toBe(false)
    expect(shouldTrack({ consent: null, isAdmin: false })).toBe(false)
    expect(shouldTrack({ consent: 'accepted', isAdmin: true })).toBe(false)
    expect(
      shouldTrack({
        consent: 'accepted',
        isAdmin: false,
        userAgent: 'Googlebot/2.1',
      }),
    ).toBe(false)
    expect(
      shouldTrack({
        consent: 'accepted',
        isAdmin: false,
        userAgent: 'facebookexternalhit/1.1',
      }),
    ).toBe(false)
  })
})

describe('resolveFbc', () => {
  it('prefiere la cookie del píxel', () => {
    expect(resolveFbc('fb.1.1.COOKIE', { fbclid: 'CLICK' }, 5)).toBe(
      'fb.1.1.COOKIE',
    )
  })
  it('sin cookie arma el valor con el fbclid y el momento del clic', () => {
    const at = '2026-10-19T18:00:00.000Z'
    expect(resolveFbc(undefined, { fbclid: 'CLICK', at }, 5)).toBe(
      `fb.1.${Date.parse(at)}.CLICK`,
    )
    expect(resolveFbc(undefined, { fbclid: 'CLICK' }, 5)).toBe('fb.1.5.CLICK')
  })
  it('sin ninguno no inventa nada', () => {
    expect(resolveFbc(undefined, null, 5)).toBeUndefined()
    expect(resolveFbc(undefined, { utm_source: 'tiktok' }, 5)).toBeUndefined()
  })
})

describe('eventFromRequest', () => {
  const input = {
    name: 'Lead' as const,
    eventId: 'evt-abcdef',
    url: 'https://x.test/',
  }

  it('usa el correo y el nombre de la sesión si el navegador no los manda', () => {
    const ev = eventFromRequest(
      input,
      { attribution: null, sessionEmail: 's@x.com', sessionName: 'Sofía Ruiz' },
      2_000_000,
    )
    expect(ev.email).toBe('s@x.com')
    expect(ev.fullName).toBe('Sofía Ruiz')
    expect(ev.time).toBe(2000)
  })
  it('lo que manda el navegador tiene prioridad sobre la sesión', () => {
    const ev = eventFromRequest(
      { ...input, email: 'form@x.com' },
      { attribution: null, sessionEmail: 's@x.com' },
    )
    expect(ev.email).toBe('form@x.com')
  })
})

describe('clientIp', () => {
  it('toma la primera dirección de x-forwarded-for', () => {
    expect(clientIp('189.1.2.3, 10.0.0.1')).toBe('189.1.2.3')
    expect(clientIp('  1.1.1.1 ')).toBe('1.1.1.1')
    expect(clientIp(null)).toBeUndefined()
    expect(clientIp('')).toBeUndefined()
  })
})
