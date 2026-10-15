import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { BlockSettings } from '#/components/admin/block-settings'
import { ChapterSettings } from '#/components/admin/chapter-settings'
import { ConvertItem } from '#/components/admin/convert-item'
import { CourseSettings } from '#/components/admin/course-settings'
import { DeleteItem } from '#/components/admin/delete-item'
import { LessonSettings } from '#/components/admin/lesson-settings'
import { ProGate } from '#/components/admin/pro-gate'
import {
  createCourseItem,
  getAdminCourse,
  moveCourseItem,
} from '#/lib/admin-courses'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/admin/cursos/$slug')({
  loader: ({ params }) => getAdminCourse({ data: { slug: params.slug } }),
  component: EditarCurso,
})

const kinds = [
  {
    kind: 'BLOCK',
    name: 'Bloque',
    text: 'Solo separa grandes partes del curso y lleva nombre. No se le sube material. Ej. Hora de hornear.',
  },
  {
    kind: 'CHAPTER',
    name: 'Capítulo',
    text: 'Agrupa las lecciones de una receta. Su receta y recursos se ven en todas sus lecciones. Ej. Brownie.',
  },
  {
    kind: 'LESSON',
    name: 'Lección',
    text: 'Un video o una receta en texto. Sus notas y recursos son solo de esa lección.',
  },
] as const

// Sangría de la maqueta: 10px, 34px y 66px.
const indent = ['pl-2.5', 'pl-8.5', 'pl-16.5']

const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'

