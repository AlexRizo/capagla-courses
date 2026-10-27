import { describe, expect, it } from 'vitest'

import { buildPlayerTree, groupMoments, onlyFreeItems } from '#/lib/player-tree'

const item = (
  id: string,
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON',
  parentId: string | null,
  isFree = false,
) => ({ id, kind, parentId, isFree })

describe('onlyFreeItems', () => {
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
    expect(onlyFreeItems(items).map((i) => i.id)).toEqual([
      'b1',
      'c1',
      'l1',
      'l2',
    ])
  })
  it('sin bloques gratis no queda nada', () => {
    expect(onlyFreeItems(items.filter((i) => !i.id.endsWith('1')))).toEqual([])
  })
  it('un capítulo gratis deja su contenido y su bloque como contenedor', () => {
    const mixed = [
      item('b1', 'BLOCK', null),
      item('c1', 'CHAPTER', 'b1', true),
      item('l1', 'LESSON', 'c1'),
      item('c2', 'CHAPTER', 'b1'),
      item('l2', 'LESSON', 'c2'),
      item('l3', 'LESSON', 'b1'),
      item('b2', 'BLOCK', null),
      item('c3', 'CHAPTER', 'b2'),
    ]
    expect(onlyFreeItems(mixed).map((i) => i.id)).toEqual(['b1', 'c1', 'l1'])
  })
})

describe('groupMoments', () => {
  const items: Parameters<typeof buildPlayerTree>[0] = [
    {
      id: 'b1',
      parentId: null,
      kind: 'BLOCK',
      isFree: false,
      position: 0,
      title: 'Introducción',
      lessonType: null,
      durationSec: null,
    },
    {
      id: 'l1',
      parentId: 'b1',
      kind: 'LESSON',
      isFree: false,
      position: 1,
      title: 'Bienvenida',
      lessonType: 'VIDEO',
      durationSec: 60,
    },
    {
      id: 'b2',
      parentId: null,
      kind: 'BLOCK',
      isFree: false,
      position: 2,
      title: 'Postres',
      lessonType: null,
      durationSec: null,
    },
    {
      id: 'c1',
      parentId: 'b2',
      kind: 'CHAPTER',
      isFree: false,
      position: 3,
      title: 'Cupcake',
      lessonType: null,
      durationSec: null,
    },
    {
      id: 'l2',
      parentId: 'c1',
      kind: 'LESSON',
      isFree: false,
      position: 4,
      title: 'Procedimiento',
      lessonType: 'VIDEO',
      durationSec: 600,
    },
    {
      id: 'l3',
      parentId: 'c1',
      kind: 'LESSON',
      isFree: false,
      position: 5,
      title: 'Decorado',
      lessonType: 'VIDEO',
      durationSec: 600,
    },
  ]
  const { tree, order } = buildPlayerTree(items, new Set())
  const m = (id: string, itemId: string, seconds: number) => ({
    id,
    itemId,
    seconds,
    name: `n${id}`,
  })

  it('agrupa por bloque y lección en el orden del curso, y por minuto dentro de la lección', () => {
    const groups = groupMoments(tree, order, [
      m('1', 'l3', 30),
      m('2', 'l2', 200),
      m('3', 'l2', 20),
      m('4', 'l1', 5),
    ])
    expect(groups.map((g) => g.blockTitle)).toEqual(['Introducción', 'Postres'])
    expect(groups[1].lessons.map((l) => l.title)).toEqual([
      'Procedimiento',
      'Decorado',
    ])
    expect(groups[1].lessons[0].moments.map((x) => x.seconds)).toEqual([
      20, 200,
    ])
    expect(groups[1].lessons[0].chapterTitle).toBe('Cupcake')
    expect(groups[0].lessons[0].chapterTitle).toBeNull()
  })

  it('omite lecciones y bloques sin momentos y momentos de lecciones que no puede ver', () => {
    expect(groupMoments(tree, order, [])).toEqual([])
    const groups = groupMoments(tree, order, [
      m('1', 'l3', 30),
      m('2', 'otra', 5),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].lessons.map((l) => l.lessonId)).toEqual(['l3'])
  })
})
