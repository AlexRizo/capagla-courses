import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { checkCoverage, courseTreeFromMap } from '../../prisma/course-map'
import type { MapEntry } from '../../prisma/course-map'
import type { SeedItem } from '../../prisma/course-tree'

// El mapa de videos real del cliente + el índice del curso: aquí se comprueba el árbol que sale
// de ellos, que es el que `pnpm db:import-course-map` carga.
const read = (file: string) =>
  JSON.parse(readFileSync(`prisma/data/${file}`, 'utf8'))
const index = read('curso-principal.json')
const map = read('mapa-videos.json') as MapEntry[]
const tree = courseTreeFromMap(index, map)

const flat = (items: SeedItem[]): SeedItem[] =>
  items.flatMap((i) => [i, ...flat(i.children ?? [])])
const block = (title: string) => tree.find((b) => b.title === title)!
const chapter = (title: string) =>
  flat(tree).find((i) => i.kind === 'CHAPTER' && i.title === title)!
const lessons = (title: string) => chapter(title).children!.map((l) => l.title)

describe('curso armado con el mapa de videos', () => {
  it('conserva los bloques del índice, en orden', () => {
    expect(tree.map((b) => b.title)).toEqual([
      'Introducción',
      'Postres de snack para Navidad',
      'Hora de hornear',
      'Galletas navideñas',
      'Despedida',
    ])
  })

  it('los 50 videos distintos del mapa quedan en alguna lección', () => {
    const cover = checkCoverage(tree, map)
    expect(new Set(map.map((m) => m.bunny_guid)).size).toBe(50)
    expect(cover.missing).toEqual([])
    // 57 entradas: una lección de video por cada una.
    expect(cover.videoLessons).toBe(57)
    // Seis videos están en más de una receta (Cupcake y Lunch Box Cake comparten 5, y el
    // horneado de jengibre está en tres recetas).
    expect(cover.shared).toHaveLength(6)
  })

  it('cada lección de video lleva su video y su duración', () => {
    for (const item of flat(tree).filter((i) => i.bunnyVideoId)) {
      expect(item.lessonType).toBe('VIDEO')
      expect(item.durationSec).toBeGreaterThan(0)
    }
    const preparacion = flat(tree).find(
      (i) => i.title === 'Preparación de enjambre de chocolate',
    )!
    expect(preparacion.durationSec).toBe(1064) // 17:44
  })

  it('cada receta tiene su lección de texto "Receta" primero y luego sus videos en el orden del mapa', () => {
    for (const recipe of [
      'Enjambre de chocolate',
      'Turrón de chocolate',
      'Brownie de cheesecake',
      'Blondie',
      'Cupcake',
      'Lunch Box Cake',
      'Roles de canela',
      'Alfajores',
      'Galleta de mantequilla',
      'Galleta de jengibre',
      'Galleta Red Velvet',
    ]) {
      const kids = chapter(recipe).children!
      expect(kids[0]).toMatchObject({ title: 'Receta', lessonType: 'TEXT' })
      expect(kids.slice(1).every((k) => k.bunnyVideoId)).toBe(true)
    }
    expect(lessons('Brownie de cheesecake')).toEqual([
      'Receta',
      'Ingredientes',
      'Preparación de la base de brownies',
      'Preparación de la base del cheesecake',
      'Mezcla Brownies cheesecake',
      'Decoración Brownies cheesecake',
    ])
  })

  it('los videos que comparten dos recetas se repiten en cada una', () => {
    const cupcake = chapter('Cupcake').children!
    const lunch = chapter('Lunch Box Cake').children!
    const shared = cupcake.filter(
      (l) =>
        l.bunnyVideoId && lunch.some((x) => x.bunnyVideoId === l.bunnyVideoId),
    )
    expect(shared).toHaveLength(5)
    // La decoración de cada receta es solo suya.
    expect(lessons('Cupcake')).toContain('Decoración de cupcake "Nochebuena"')
    expect(lessons('Lunch Box Cake')).not.toContain(
      'Decoración de cupcake "Nochebuena"',
    )
  })

  it('la introducción: dos lecciones con video, un capítulo con dos videos y las demás de texto', () => {
    const intro = block('Introducción').children!
    expect(
      intro.map((l) => `${l.kind}:${l.lessonType ?? '-'}:${l.title}`),
    ).toEqual([
      'LESSON:VIDEO:Introducción y consejos básicos',
      'LESSON:TEXT:Quién soy',
      'LESSON:TEXT:Qué es la repostería',
      'CHAPTER:-:Utensilios básicos',
      'LESSON:TEXT:Duyas',
      'LESSON:TEXT:Mise en place',
      'LESSON:TEXT:Tips',
    ])
    // El capítulo no repite su nombre en sus lecciones.
    expect(lessons('Utensilios básicos')).toEqual([
      'Materiales básicos',
      'Utensilios',
    ])
  })

  it('la despedida es una lección de video', () => {
    expect(block('Despedida').children).toEqual([
      expect.objectContaining({
        title: 'Despedida del curso',
        lessonType: 'VIDEO',
        durationSec: 40,
      }),
    ])
  })

  it('73 lecciones en total: 57 de video y 16 de texto', () => {
    const all = flat(tree).filter((i) => i.kind === 'LESSON')
    expect(all).toHaveLength(73)
    expect(all.filter((l) => l.lessonType === 'TEXT')).toHaveLength(16)
  })
})

describe('courseTreeFromMap con datos mínimos', () => {
  const mini = {
    modulos: [
      {
        orden: 0,
        titulo: 'B1',
        lecciones: [
          { orden: 1, titulo: 'Uno' },
          { orden: 2, titulo: 'Dos' },
        ],
        recetas: [{ orden: 1, titulo: 'R1', leccion_receta_texto: false }],
      },
    ],
  }
  const entry = (md: string, tema: string | null, guid: string): MapEntry => ({
    leccion: 'ALGO',
    tema,
    md,
    bunny_guid: guid,
    bunny_titulo: `${md.slice(0, 2)}-01_x (1080p).mp4`,
    duracion_seg: 10,
  })

  it('numera las unidades en el orden del curso: lecciones y luego recetas', () => {
    const t = courseTreeFromMap(mini, [
      entry('02-x.md', null, 'g2'),
      entry('03-x.md', 'Tema A', 'g3'),
    ])
    expect(t[0].children![0]).toMatchObject({
      title: 'Uno',
      lessonType: 'TEXT',
    })
    expect(t[0].children![1]).toMatchObject({ bunnyVideoId: 'g2' })
    // La receta (unidad 3) no lleva "Receta" si el índice no la trae.
    expect(t[0].children![2]).toMatchObject({
      kind: 'CHAPTER',
      title: 'R1',
      children: [{ title: 'Tema A', bunnyVideoId: 'g3' }],
    })
  })

  it('detecta un video del mapa que no quedó en ninguna lección', () => {
    const extra = entry('09-x.md', 'Huérfano', 'g9')
    const t = courseTreeFromMap(mini, [entry('03-x.md', 'Tema A', 'g3'), extra])
    expect(
      checkCoverage(t, [entry('03-x.md', 'Tema A', 'g3'), extra]).missing,
    ).toEqual(['g9'])
  })
})
