import { Node } from '@tiptap/pm/model'
import { getSchema } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/react'

// Texto enriquecido del curso (receta del capítulo, texto de la lección):
// se guarda como JSON del editor, nunca como HTML. Este es el único conjunto de
// formatos permitido; el servidor rechaza cualquier otro al guardar.
export const richTextExtensions = [
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
  return doc.textContent.trim() === '' ? null : value
}
