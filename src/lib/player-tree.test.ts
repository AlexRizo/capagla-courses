import { describe, expect, it } from 'vitest'

import { onlyFreeBlocks } from '#/lib/player-tree'

const item = (
  id: string,
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON',
  parentId: string | null,
  isFree = false,
) => ({ id, kind, parentId, isFree })

describe('onlyFreeBlocks', () => {
  const items = [
    item('b1', 'BLOCK', null, true),
    item('c1', 'CHAPTER', 'b1'),
    item('l1', 'LESSON', 'c1'),
    item('l2', 'LESSON', 'b1'),
    item('b2', 'BLOCK', null),
    item('c2', 'CHAPTER', 'b2'),
    item('l3', 'LESSON', 'c2'),
  ]
  it('deja el bloque gratis y todo lo que contiene', () => {
    expect(onlyFreeBlocks(items).map((i) => i.id)).toEqual([
      'b1',
      'c1',
      'l1',
      'l2',
    ])
  })
  it('sin bloques gratis no queda nada', () => {
    expect(onlyFreeBlocks(items.filter((i) => !i.id.endsWith('1')))).toEqual([])
  })
})
