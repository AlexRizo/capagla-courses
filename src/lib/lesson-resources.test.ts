import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { courseTreeFromMap } from '../../prisma/course-map'
import type { MapEntry } from '../../prisma/course-map'
import type { SeedItem } from '../../prisma/course-tree'
import { LESSON_RESOURCES } from '../../prisma/lesson-resources'
import { RECIPE_URL_PREFIX, readRecipePdf } from '#/lib/recipe-pdfs'

// Enlaces de descarga de las lecciones (`pnpm db:import-lesson-resources`): el PDF de cada receta
// en su lección "Receta" y el recetario general solo en la Introducción.
const links = LESSON_RESOURCES.flatMap((e) =>
  e.links.map((l) => ({ ...e, ...l })),
)

describe('enlaces de descarga de las lecciones', () => {
  it('cada lección existe en el curso rearmado con el mapa', () => {
    const index = JSON.parse(
      readFileSync('prisma/data/curso-principal.json', 'utf8'),
    )
    const map = JSON.parse(
      readFileSync('prisma/data/mapa-videos.json', 'utf8'),
    ) as MapEntry[]
    const lessons: string[] = []
    const walk = (items: SeedItem[], parent: string) => {
      for (const i of items) {
        if (i.kind === 'LESSON') lessons.push(`${parent} › ${i.title}`)
        if (i.children) walk(i.children, i.title)
      }
    }
    walk(courseTreeFromMap(index, map), '')
    for (const e of LESSON_RESOURCES)
      expect(lessons, `${e.parent} › ${e.lesson}`).toContain(
        `${e.parent} › ${e.lesson}`,
      )
  })

  it('cada receta tiene su PDF y es un PDF', async () => {
    const recipes = links.filter((l) => l.url.startsWith(RECIPE_URL_PREFIX))
    expect(recipes.length).toBeGreaterThan(0)
    for (const l of recipes) {
      const file = await readRecipePdf(l.url.slice(RECIPE_URL_PREFIX.length))
      expect(file, l.url).not.toBeNull()
      expect(file!.subarray(0, 5).toString(), l.url).toBe('%PDF-')
    }
  })

  it('las 11 lecciones "Receta" llevan su PDF y todo PDF de assets/recetas se usa', () => {
    const receta = LESSON_RESOURCES.filter((e) => e.lesson === 'Receta')
    expect(receta).toHaveLength(11)
    for (const e of receta)
      expect(e.links[0].url.startsWith(RECIPE_URL_PREFIX), e.parent).toBe(true)
    const used = new Set(
      links.map((l) => l.url.slice(RECIPE_URL_PREFIX.length)),
    )
    for (const name of [
      'enjambre-de-chocolate',
      'crema-de-mantequilla',
      'crema-chantilly',
      'galleta-red-velvet',
    ])
      expect(used.has(name), name).toBe(true)
    expect(existsSync('assets/recetas/blondie.pdf')).toBe(true)
  })

  it('el recetario general va una sola vez y solo en la Introducción', () => {
    const general = links.filter(
      (l) => l.url === '/api/recetarios/postres-navidad',
    )
    expect(general).toHaveLength(1)
    expect(general[0].parent).toBe('Introducción')
    expect(existsSync('assets/recetarios/postres-navidad.pdf')).toBe(true)
  })
})
