import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { courseTreeFromMap } from '../../prisma/course-map'
import type { MapEntry } from '../../prisma/course-map'
import type { SeedItem } from '../../prisma/course-tree'
import { LESSON_RESOURCES } from '../../prisma/lesson-resources'
import { LESSON_TEXTS, markdownToDoc } from '../../prisma/lesson-texts'
import { getSchema } from '@tiptap/react'

import { parseRichText, richTextExtensions } from '#/lib/rich-text'

// El texto de las lecciones de texto (`prisma/data/lecciones-textuales`, `pnpm
// db:import-lesson-texts`): del cliente (Introducción).
const DIR = 'prisma/data/lecciones-textuales'
const read = (f: string) => readFileSync(`${DIR}/${f}`, 'utf8')

const textOf = (node: unknown): string => {
  const n = node as { text?: string; content?: unknown[] }
  return n.text ?? (n.content ?? []).map(textOf).join('')
}

describe('markdownToDoc', () => {
  it('entiende títulos, párrafos, listas, negrita, cursiva e imagen', () => {
    const doc = markdownToDoc(
      [
        '![Una foto](/images/lecciones/x.jpg)',
        '',
        '## Ingredientes',
        '',
        'Primera línea',
        'segunda línea.',
        '',
        '- **250 g** Chocolate',
        '',
        '- Grageas',
        '',
        '1. Uno',
        '2. Dos con **_mucho_** énfasis',
      ].join('\n'),
    )
    expect(doc.content!.map((n) => n.type)).toEqual([
      'image',
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
    ])
    expect(doc.content![0].attrs).toEqual({
      alt: 'Una foto',
      src: '/images/lecciones/x.jpg',
    })
    expect(doc.content![1].attrs).toEqual({ level: 2 })
    // Varias líneas seguidas son un párrafo; la lista sigue aunque haya una línea en blanco.
    expect(textOf(doc.content![2])).toBe('Primera línea segunda línea.')
    expect(doc.content![3].content).toHaveLength(2)
    expect(doc.content![3].content![0].content![0].content![0]).toEqual({
      type: 'text',
      text: '250 g',
      marks: [{ type: 'bold' }],
    })
    expect(doc.content![4].content![1].content![0].content![1]).toEqual({
      type: 'text',
      text: 'mucho',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    })
  })

  it('deja los asteriscos sueltos del recetario como texto', () => {
    const doc = markdownToDoc('* Revisar glosario de terminos.\n\nhilo* y más')
    expect(textOf(doc)).toBe('* Revisar glosario de terminos.hilo* y más')
    expect(JSON.stringify(doc)).not.toContain('"marks"')
  })
})

describe('textos de las lecciones', () => {
  it('cada archivo existe, es un documento válido del editor y no está vacío', () => {
    for (const entry of LESSON_TEXTS) {
      for (const f of entry.files)
        expect(existsSync(`${DIR}/${f}`), f).toBe(true)
      const doc = parseRichText(
        markdownToDoc(entry.files.map(read).join('\n\n')),
      )
      expect(doc, entry.files.join()).not.toBeNull()
    }
  })

  it('cada lección de texto del curso rearmado con el mapa tiene su archivo, y nada sobra', () => {
    const index = JSON.parse(
      readFileSync('prisma/data/curso-principal.json', 'utf8'),
    )
    const map = JSON.parse(
      readFileSync('prisma/data/mapa-videos.json', 'utf8'),
    ) as MapEntry[]
    const texts: string[] = []
    const walk = (items: SeedItem[], parent: string) => {
      for (const i of items) {
        if (i.kind === 'LESSON' && i.lessonType === 'TEXT')
          texts.push(`${parent} › ${i.title}`)
        if (i.children) walk(i.children, i.title)
      }
    }
    walk(courseTreeFromMap(index, map), '')
    // Cada una lleva su texto (Introducción) o el enlace al PDF de su receta ("Receta").
    expect(texts.sort()).toEqual(
      [
        ...LESSON_TEXTS,
        ...LESSON_RESOURCES.filter((e) => e.lesson === 'Receta'),
      ]
        .map((e) => `${e.parent} › ${e.lesson}`)
        .sort(),
    )
  })

  it('las imágenes existen en public/ y cada archivo de texto se usa', () => {
    for (const entry of LESSON_TEXTS) {
      const doc = markdownToDoc(entry.files.map(read).join('\n\n'))
      for (const node of doc.content!.filter((n) => n.type === 'image')) {
        expect(existsSync(`public${node.attrs!.src}`), node.attrs!.src).toBe(
          true,
        )
        expect(node.attrs!.alt, node.attrs!.src).not.toBe('')
      }
    }
  })
})

describe('imágenes en el texto enriquecido', () => {
  const doc = (src: unknown) => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] },
      { type: 'image', attrs: { src, alt: 'x' } },
    ],
  })

  it('acepta un archivo propio y una dirección https', () => {
    expect(parseRichText(doc('/images/lecciones/duyas.jpg'))).not.toBeNull()
    expect(parseRichText(doc('https://cdn.example.com/a.jpg'))).not.toBeNull()
  })

  it('el esquema del editor sabe dibujar la imagen (toDOM)', () => {
    const { toDOM } = getSchema(richTextExtensions).nodes.image.spec
    expect(toDOM).toBeTypeOf('function')
  })

  it('rechaza cualquier otra dirección', () => {
    for (const src of [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'http://example.com/a.jpg',
      '//example.com/a.jpg',
      null,
    ]) {
      expect(() => parseRichText(doc(src)), String(src)).toThrow()
    }
  })
})
