import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { Server } from 'node:http'

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { prisma } from '#/db'
import { trackPurchase } from '#/lib/purchase-tracking'
import { completeOrder, createOrder } from '#/lib/purchases'
import { resetDb, seedCatalog } from '#/test/db'

// La compra confirmada sale a Meta y TikTok (ver `lib/purchase-tracking.ts`). Las plataformas son
// un servidor falso local: aquí se comprueba qué se manda y, sobre todo, cuándo NO se manda.
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

type Call = { path: string; token?: string; body: Record<string, any> }
const calls: Call[] = []
const meta = () => calls.filter((c) => c.path.endsWith('/events'))
const tiktok = () => calls.filter((c) => c.path === '/event/track/')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let server: Server
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
      res.setHeader('content-type', 'application/json')
      res.end(
        req.url === '/event/track/' ? '{"code":0}' : '{"events_received":1}',
      )
    })
  })
  await new Promise<void>((r) => server.listen(47631, '127.0.0.1', r))
})
afterAll(() => new Promise((r) => server.close(r)))

const context = {
  ip: '189.5.6.7',
  userAgent: 'Mozilla/5.0 (X11; Linux) Chrome',
  fbp: 'fb.1.1700000000000.42',
  fbc: 'fb.1.1700000000000.ZZZ',
  ttp: 'TTP-COOKIE-42',
}
const attribution = { utm_source: 'meta', fbclid: 'ZZZ', ttclid: 'TTCLICK-7' }

async function connectPlatforms(over: object = {}) {
  await prisma.marketingSettings.upsert({
    where: { id: 'main' },
    create: {
      id: 'main',
      metaPixelId: '555000111',
      metaToken: 'META-TOKEN',
      metaTestCode: 'TESTX',
      tiktokPixelId: 'TTPIX999',
      tiktokToken: 'TT-TOKEN',
      tiktokTestCode: 'TTTEST',
      ...over,
    },
    update: over,
  })
}

async function buy(
  email: string,
  extra: Parameters<typeof createOrder>[0] extends infer T
    ? Partial<T>
    : never = {},
) {
  const order = await createOrder({
    email,
    name: 'Ana Pérez',
    withTool: false,
    marketingConsent: true,
    trackingContext: context,
    attribution,
    ...extra,
  })
  await completeOrder(order.id)
  return order
}

beforeEach(async () => {
  await resetDb()
  await seedCatalog()
  await connectPlatforms()
  calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('compra confirmada → Meta y TikTok', () => {
  it('manda una compra a cada plataforma, con el mismo event_id y sin datos personales en claro', async () => {
    const order = await buy('ana@test.com')
    await vi.waitFor(() => expect(calls).toHaveLength(2))

    const m = meta()[0]
    expect(m.path).toBe('/555000111/events')
    expect(m.body.access_token).toBe('META-TOKEN')
    expect(m.body.test_event_code).toBe('TESTX')
    const me = m.body.data[0]
    expect(me).toMatchObject({
      event_name: 'Purchase',
      event_id: `purchase-${order.id}`,
    })
    expect(me.custom_data).toMatchObject({
      value: 897,
      currency: 'MXN',
      content_ids: ['postres-navidad'],
    })
    expect(me.user_data).toMatchObject({
      em: [sha('ana@test.com')],
      client_ip_address: context.ip,
      client_user_agent: context.userAgent,
      fbp: context.fbp,
      fbc: context.fbc,
    })

    const t = tiktok()[0]
    expect(t.token).toBe('TT-TOKEN')
    expect(t.body.event_source_id).toBe('TTPIX999')
    expect(t.body.test_event_code).toBe('TTTEST')
    expect(JSON.stringify(t.body)).not.toContain('TT-TOKEN')
    const te = t.body.data[0]
    expect(te).toMatchObject({
      event: 'Purchase',
      event_id: `purchase-${order.id}`,
    })
    expect(te.properties.value).toBe(897)
    expect(te.user).toMatchObject({
      email: sha('ana@test.com'),
      ip: context.ip,
      ttp: context.ttp,
      ttclid: 'TTCLICK-7',
    })

    for (const call of calls) {
      const text = JSON.stringify(call.body)
      expect(text).not.toContain('ana@test.com')
      expect(text).not.toContain('Ana Pérez')
    }
  })

  it('confirmar otra vez la misma orden no repite el evento', async () => {
    const order = await buy('ana@test.com')
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    await completeOrder(order.id)
    await sleep(200)
    expect(calls).toHaveLength(2)
  })

  it('sin consentimiento (rechazó o no eligió) no se manda nada', async () => {
    await buy('a@test.com', { marketingConsent: false, trackingContext: null })
    await buy('b@test.com', { marketingConsent: null, trackingContext: null })
    await sleep(250)
    expect(calls).toHaveLength(0)
  })

  it('una renovación no se manda', async () => {
    const order = await buy('ana@test.com')
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    calls.length = 0
    await prisma.order.update({
      where: { id: order.id },
      data: { renewal: true },
    })
    expect(await trackPurchase(order.id)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('la compra de una admin probando no se manda', async () => {
    const order = await buy('ana@test.com')
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    calls.length = 0
    await prisma.user.updateMany({
      where: { email: 'ana@test.com' },
      data: { role: 'ADMIN' },
    })
    expect(await trackPurchase(order.id)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('una orden sin pagar no se manda', async () => {
    const pending = await createOrder({
      email: 'ana@test.com',
      name: 'Ana',
      withTool: false,
      marketingConsent: true,
    })
    expect(await trackPurchase(pending.id)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('una plataforma sin token no estorba a la otra', async () => {
    await connectPlatforms({ metaToken: '' })
    await buy('ana@test.com')
    await vi.waitFor(() => expect(tiktok()).toHaveLength(1))
    await sleep(150)
    expect(meta()).toHaveLength(0)
  })

  it('sin ninguna plataforma conectada no sale nada', async () => {
    await prisma.marketingSettings.deleteMany()
    await buy('ana@test.com')
    await sleep(250)
    expect(calls).toHaveLength(0)
  })
})

describe('con las plataformas caídas', () => {
  it('la compra se completa igual', async () => {
    // Se apaga el servidor falso: los envíos fallan como si Meta y TikTok no respondieran.
    await new Promise((r) => server.close(r))
    try {
      const order = await buy('ana@test.com')
      await sleep(400)
      const paid = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      })
      expect(paid.status).toBe('PAID')
      expect(await prisma.enrollment.count()).toBeGreaterThan(0)
      // El fallo quedó en el registro (una vez por plataforma) y no tumbó nada.
      expect(console.error).toHaveBeenCalledTimes(2)
      expect(calls).toHaveLength(0)
    } finally {
      await new Promise<void>((r) => server.listen(47631, '127.0.0.1', r))
    }
  })
})
