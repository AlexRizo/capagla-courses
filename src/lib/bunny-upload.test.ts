import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { titleFromFilename, uploadSignature } from '#/lib/bunny'

// Firma de la subida directa a Bunny (TUS): `sha256(biblioteca + clave + vencimiento + video)`
// en hexadecimal. Si cambia el orden o el formato, Bunny rechaza la subida con 401.
describe('uploadSignature', () => {
  it('es el sha256 hexadecimal de biblioteca, clave, vencimiento y video, en ese orden', () => {
    const expected = createHash('sha256')
      .update('123' + 'clave' + '1700000000' + 'abc')
      .digest('hex')
    expect(uploadSignature('123', 'clave', 1700000000, 'abc')).toBe(expected)
  })

  it('cambia con el video y con el vencimiento, y no contiene la clave', () => {
    const base = uploadSignature('123', 'clave-secreta', 1700000000, 'abc')
    expect(uploadSignature('123', 'clave-secreta', 1700000000, 'abd')).not.toBe(
      base,
    )
    expect(uploadSignature('123', 'clave-secreta', 1700000001, 'abc')).not.toBe(
      base,
    )
    expect(base).toMatch(/^[0-9a-f]{64}$/)
    expect(base).not.toContain('clave-secreta')
  })
})

describe('titleFromFilename', () => {
  it('quita solo la extensión', () => {
    expect(titleFromFilename('01-01_ENJAMBRE.mp4')).toBe('01-01_ENJAMBRE')
    expect(titleFromFilename('clase.final.v2.mov')).toBe('clase.final.v2')
  })

  it('no deja el nombre vacío ni demasiado largo', () => {
    expect(titleFromFilename('.mp4')).toBe('Video')
    expect(titleFromFilename('   ')).toBe('Video')
    expect(titleFromFilename(`${'a'.repeat(300)}.mp4`)).toHaveLength(200)
  })
})
