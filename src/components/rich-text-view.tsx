import type { JSONContent } from '@tiptap/react'

import { isSafeImageSrc } from '#/lib/image-src'
import { cn } from '#/lib/utils'

// Muestra el texto enriquecido del curso (JSON del editor) sin HTML crudo: cada nodo y
// marca permitido (`lib/rich-text.ts`, validado al guardar) se convierte en un elemento de React.
function Mark({
  marks,
  children,
}: {
  marks: JSONContent['marks']
  children: React.ReactNode
}) {
  return (marks ?? []).reduce<React.ReactNode>((node, mark) => {
    if (mark.type === 'bold') return <strong>{node}</strong>
    if (mark.type === 'italic') return <em>{node}</em>
    return node
  }, children)
}

function Node({ node }: { node: JSONContent }) {
  const kids = (node.content ?? []).map((child, i) => (
    <Node key={i} node={child} />
  ))
  switch (node.type) {
    case 'text':
      return <Mark marks={node.marks}>{node.text}</Mark>
    case 'paragraph':
      return <p>{kids}</p>
    case 'heading':
      return node.attrs?.level === 2 ? <h2>{kids}</h2> : <h3>{kids}</h3>
    case 'bulletList':
      return <ul>{kids}</ul>
    case 'orderedList':
      return <ol>{kids}</ol>
    case 'listItem':
      return <li>{kids}</li>
    case 'hardBreak':
      return <br />
    case 'image':
      return isSafeImageSrc(node.attrs?.src) ? (
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ''}
          loading="lazy"
          className="my-2 h-auto max-w-full self-center rounded-lg"
        />
      ) : null
    default:
      return <>{kids}</>
  }
}

export function RichTextView({
  doc,
  className,
}: {
  doc: JSONContent
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 [&_h2]:text-base [&_h2]:font-black [&_h3]:font-bold [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5',
        className,
      )}
    >
      {(doc.content ?? []).map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </div>
  )
}
