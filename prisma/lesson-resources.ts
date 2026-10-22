import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

import { RECIPE_URL_PREFIX } from '../src/lib/recipe-pdfs'

type Link = { name: string; url: string }

const recipe = (name: string, file: string): Link => ({
  name,
  url: RECIPE_URL_PREFIX + file,
})

// Las dos cremas las usan las recetas de Cupcake y Lunch Box Cake.
const CREAMS = [
  recipe('Crema de mantequilla con merengue suizo', 'crema-de-mantequilla'),
  recipe('Crema chantilly para decorar', 'crema-chantilly'),
]

// Enlaces de descarga (recursos) por lección. `parent` es el bloque o el capítulo donde está la
// lección; `lesson`, su título. La lección "Receta" de cada capítulo es de texto y solo lleva el
// enlace al PDF de su receta (`assets/recetas`). El recetario general va solo en la Introducción
// (`assets/recetarios`): su ruta pide el curso comprado, así que nunca se baja desde la clase
// gratis.
export const LESSON_RESOURCES: {
  parent: string
  lesson: string
  links: Link[]
}[] = [
  {
    parent: 'Introducción',
    lesson: 'Introducción y consejos básicos',
    links: [
      {
        name: 'Recetario digital (PDF)',
        url: '/api/recetarios/postres-navidad',
      },
    ],
  },
  {
    parent: 'Enjambre de chocolate',
    lesson: 'Receta',
    links: [recipe('Receta - Enjambre de chocolate', 'enjambre-de-chocolate')],
  },
  {
    parent: 'Turrón de chocolate',
    lesson: 'Receta',
    links: [recipe('Receta - Turrón de chocolate', 'turron-de-chocolate')],
  },
  {
    parent: 'Brownie de cheesecake',
    lesson: 'Receta',
    links: [recipe('Receta - Brownie de cheesecake', 'brownie-de-cheesecake')],
  },
  {
    parent: 'Blondie',
    lesson: 'Receta',
    links: [recipe('Receta - Blondie', 'blondie')],
  },
  {
    parent: 'Cupcake',
    lesson: 'Receta',
    links: [recipe('Receta - Cupcakes y decoraciones', 'cupcake'), ...CREAMS],
  },
  {
    parent: 'Lunch Box Cake',
    lesson: 'Receta',
    links: [
      recipe('Receta - Lunch box cake y decoraciones', 'lunch-box-cake'),
      ...CREAMS,
    ],
  },
  {
    parent: 'Roles de canela',
    lesson: 'Receta',
    links: [recipe('Receta - Roles de canela', 'roles-de-canela')],
  },
  {
    parent: 'Alfajores',
    lesson: 'Receta',
    links: [recipe('Receta - Alfajores', 'alfajores')],
  },
  {
    parent: 'Galleta de mantequilla',
    lesson: 'Receta',
    links: [
      recipe('Receta - Galleta de mantequilla', 'galleta-de-mantequilla'),
    ],
  },
  {
    parent: 'Galleta de jengibre',
    lesson: 'Receta',
    links: [recipe('Receta - Galleta de jengibre', 'galleta-de-jengibre')],
  },
  {
    parent: 'Galleta Red Velvet',
    lesson: 'Receta',
    links: [recipe('Receta - Galleta Red Velvet', 'galleta-red-velvet')],
  },
]

// Agrega a cada lección sus enlaces de descarga. Idempotente: no repite un enlace que la lección
// ya tenga (misma URL) ni toca los demás recursos. Con `replaceText` además quita el texto de la
// lección "Receta" (el PDF lo reemplaza); sin él no se toca. Con `dry` solo dice qué haría.
// Lo usan `pnpm db:import-lesson-resources` y el seed.
export async function loadLessonResources(
  prisma: PrismaClient,
  { dry = false, replaceText = false } = {},
) {
  const lessons = await prisma.courseItem.findMany({
    where: { kind: 'LESSON' },
    select: {
      id: true,
      title: true,
      lessonType: true,
      body: true,
      parent: { select: { title: true } },
      resources: { select: { url: true } },
    },
  })
  const added: string[] = []
  const present: string[] = []
  const missing: string[] = []
  for (const entry of LESSON_RESOURCES) {
    const label = `${entry.parent} › ${entry.lesson}`
    const targets = lessons.filter(
      (l) => l.title === entry.lesson && l.parent?.title === entry.parent,
    )
    if (targets.length === 0) {
      missing.push(label)
      continue
    }
    for (const target of targets) {
      const have = new Set(target.resources.map((r) => r.url))
      const toAdd = entry.links.filter((l) => !have.has(l.url))
      if (!dry) {
        for (const [i, link] of toAdd.entries()) {
          await prisma.resource.create({
            data: {
              itemId: target.id,
              name: link.name,
              url: link.url,
              position: target.resources.length + i,
            },
          })
        }
        if (replaceText && target.lessonType === 'TEXT' && target.body) {
          await prisma.courseItem.update({
            where: { id: target.id },
            data: { body: Prisma.DbNull },
          })
        }
      }
      ;(toAdd.length ? added : present).push(label)
    }
  }
  return { added, present, missing }
}
