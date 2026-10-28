import { describe, expect, it } from 'vitest'

import {
  buyLabel,
  listRow,
  manualBase,
  moveRow,
  neededBase,
  needLabel,
  packsFor,
  productionSummary,
  shareText,
} from '#/lib/cost-shopping'
import type { EngineIngredient } from '#/lib/cost-engine'

const ing = (
  price: number,
  quantity: number,
  unit: EngineIngredient['unit'],
  extra: Partial<EngineIngredient> = {},
): EngineIngredient => ({
  price,
  quantity,
  unit,
  flexible: false,
  sampleCount: null,
  sampleGrams: null,
  wasteEnabled: false,
  yieldPct: null,
  ...extra,
})

// Ingredientes de la lista de la maqueta.
const harina = ing(13, 1000, 'G')
const condensada = ing(16.7, 100, 'G')
const huevo = ing(251, 180, 'PZA', {
  flexible: true,
  sampleCount: 30,
  sampleGrams: 1710,
})
const domo = ing(8.8, 1, 'PZA')

describe('paquetes completos', () => {
  it('Harina: 2,350 g piden 3 × 1,000 g y cuestan $39.00', () => {
    const r = listRow(harina, 2350, 0)
    expect(r.packs).toBe(3)
    expect(r.buyLabel).toBe('3 × 1,000 g')
    expect(r.needLabel).toBe('2,350 g')
    expect(r.cost).toBeCloseTo(39)
  })

  it('Leche condensada: 590 g piden 6 × 100 g y cuestan $100.20', () => {
    const r = listRow(condensada, 590, 0)
    expect(r.buyLabel).toBe('6 × 100 g')
    expect(r.cost).toBeCloseTo(100.2)
  })

  it('Huevo: 28 piezas caben en 1 × 180 pza ($251.00)', () => {
    const r = listRow(huevo, 28, 0)
    expect(r.needLabel).toBe('28 pza')
    expect(r.buyLabel).toBe('1 × 180 pza')
    expect(r.cost).toBeCloseTo(251)
  })

  it('Empaque que se compra de uno en uno: "5 pza" y $44.00', () => {
    const r = listRow(domo, 5, 0)
    expect(r.buyLabel).toBe('5 pza')
    expect(r.cost).toBeCloseTo(44)
  })

  it('justo un paquete es un paquete, y un gramo más piden otro', () => {
    expect(packsFor(harina, 1000)).toBe(1)
    expect(packsFor(harina, 1000.0000001)).toBe(1)
    expect(packsFor(harina, 1001)).toBe(2)
    expect(packsFor(harina, 0)).toBe(0)
  })

  it('lo agregado a mano es la cantidad exacta, sin redondear a paquetes', () => {
    const solo = listRow(harina, 0, 200)
    expect(solo.packs).toBe(0)
    expect(solo.needLabel).toBe('200 g')
    expect(solo.buyLabel).toBe('200 g')
    expect(solo.cost).toBeCloseTo(2.6)
    const junto = listRow(harina, 2350, 200)
    expect(junto.needLabel).toBe('2,550 g')
    expect(junto.buyLabel).toBe('3 × 1,000 g + 200 g')
    expect(junto.cost).toBeCloseTo(41.6)
  })

  it('empaque de uno en uno: lo de producción y lo manual se juntan en piezas', () => {
    expect(listRow(domo, 5, 3).buyLabel).toBe('8 pza')
    expect(listRow(domo, 0, 2).buyLabel).toBe('2 pza')
  })

  it('las piezas se redondean hacia arriba y los gramos al entero', () => {
    expect(needLabel(huevo, 27.2)).toBe('28 pza')
    expect(needLabel(harina, 2349.6)).toBe('2,350 g')
  })

  it('se compra por kilo: etiqueta con su unidad', () => {
    expect(buyLabel(ing(40, 1, 'KG'), 2)).toBe('2 × 1 kg')
  })
})

describe('lo agregado a mano', () => {
  it('kg y l se pasan a la unidad base', () => {
    expect(manualBase(harina, 1.5, 'KG')).toBeCloseTo(1500)
  })

  it('sin desperdicio: se compra la cantidad que se escribe', () => {
    const ocupada = { ...harina, wasteEnabled: true, yieldPct: 50 }
    expect(manualBase(ocupada, 200, 'G')).toBeCloseTo(200)
    expect(neededBase(ocupada, 200, 'G')).toBeCloseTo(400)
  })

  it('el huevo en gramos se pasa a piezas: 342 g = 6 piezas', () => {
    expect(manualBase(huevo, 342, 'G')).toBeCloseTo(6)
    expect(manualBase(huevo, 6, 'PZA')).toBe(6)
  })

  it('sin equivalencia no hay cantidad', () => {
    expect(manualBase(harina, 2, 'PZA')).toBeNull()
  })
})

