import { describe, expect, it } from 'vitest'

import { momentName } from '#/lib/moment-name'

// Nombre automático al guardar un momento.
const lines = [
  { t: 0, x: 'Hola, bienvenidos a la receta.' },
  {
    t: 30,
    x: '¡vamos a acremar la mantequilla con el azúcar glass hasta que esté cremosa!',
  },
  { t: 90, x: 'ahora agregamos los huevos' },
]
const parts = '0:00 Ingredientes\n1:00 Acremar la mantequilla'

describe('momentName', () => {
  it('usa la parte del video en la que va', () => {
    expect(momentName(parts, lines, 10)).toBe('Ingredientes')
    expect(momentName(parts, lines, 75)).toBe('Acremar la mantequilla')
  })

  it('sin partes, usa las primeras palabras de lo que se dice en ese segundo', () => {
    expect(momentName(null, lines, 95)).toBe('Ahora agregamos los huevos')
    expect(momentName('', lines, 5)).toBe('Hola, bienvenidos a la receta')
  })

  it('recorta a 6 palabras (sin enlaces al final), sin signos en los extremos y con mayúscula inicial', () => {
    expect(momentName(null, lines, 45)).toBe('Vamos a acremar la mantequilla')
  })

  it('usa la línea que ya empezó, aunque no sea la primera de la lista', () => {
    const unordered = [lines[2], lines[0], lines[1]]
    expect(momentName(null, unordered, 31)).toBe(
      'Vamos a acremar la mantequilla',
    )
  })

  it('no deja el nombre colgando de una palabra de enlace', () => {
    const cut = [
      { t: 0, x: 'Y nuestros compañeros de trabajo. Es' },
      { t: 10, x: 'Batidor de mano para hacer nuestra' },
      { t: 20, x: 'de la' },
    ]
    expect(momentName(null, cut, 5)).toBe('Y nuestros compañeros de trabajo')
    expect(momentName(null, cut, 15)).toBe('Batidor de mano para hacer')
    expect(momentName(null, cut, 25)).toBe('De')
  })

  it('cae en "Momento" sin transcripción, sin minutos o antes de la primera línea', () => {
    expect(momentName(null, [], 10)).toBe('Momento')
    expect(momentName(null, [{ t: 0, x: 'Texto plano' }], 10)).toBe('Momento')
    expect(momentName(null, [{ t: 20, x: 'Empieza tarde' }], 5)).toBe('Momento')
    expect(
      momentName(
        null,
        [
          { t: 0, x: '...' },
          { t: 5, x: '¿?' },
        ],
        8,
      ),
    ).toBe('Momento')
  })

  it('no pasa de 40 caracteres', () => {
    const long = [
      { t: 0, x: 'Extraordinariamente' },
      {
        t: 5,
        x: 'electrodomésticos supercalifragilísticos desproporcionados hiperbólicos',
      },
    ]
    expect(momentName(null, long, 8).length).toBeLessThanOrEqual(40)
  })
})
