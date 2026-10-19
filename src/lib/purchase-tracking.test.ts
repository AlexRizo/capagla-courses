import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { buildPurchaseEvent } from '#/lib/purchase-tracking'
import { buildMetaEvent } from '#/lib/meta-capi'
import { parseTrackingContext } from '#/lib/track-core'
import { purchaseEventId } from '#/lib/tracking-events'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const paidAt = new Date('2026-10-19T19:00:00.000Z')

const order = {
  id: 'ord_123',
  email: 'Ana@Correo.com',
  name: 'Ana Pérez',
  amountMxn: 497,
  paidAt,
  attribution: null as unknown,
  trackingContext: {
    ip: '189.1.2.3',
    userAgent: 'Mozilla/5.0',
    fbp: 'fb.1.1.111',
    fbc: 'fb.1.1.AAA',
  } as unknown,
  items: [
    {
      product: {
        slug: 'postres-navidad',
        name: 'Postres para vender en Navidad',
      },
    },
    { product: { slug: 'herramienta-costos', name: 'Herramienta de costos' } },
  ],
}

describe('buildPurchaseEvent', () => {
  it('usa un event_id fijo por orden (el mismo que el píxel de gracias)', () => {
    const ev = buildPurchaseEvent(order)
    expect(ev.eventId).toBe(purchaseEventId('ord_123'))
    expect(ev.eventId).toBe('purchase-ord_123')
    expect(ev.name).toBe('Purchase')
  })

  it('lleva valor, moneda y los productos comprados', () => {
    const ev = buildPurchaseEvent(order)
    expect(ev.params).toEqual({
      value: 497,
      currency: 'MXN',
      contentIds: ['postres-navidad', 'herramienta-costos'],
      contentName: 'Postres para vender en Navidad, Herramienta de costos',
    })
    expect(ev.time).toBe(Math.floor(paidAt.getTime() / 1000))
  })

  it('usa lo guardado al pagar (IP, navegador, fbp, fbc) sin navegador delante', () => {
    const ev = buildPurchaseEvent(order)
    expect(ev).toMatchObject({
      ip: '189.1.2.3',
      userAgent: 'Mozilla/5.0',
      fbp: 'fb.1.1.111',
      fbc: 'fb.1.1.AAA',
    })
    const meta = buildMetaEvent(ev)
    expect(meta.user_data.em).toEqual([sha('ana@correo.com')])
    expect(meta.event_id).toBe('purchase-ord_123')
  })

  it('sin cookie fbc arma la del clic de Meta guardado en la atribución', () => {
    const ev = buildPurchaseEvent({
      ...order,
      trackingContext: { ip: '1.1.1.1' },
      attribution: { fbclid: 'CLICK1', at: '2026-10-18T10:00:00.000Z' },
    })
    expect(ev.fbc).toBe(`fb.1.${Date.parse('2026-10-18T10:00:00.000Z')}.CLICK1`)
  })

  it('un contexto dañado o ausente no rompe el evento', () => {
    expect(
      buildPurchaseEvent({ ...order, trackingContext: null }).ip,
    ).toBeUndefined()
    expect(
      buildPurchaseEvent({ ...order, trackingContext: 'x' }).ip,
    ).toBeUndefined()
    expect(parseTrackingContext({ ip: 5 })).toEqual({})
    expect(buildPurchaseEvent({ ...order, attribution: 'basura' }).fbc).toBe(
      'fb.1.1.AAA',
    )
  })
})
