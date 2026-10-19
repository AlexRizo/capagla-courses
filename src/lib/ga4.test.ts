import { describe, expect, it } from 'vitest'

import { GA4_EVENT, ga4Params } from '#/lib/ga4'
import { validTrackingId } from '#/lib/tracking-ids'

describe('GA4_EVENT', () => {
  it('usa los eventos recomendados de GA4', () => {
    expect(GA4_EVENT).toEqual({
      PageView: 'page_view',
      ViewContent: 'view_item',
      Lead: 'generate_lead',
      AddToCart: 'add_to_cart',
      InitiateCheckout: 'begin_checkout',
      Purchase: 'purchase',
    })
  })
})

describe('ga4Params', () => {
  it('lleva valor, moneda y el producto con su nombre', () => {
    expect(
      ga4Params('AddToCart', {
        value: 497,
        contentIds: ['postres-navidad'],
        contentName: 'Postres para vender en Navidad',
      }),
    ).toEqual({
      value: 497,
      currency: 'MXN',
      items: [
        {
          item_id: 'postres-navidad',
          item_name: 'Postres para vender en Navidad',
          quantity: 1,
        },
      ],
    })
  })

  it('con varios productos (una compra) cada uno lleva su id como nombre', () => {
    const p = ga4Params('Purchase', {
      value: 497,
      transactionId: 'ord_1',
      contentIds: ['a', 'b'],
      contentName: 'A, B',
    })
    expect(p.items).toEqual([
      { item_id: 'a', item_name: 'a', quantity: 1 },
      { item_id: 'b', item_name: 'b', quantity: 1 },
    ])
    expect(p.transaction_id).toBe('ord_1')
  })

  it('el id de transacción solo va en la compra', () => {
    expect(ga4Params('AddToCart', { transactionId: 'x' })).toEqual({})
    expect(ga4Params('Purchase', { value: 1 })).toEqual({
      value: 1,
      currency: 'MXN',
    })
  })

  it('sin datos no manda nada', () => {
    expect(ga4Params('PageView')).toEqual({})
    expect(ga4Params('Lead', {})).toEqual({})
  })
})

describe('validTrackingId', () => {
  it('acepta la forma de cada plataforma', () => {
    expect(validTrackingId('meta', '123456789012345')).toBe('123456789012345')
    expect(validTrackingId('tiktok', ' CABC123FAKEPIXEL ')).toBe(
      'CABC123FAKEPIXEL',
    )
    expect(validTrackingId('ga4', 'G-ABC123XYZ9')).toBe('G-ABC123XYZ9')
  })

  it('rechaza lo que no cuadra (acaba en la dirección de un script)', () => {
    expect(validTrackingId('meta', '123"><script>')).toBeNull()
    expect(validTrackingId('meta', 'abc')).toBeNull()
    expect(validTrackingId('tiktok', 'X&lib=evil')).toBeNull()
    expect(validTrackingId('tiktok', '../x')).toBeNull()
    expect(validTrackingId('ga4', 'UA-12345-1')).toBeNull()
    expect(validTrackingId('ga4', 'G-ABC&x=1')).toBeNull()
    expect(validTrackingId('meta', '')).toBeNull()
    expect(validTrackingId('meta', null)).toBeNull()
    expect(validTrackingId('ga4', undefined)).toBeNull()
  })
})
