import { Node } from '@tiptap/pm/model'
import { Node as TiptapNode, getSchema, mergeAttributes } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/react'

import { isSafeImageSrc } from '#/lib/image-src'

// Imagen en bloque (solo `src` y `alt`). El editor no tiene botón para insertarla: las
// imágenes de las lecciones de texto llegan con `pnpm db:import-lesson-texts` y el editor
// solo las conserva.
const RichImage = TiptapNode.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: '' } }
  },
  // Sin `renderHTML` el esquema no tiene `toDOM` y el editor falla al dibujar el nodo.
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
})

function assertSafeImages(node: JSONContent) {
  if (node.type === 'image' && !isSafeImageSrc(node.attrs?.src)) {
    throw new Error('Imagen con dirección no permitida')
  }
  node.content?.forEach(assertSafeImages)
}

// Texto enriquecido del curso (receta del capítulo, texto de la lección):
// se guarda como JSON del editor, nunca como HTML. Este es el único conjunto de
// formatos permitido; el servidor rechaza cualquier otro al guardar.
export const richTextExtensions = [
  RichImage,
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    strike: false,
    underline: false,
  }),
]

const MAX_BYTES = 100_000
const schema = getSchema(richTextExtensions)

// Valida el documento contra el esquema del editor. Devuelve null si está vacío.
// Lanza si trae nodos o marcas desconocidos o pesa demasiado.
export function parseRichText(value: unknown): JSONContent | null {
  if (value === null || value === undefined) return null
  if (JSON.stringify(value).length > MAX_BYTES) {
    throw new Error('Texto demasiado largo')
  }
  const doc = Node.fromJSON(schema, value)
  doc.check()
  assertSafeImages(value)
  return doc.textContent.trim() === '' ? null : value
}