function EditarCurso() {
  const { name, settings, items } = Route.useLoaderData()
  const { slug } = Route.useParams()
  const router = useRouter()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const [menu, setMenu] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  // 'course' = Ajustes del curso; si no, el id del elemento seleccionado.
  const [selected, setSelected] = useState('course')
  const current = items.find((i) => i.id === selected)

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    await moveCourseItem({
      data: {
        id: String(active.id),
        overId: String(over.id),
        after: from < to,
      },
    })
    await router.invalidate()
  }

  async function add(kind: 'BLOCK' | 'CHAPTER' | 'LESSON') {
    const result = await createCourseItem({
      data: {
        slug,
        kind,
        selectedId: selected === 'course' ? null : selected,
      },
    })
    if (!result.id) {
      setMenuError(result.error ?? 'No se pudo agregar.')
      return
    }
    await router.invalidate()
    setSelected(result.id)
    setMenu(false)
  }

  // Elementos que cuelgan del seleccionado: las filas siguientes con más sangría.
  const index = items.findIndex((i) => i.id === selected)
  let descendants = 0
  if (current) {
    for (const i of items.slice(index + 1)) {
      if (i.level <= current.level) break
      descendants++
    }
  }
  const convert =
    current && current.kind !== 'BLOCK' ? (
      <ConvertItem
        key={current.id + current.kind}
        id={current.id}
        to={current.kind === 'CHAPTER' ? 'LESSON' : 'CHAPTER'}
        blockedReason={
          current.kind === 'CHAPTER' && descendants > 0
            ? 'Primero mueve o elimina sus lecciones.'
            : current.kind === 'LESSON' && current.level > 1
              ? 'Solo una lección que está directo en un bloque puede ser capítulo.'
              : null
        }
      />
    ) : null
  const remove = current && (
    <DeleteItem
      key={current.id}
      id={current.id}
      descendants={descendants}
      onDeleted={() => setSelected('course')}
    />
  )

  return (
    <ProGate>
      <div className="px-6 pt-6">
        <Link
          to="/admin/cursos"
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-13 font-medium"
        >
          ‹ Todos los cursos
        </Link>
      </div>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
              {name}
            </h1>
            <div className="text-muted-foreground">
              Arrastra para ordenar. Capítulos y lecciones se pueden mover y
              convertir entre sí; los bloques solo separan.
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenu(!menu)
                setMenuError(null)
              }}
              className="inline-flex h-9 cursor-pointer items-center rounded-md border-none bg-primary px-3.5 font-medium text-primary-foreground"
            >
              + Agregar elemento
            </button>
            {menu && (
              <div className="absolute top-10.5 right-0 z-10 flex w-80 flex-col rounded-lg border border-border bg-card p-1.5 shadow-lg">
                {kinds.map((k) => (
                  <button
                    key={k.name}
                    type="button"
                    onClick={() => add(k.kind)}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-md border-none bg-transparent p-2.5 text-left text-foreground hover:bg-accent"
                  >
                    <span className="font-medium">{k.name}</span>
                    <span className="text-13 text-muted-foreground">
                      {k.text}
                    </span>
                  </button>
                ))}
                {menuError && (
                  <div className="px-2.5 pt-1 pb-2 text-13 text-destructive">
                    {menuError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-1 basis-110 flex-col gap-0.5 rounded-lg border border-border bg-card p-2 shadow-xs">
            <Row
              level={0}
              bold
              selected={selected === 'course'}
              onSelect={() => setSelected('course')}
              title="Ajustes del curso"
              type="Curso"
              meta=""
            />
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              {items.map((i) => (
                <ItemRow
                  key={i.id}
                  id={i.id}
                  level={i.level}
                  kind={i.kind}
                  selected={selected === i.id}
                  onSelect={() => setSelected(i.id)}
                  title={i.title}
                  type={i.type}
                  meta={i.meta}
                />
              ))}
            </DndContext>
          </div>
          {current?.kind === 'BLOCK' ? (
            <BlockSettings
              key={current.id}
              id={current.id}
              title={current.title}
              isFree={current.isFree}
              remove={remove}
            />
          ) : current?.kind === 'CHAPTER' ? (
            <ChapterSettings
              key={current.id}
              id={current.id}
              title={current.title}
              published={current.published}
              recipe={current.recipe}
              convert={convert}
              remove={remove}
            />
          ) : current?.kind === 'LESSON' ? (
            <LessonSettings
              key={current.id}
              lesson={current}
              convert={convert}
              remove={remove}
            />
          ) : (
            <CourseSettings key={slug} slug={slug} settings={settings} />
          )}
        </div>
      </div>
    </ProGate>
  )
}

// Fila del árbol que se arrastra por el asa ⋮⋮ y recibe lo que se suelta encima.
function ItemRow({ id, ...props }: RowProps & { id: string }) {
  const drag = useDraggable({ id })
  const drop = useDroppable({ id })

  return (
    <Row
      {...props}
      dnd={{
        rowRef: (node) => {
          drag.setNodeRef(node)
          drop.setNodeRef(node)
        },
        handleRef: drag.setActivatorNodeRef,
        handleProps: { ...drag.attributes, ...drag.listeners },
        isOver: drop.isOver && !drag.isDragging,
        isDragging: drag.isDragging,
        transform: drag.transform,
      }}
    />
  )
}

type RowProps = {
  level: number
  kind?: 'BLOCK' | 'CHAPTER' | 'LESSON'
  bold?: boolean
  selected?: boolean
  onSelect?: () => void
  title: string
  type: string
  meta: string
}

function Row({
  level,
  kind,
  bold,
  selected,
  onSelect,
  title,
  type,
  meta,
  dnd,
}: RowProps & {
  dnd?: {
    rowRef: (node: HTMLElement | null) => void
    handleRef: (node: HTMLElement | null) => void
    handleProps: React.HTMLAttributes<HTMLElement>
    isOver: boolean
    isDragging: boolean
    transform: { x: number; y: number } | null
  }
}) {
  return (
    <div
      ref={dnd?.rowRef}
      style={
        dnd?.transform
          ? {
              transform: `translate(${dnd.transform.x}px, ${dnd.transform.y}px)`,
            }
          : undefined
      }
      {...(onSelect && {
        role: 'button',
        tabIndex: 0,
        onClick: onSelect,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect()
        },
      })}
      className={cn(
        'flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2',
        onSelect && 'cursor-pointer',
        indent[level],
        kind === 'BLOCK' && 'border-border bg-primary-foreground',
        selected && 'border-primary bg-accent',
        dnd?.isDragging && 'relative z-20 opacity-90 shadow-lg',
        dnd?.isDragging && kind !== 'BLOCK' && 'bg-card',
        dnd?.isOver &&
          'border-primary bg-primary-foreground ring-2 ring-primary',
      )}
    >
      <span
        ref={dnd?.handleRef}
        {...dnd?.handleProps}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'tracking-grip text-zinc-400',
          dnd && 'cursor-grab touch-none',
        )}
      >
        ⋮⋮
      </span>
      <span
        className={cn(
          'flex-1',
          bold || kind === 'BLOCK'
            ? 'font-semibold'
            : kind === 'CHAPTER'
              ? 'font-medium'
              : 'font-normal',
        )}
      >
        {title}
      </span>
      <span className={pill}>{type}</span>
      <span className="min-w-12 text-right text-xs text-muted-foreground">
        {meta}
      </span>
    </div>
  )
}
