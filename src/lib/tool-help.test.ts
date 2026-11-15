import { describe, expect, it } from 'vitest'

import { helpDuration, helpKeyForPath } from '#/lib/tool-help'

describe('ayuda de la herramienta', () => {
  it('el listado y el detalle de una sección comparten su video', () => {
    expect(helpKeyForPath('/herramienta/ingredientes')).toBe('A02')
    expect(helpKeyForPath('/herramienta/ingredientes/abc')).toBe('A02')
    expect(helpKeyForPath('/herramienta/cotizador/xyz')).toBe('A11')
    expect(helpKeyForPath('/herramienta/ajustes')).toBe('A01')
  })

  it('fuera de una sección no hay video', () => {
    expect(helpKeyForPath('/herramienta/ayuda')).toBeNull()
    expect(helpKeyForPath('/herramienta/productosx')).toBeNull()
  })

  it('duración en minutos y segundos', () => {
    expect(helpDuration(90)).toBe('1:30')
    expect(helpDuration(5)).toBe('0:05')
  })
})
