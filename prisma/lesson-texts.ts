import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { PrismaClient } from '@prisma/client'
import type { JSONContent } from '@tiptap/react'

import { parseRichText } from '../src/lib/rich-text'

type Marks = NonNullable<JSONContent['marks']>

// Texto en negrita (`**x**`) y cursiva (`_x_`), que se pueden anidar.
const INLINE = /\*\*(.+?)\*\*|(?<!\w)_(.+?)_(?!\w)/g

const textNode = (text: string, marks: Marks): JSONContent =>
  marks.length ? { type: 'text', text, marks } : { type: 'text', text }

function inline(text: string, marks: Marks = []): JSONContent[] {
  const nodes: JSONContent[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) nodes.push(textNode(text.slice(last, m.index), marks))
    nodes.push(
      ...(m[1]
        ? inline(m[1], [...marks, { type: 'bold' }])
        : inline(m[2], [...marks, { type: 'italic' }])),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(textNode(text.slice(last), marks))
  return nodes
}

// Convierte el texto de una lección (`prisma/data/lecciones-textuales/*.md`) en el documento del
// editor. Solo entiende lo que el editor permite (`lib/rich-text.ts`): `##` y `###`, párrafos
// (varias líneas seguidas son un párrafo), listas con `- ` y con `1. ` (una lista sigue aunque haya
// líneas en blanco entre sus elementos), `**negrita**`, `_cursiva_` y una imagen en su propia
// línea: `![texto alternativo](/images/...)`.
export function markdownToDoc(markdown: string): JSONContent {
  const content: JSONContent[] = []
  let list = null as JSONContent | null
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length === 0) return
    content.push({
      type: 'paragraph',
      content: inline(paragraph.join(' ').replace(/\s+/g, ' ').trim()),
    })
    paragraph = []
  }

  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (line === '') {
      flush()
      continue
    }
    const heading = /^(#{2,3}) (.+)$/.exec(line)
    const image = /^!\[(.*)\]\((.+)\)$/.exec(line)
    const bullet = /^- (.+)$/.exec(line)
    const numbered = /^\d+\. (.+)$/.exec(line)
    const item = bullet ?? numbered
    if (item) {
      flush()
      const type = bullet ? 'bulletList' : 'orderedList'
      if (list?.type !== type) {
        list = { type, content: [] }
        content.push(list)
      }
      list.content!.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: inline(item[1]) }],
      })
      continue
    }
    list = null
    if (heading || image) {
      flush()
      content.push(
        heading
          ? {
              type: 'heading',
              attrs: { level: heading[1].length },
              content: inline(heading[2]),
            }
          : { type: 'image', attrs: { alt: image![1], src: image![2] } },
      )
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return { type: 'doc', content }
}

// Qué archivos van a qué lección. `parent` es el bloque (Introducción) o el capítulo (cada
// receta) donde está la lección; `lesson`, su título. Las recetas de Cupcake y Lunch Box Cake
// llevan además las dos cremas (`cremas.md`), que las dos usan.
export const LESSON_TEXTS: {
  parent: string
  lesson: string
  files: string[]
}[] = [
  { parent: 'Introducción', lesson: 'Quién soy', files: ['quien-soy.md'] },
  {
    parent: 'Introducción',
    lesson: 'Qué es la repostería',
    files: ['que-es-la-reposteria.md'],
  },
  { parent: 'Introducción', lesson: 'Duyas', files: ['duyas.md'] },
  {
    parent: 'Introducción',
    lesson: 'Mise en place',
    files: ['mise-en-place.md'],
  },
  { parent: 'Introducción', lesson: 'Tips', files: ['tips.md'] },
  {
    parent: 'Enjambre de chocolate',
    lesson: 'Receta',
    files: ['receta-enjambre-de-chocolate.md'],
  },
  {
    parent: 'Turrón de chocolate',
    lesson: 'Receta',
    files: ['receta-turron-de-chocolate.md'],
  },
  {
    parent: 'Brownie de cheesecake',
    lesson: 'Receta',
    files: ['receta-brownie-de-cheesecake.md'],
  },
  { parent: 'Blondie', lesson: 'Receta', files: ['receta-blondie.md'] },
  {
    parent: 'Cupcake',
    lesson: 'Receta',
    files: ['receta-cupcake.md', 'cremas.md'],
  },
  {
    parent: 'Lunch Box Cake',
    lesson: 'Receta',
    files: ['receta-lunch-box-cake.md', 'cremas.md'],
  },
  {
    parent: 'Roles de canela',
    lesson: 'Receta',
    files: ['receta-roles-de-canela.md'],
  },
  { parent: 'Alfajores', lesson: 'Receta', files: ['receta-alfajores.md'] },
  {
    parent: 'Galleta de mantequilla',
    lesson: 'Receta',
    files: ['receta-galleta-de-mantequilla.md'],
  },
  {
    parent: 'Galleta de jengibre',
    lesson: 'Receta',
    files: ['receta-galleta-de-jengibre.md'],
  },
  {
    parent: 'Galleta Red Velvet',
    lesson: 'Receta',
    files: ['receta-galleta-red-velvet.md'],
  },
]

// Carga a las lecciones de texto su contenido desde una carpeta de archivos `.md`. Por defecto no
// toca una lección que ya tenga texto (puede estar editado en el panel); con `force` lo reemplaza.
// Con `dry` solo dice qué haría. Lo usan `pnpm db:import-lesson-texts` y el seed.
export async function loadLessonTexts(
  prisma: PrismaClient,
  dir: string,
  { dry = false, force = false } = {},
) {
  const lessons = await prisma.courseItem.findMany({
    where: { kind: 'LESSON', lessonType: 'TEXT' },
    select: {
      id: true,
      title: true,
      body: true,
      parent: { select: { title: true } },
    },
  })
  const loaded: string[] = []
  const kept: string[] = []
  const missing: string[] = []
  for (const entry of LESSON_TEXTS) {
    const label = `${entry.parent} › ${entry.lesson}`
    const targets = lessons.filter(
      (l) => l.title === entry.lesson && l.parent?.title === entry.parent,
    )
    if (targets.length === 0) {
      missing.push(label)
      continue
    }
    const doc = parseRichText(
      markdownToDoc(
        entry.files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n\n'),
      ),
    )
    if (!doc) throw new Error(`${entry.files.join(' + ')}: texto vacío`)
    for (const target of targets) {
      if (target.body !== null && !force) {
        kept.push(label)
        continue
      }
      if (!dry) {
        await prisma.courseItem.update({
          where: { id: target.id },
          data: { body: doc },
        })
      }
      loaded.push(label)
    }
  }
  return { loaded, kept, missing }
}
