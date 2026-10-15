import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/react'

import { richTextExtensions } from '#/lib/rich-text'
import { cn } from '#/lib/utils'

const tool =
  'h-7 cursor-pointer rounded-md border border-border bg-card px-2 text-13 font-medium text-foreground'

function Tool({
  editor,
  active,
  label,
  onClick,
}: {
  editor: Editor
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editor.isEditable}
      className={cn(tool, active && 'bg-accent')}
    >
      {label}
    </button>
  )
}

// Editor de texto enriquecido (Tiptap) con los formatos de `richTextExtensions`.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: JSONContent | null
  onChange: (doc: JSONContent) => void
  placeholder: string
}) {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: value ?? undefined,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert min-h-24 max-w-none px-3 py-2.5 outline-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Tool
          editor={editor}
          label="Negrita"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Tool
          editor={editor}
          label="Cursiva"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Tool
          editor={editor}
          label="Título"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Tool
          editor={editor}
          label="Lista"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Tool
          editor={editor}
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </div>
      <div className="relative rounded-md border border-border bg-card">
        {editor.isEmpty && (
          <span className="pointer-events-none absolute top-2.5 left-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