describe('lo que hace falta de un ingrediente', () => {
  it('kg y l se pasan a gramos y mililitros', () => {
    expect(neededBase(harina, 0.45, 'KG')).toBeCloseTo(450)
  })

  it('el huevo en gramos se pasa a piezas con su peso promedio: 342 g = 6 piezas', () => {
    expect(neededBase(huevo, 342, 'G')).toBeCloseTo(6)
    expect(neededBase(huevo, 6, 'PZA')).toBe(6)
  })

  it('con desperdicio hay que comprar más: 100 g al 80% piden 125 g', () => {
    expect(
      neededBase(
        ing(13, 1000, 'G', { wasteEnabled: true, yieldPct: 80 }),
        100,
        'G',
      ),
    ).toBeCloseTo(125)
  })

  it('una unidad que no corresponde no cuenta', () => {
    expect(neededBase(harina, 2, 'PZA')).toBeNull()
    expect(neededBase(domo, 100, 'G')).toBeNull()
  })
})

describe('resumen de la producción (Pedidos de la semana)', () => {
  // 3 Red Velvet ($423.56 de costo, $520) y 2 pasteles tradicionales ($392.51, $380).
  const redVelvet = {
    cost: 423.56,
    price: 520,
    buy: 118.35,
    labor: 240,
    fixed: 60.1,
    laborHours: 3,
    ovenHours: 2,
  }
  const tradicional = {
    cost: 392.51,
    price: 380,
    buy: 106.1,
    labor: 240,
    fixed: 60.1,
    laborHours: 3,
    ovenHours: 2,
  }
  const s = productionSummary([
    { quantity: 3, metrics: redVelvet },
    { quantity: 2, metrics: tradicional },
  ])

  it('15 h de trabajo y 10 h de horno', () => {
    expect(s.laborHours).toBe(15)
    expect(s.ovenHours).toBe(10)
  })

  it('costo total $2,055.70, ventas $2,320.00 y ganancia $264.30', () => {
    expect(s.cost).toBeCloseTo(2055.7, 1)
    expect(s.sales).toBe(2320)
    expect(s.profit).toBeCloseTo(264.3, 1)
  })

  it('un producto sin costo calculado no suma nada', () => {
    const only = productionSummary([
      { quantity: 3, metrics: redVelvet },
      { quantity: 9, metrics: null },
    ])
    expect(only.cost).toBeCloseTo(1270.68)
  })

  it('sin precio, las ventas de ese producto son 0', () => {
    expect(
      productionSummary([
        { quantity: 2, metrics: { ...redVelvet, price: null } },
      ]).sales,
    ).toBe(0)
  })
})

describe('texto para compartir', () => {
  it('por tienda, solo lo que falta comprar y el total', () => {
    const text = shareText(
      'Pedidos de la semana',
      [
        {
          name: 'Harinero',
          rows: [{ name: 'Harina', buy: '3 × 1,000 g' }],
          subtotal: 39,
        },
        { name: 'Sams', rows: [], subtotal: 0 },
      ],
      39,
    )
    expect(text).toBe(
      'Lista de compra · Pedidos de la semana\n\nHarinero ($39.00)\n• Harina: 3 × 1,000 g\n\nTotal estimado $39.00',
    )
  })
})

describe('arrastrar renglones', () => {
  const row = (id: string, placeKey: string) => ({ ingredientId: id, placeKey })
  const rows = [
    row('a', 'harinero'),
    row('b', 'harinero'),
    row('c', 'sams'),
    row('d', 'harinero'),
  ]
  const ids = (r: { ingredientId: string }[]) =>
    r.map((x) => x.ingredientId).join('')

  it('sobre otro renglón de arriba hacia abajo: queda debajo de él', () => {
    expect(ids(moveRow(rows, 'a', { kind: 'row', id: 'b' }, false))).toBe(
      'bacd',
    )
  })

  it('de abajo hacia arriba: queda encima', () => {
    expect(ids(moveRow(rows, 'd', { kind: 'row', id: 'b' }, false))).toBe(
      'adbc',
    )
  })

  it('en la vista por tienda toma el lugar del renglón sobre el que cae', () => {
    const r = moveRow(rows, 'a', { kind: 'row', id: 'c' }, true)
    expect(ids(r)).toBe('bcad')
    expect(r.find((x) => x.ingredientId === 'a')?.placeKey).toBe('sams')
  })

  it('en la vista por ingrediente conserva su lugar', () => {
    const r = moveRow(rows, 'a', { kind: 'row', id: 'c' }, false)
    expect(r.find((x) => x.ingredientId === 'a')?.placeKey).toBe('harinero')
  })

  it('sobre un grupo se va a ese lugar, después de su último renglón', () => {
    const r = moveRow(rows, 'a', { kind: 'group', key: 'sams' }, true)
    expect(ids(r)).toBe('bcad')
    expect(r.find((x) => x.ingredientId === 'a')?.placeKey).toBe('sams')
  })

  it('sobre un grupo vacío va al final', () => {
    const r = moveRow(rows, 'b', { kind: 'group', key: 'soriana' }, true)
    expect(ids(r)).toBe('acdb')
    expect(r.at(-1)?.placeKey).toBe('soriana')
  })

  it('soltar sobre sí mismo o algo desconocido no cambia nada', () => {
    expect(moveRow(rows, 'a', { kind: 'row', id: 'a' }, true)).toBe(rows)
    expect(moveRow(rows, 'zz', { kind: 'row', id: 'a' }, true)).toBe(rows)
    expect(moveRow(rows, 'a', { kind: 'row', id: 'zz' }, true)).toBe(rows)
  })
})
