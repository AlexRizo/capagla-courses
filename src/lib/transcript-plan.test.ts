import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { courseTreeFromMap } from '../../prisma/course-map'
import type { MapEntry } from '../../prisma/course-map'
import type { SeedItem } from '../../prisma/course-tree'
import { HELD_BACK, planTranscripts } from '../../prisma/transcript-plan'
import type { PlanLesson, VideoName } from '../../prisma/transcript-plan'

// A qué lecciones va cada archivo de transcripción (`pnpm db:import-transcripts`).
const lesson = (
  id: string,
  title: string,
  bunnyVideoId: string | null = null,
  parent: PlanLesson['parent'] = null,
): PlanLesson => ({ id, title, bunnyVideoId, parent })

describe('planTranscripts', () => {
  const videos: VideoName[] = [
    { vimeo_nombre: '03-01_CUPCAKE', bunny_guid: 'guid-a' },
    { vimeo_nombre: '09-03_HORNEADO', bunny_guid: 'guid-b' },
    { vimeo_nombre: '06-01_BROWNIE_INTRODUCCION', bunny_guid: 'guid-c' },
    { vimeo_nombre: '99-99_SIN_LECCION', bunny_guid: 'guid-z' },
  ]

  it('por nombre de Vimeo: a todas las lecciones que usan ese video', () => {
    const lessons = [
      lesson('1', 'Procedimiento', 'guid-a'),
      lesson('2', 'Horneado', 'guid-b'),
      lesson('3', 'Horneado', 'guid-b'),
      lesson('4', 'Horneado', 'guid-b'),
    ]
    const plan = planTranscripts(
      ['03-01_cupcake', '09-03_HORNEADO'],
      lessons,
      videos,
    )
    expect(plan.assigned).toEqual([
      { name: '03-01_cupcake', lessonIds: ['1'] },
      { name: '09-03_HORNEADO', lessonIds: ['2', '3', '4'] },
    ])
    expect(plan.skipped).toEqual([])
    expect(plan.withoutTranscript).toEqual([])
  })

  it('una transcripción retenida no se carga y su lección avisa que se queda sin ella', () => {
    const lessons = [lesson('1', 'Introducción', 'guid-c')]
    const held = { '06-01_brownie_introduccion': 'pendiente de revisar' }
    const plan = planTranscripts(
      ['06-01_BROWNIE_INTRODUCCION'],
      lessons,
      videos,
      held,
    )
    expect(plan.assigned).toEqual([])
    expect(plan.skipped).toEqual([
      { name: '06-01_BROWNIE_INTRODUCCION', reason: 'pendiente de revisar' },
    ])
    expect(plan.withoutTranscript.map((l) => l.id)).toEqual(['1'])
  })

  it('hoy no hay ninguna retenida: la de 06-01 se carga aunque no coincida con su video', () => {
    expect(HELD_BACK).toEqual({})
    const lessons = [lesson('1', 'Introducción', 'guid-c')]
    const plan = planTranscripts(
      ['06-01_BROWNIE_INTRODUCCION'],
      lessons,
      videos,
    )
    expect(plan.assigned).toEqual([
      { name: '06-01_BROWNIE_INTRODUCCION', lessonIds: ['1'] },
    ])
  })

  it('un video del mapa que ninguna lección usa no se carga', () => {
    const plan = planTranscripts(['99-99_SIN_LECCION'], [], videos)
    expect(plan.skipped).toEqual([
      {
        name: '99-99_SIN_LECCION',
        reason: 'su video no está en ninguna lección',
      },
    ])
  })

  it('sin nombre de Vimeo: por id, GUID, título o "Capítulo Lección", solo si es una', () => {
    const chapter = { kind: 'CHAPTER', title: 'Brownie' }
    const lessons = [
      lesson('abc', 'Receta', null, chapter),
      lesson('def', 'Horneado', 'guid-x', chapter),
      lesson('ghi', 'Horneado', 'guid-y', { kind: 'CHAPTER', title: 'Roles' }),
      lesson('jkl', 'Quién soy'),
    ]
    const plan = planTranscripts(
      ['abc', 'GUID-X', 'quién soy', 'Roles - Horneado', 'Horneado', 'otra'],
      lessons,
      [],
    )
    expect(plan.assigned).toEqual([
      { name: 'abc', lessonIds: ['abc'] },
      { name: 'GUID-X', lessonIds: ['def'] },
      { name: 'quién soy', lessonIds: ['jkl'] },
      { name: 'Roles - Horneado', lessonIds: ['ghi'] },
    ])
    expect(plan.skipped).toEqual([
      { name: 'Horneado', reason: 'coincide con varias lecciones' },
      { name: 'otra', reason: 'sin lección' },
    ])
  })
})

// Con los datos reales del cliente: el mapa, el árbol que sale de él y las 52 transcripciones.
describe('transcripciones reales contra el curso rearmado', () => {
  const read = (file: string) =>
    JSON.parse(readFileSync(`prisma/data/${file}`, 'utf8'))
  const map = read('mapa-videos.json') as (MapEntry & {
    vimeo_nombre: string
  })[]
  const flat = (items: SeedItem[]): SeedItem[] =>
    items.flatMap((i) => [i, ...flat(i.children ?? [])])
  const lessons: PlanLesson[] = flat(
    courseTreeFromMap(read('curso-principal.json'), map),
  )
    .filter((i) => i.kind === 'LESSON')
    .map((l, n) => lesson(`l${n}`, l.title, l.bunnyVideoId ?? null))
  const names = readdirSync('prisma/data/transcripciones')
    .filter((f) => f.endsWith('.vtt'))
    .map((f) => f.replace(/\.vtt$/, ''))
  const plan = planTranscripts(names, lessons, map)

  it('se cargan los 50 videos del mapa; solo quedan fuera los dos de la biblioteca anterior', () => {
    expect(names).toHaveLength(52)
    expect(plan.assigned).toHaveLength(50)
    expect(plan.skipped.map((s) => s.name).sort()).toEqual([
      '00-INTRO',
      '00-INTRO-AD',
    ])
  })

  it('cada lección con video tiene su transcripción', () => {
    expect(lessons.filter((l) => l.bunnyVideoId).length).toBeGreaterThan(50)
    expect(plan.withoutTranscript).toEqual([])
  })

  it('un video que está en varias recetas lleva su transcripción a todas', () => {
    const shared = plan.assigned.filter((a) => a.lessonIds.length > 1)
    expect(shared.length).toBeGreaterThanOrEqual(5)
    const ids = plan.assigned.flatMap((a) => a.lessonIds)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
