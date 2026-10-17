import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
} from '@dnd-kit/core'
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
import { resolveDrop, zoneFor } from '#/lib/course-tree'
import type { DropZone, Placement } from '#/lib/course-tree'
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
const indentPx = [10, 34, 66]

// Fila sobre la que está el puntero; con teclado (sin puntero) la más cercana.
const collisions: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : closestCenter(args)
}

type Drop = { overId: string; zone: DropZone }

// Qué se resalta según dónde caerá lo arrastrado: la fila que lo recibe como primer hijo,
// o una línea sobre/bajo una fila (bajo la última fila de lo que cuelga, si es "después").
type Indicator =
  | { kind: 'inside'; rowId: string }
  | { kind: 'line'; rowId: string; edge: 'top' | 'bottom'; level: number }

function indicatorFor(
  items: { id: string; level: number }[],
  placement: Placement,
): Indicator | null {
  if (placement.mode === 'first') {
    return placement.parentId
      ? { kind: 'inside', rowId: placement.parentId }
      : null
  }
  const at = items.findIndex((i) => i.id === placement.anchorId)
  if (at < 0) return null
  const anchor = items[at]
  if (placement.mode === 'before') {
    return { kind: 'line', rowId: anchor.id, edge: 'top', level: anchor.level }
  }
  let end = at
  while (items[end + 1] && items[end + 1].level > anchor.level) end++
  return {
    kind: 'line',
    rowId: items[end].id,
    edge: 'bottom',
    level: anchor.level,
  }
}

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
  const [drop, setDrop] = useState<Drop | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  // 'course' = Ajustes del curso; si no, el id del elemento seleccionado.
  const [selected, setSelected] = useState('course')
  const current = items.find((i) => i.id === selected)

  const nodes = items.map((i) => ({
    id: i.id,
    parentId: i.parentId,
    kind: i.kind,
  }))

  // Zona de la fila donde está el puntero (o, con teclado, el centro de lo arrastrado).
  function dropAt({ active, over, delta, activatorEvent }: DragMoveEvent) {
    if (!over || active.id === over.id) return null
    const translated = active.rect.current.translated
    const y =
      'clientY' in activatorEvent
        ? Number(activatorEvent.clientY) + delta.y
        : translated
          ? translated.top + translated.height / 2
          : over.rect.top
    const ratio = Math.min(
      1,
      Math.max(0, (y - over.rect.top) / over.rect.height),
    )
    const overId = String(over.id)
    return { overId, zone: zoneFor(nodes, String(active.id), overId, ratio) }
  }

  const placement =
    drop && activeId
      ? resolveDrop(nodes, activeId, drop.overId, drop.zone)
      : null
  const indicator = placement ? indicatorFor(items, placement) : null

  async function onDragEnd(event: DragEndEvent) {
    const target = dropAt(event)
    setDrop(null)
    setActiveId(null)
    if (!target) return
    await moveCourseItem({
      data: { id: String(event.active.id), ...target },
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
            <DndContext
              sensors={sensors}
              collisionDetection={collisions}
              onDragStart={({ active }) => setActiveId(String(active.id))}
              onDragMove={(event) => setDrop(dropAt(event))}
              onDragEnd={onDragEnd}
              onDragCancel={() => {
                setDrop(null)
                setActiveId(null)
              }}
            >
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
                  inside={
                    indicator?.kind === 'inside' && indicator.rowId === i.id
                  }
                  line={
                    indicator?.kind === 'line' && indicator.rowId === i.id
                      ? indicator
                      : null
                  }
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
              resources={current.resources}
              convert={convert}
              remove={remove}
            />
          ) : current?.kind === 'LESSON' ? (
            <LessonSettings
              key={current.id}
              slug={slug}
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
  const dropTarget = useDroppable({ id })

  return (
    <Row
      {...props}
      dnd={{
        rowRef: (node) => {
          drag.setNodeRef(node)
          dropTarget.setNodeRef(node)
        },
        handleRef: drag.setActivatorNodeRef,
        handleProps: { ...drag.attributes, ...drag.listeners },
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
  inside?: boolean
  line?: { edge: 'top' | 'bottom'; level: number } | null
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
  inside,
  line,
  dnd,
}: RowProps & {
  dnd?: {
    rowRef: (node: HTMLElement | null) => void
    handleRef: (node: HTMLElement | null) => void
    handleProps: React.HTMLAttributes<HTMLElement>
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
        'relative flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2',
        onSelect && 'cursor-pointer',
        indent[level],
        kind === 'BLOCK' && 'border-border bg-primary-foreground',
        selected && 'border-primary bg-accent',
        dnd?.isDragging && 'relative z-20 opacity-90 shadow-lg',
        dnd?.isDragging && kind !== 'BLOCK' && 'bg-card',
        inside && 'border-primary bg-primary-foreground ring-2 ring-primary',
      )}
    >
      {line && (
        <div
          style={{ left: indentPx[line.level] }}
          className={cn(
            'pointer-events-none absolute right-0 z-30 h-0.5 rounded-full bg-primary',
            line.edge === 'top' ? '-top-px' : '-bottom-px',
          )}
        />
      )}
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
