import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { BlockNode, ChapterNode, LessonNode } from '#/lib/player-tree'
import { cn } from '#/lib/utils'

import { BookmarkIcon } from './all-moments'

type Props = {
  slug: string
  tree: BlockNode[]
  currentId: string
  currentChapterId: string | null
  // Cerrar el panel (ocultarlo en escritorio, cerrar el cajón en móvil).
  onClose: () => void
  // Al elegir una lección (en móvil cierra el cajón).
  onNavigate?: () => void
  // Abrir con el buscador visible (desde el carril cerrado).
  startSearching?: boolean
  // Cajón de móvil: filas y botones más altos, para el dedo.
  mobile?: boolean
  // "Mis momentos" del curso, por encima del primer bloque: cuántos hay, si su panel está abierto
  // y cómo abrirlo.
  momentsTotal: number
  momentsOpen: boolean
  onOpenMoments: () => void
}

const iconButton =
  'flex flex-none cursor-pointer items-center justify-center rounded-10 border border-player-border bg-player-surface p-0'

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 fill-none stroke-player-text stroke-[1.8]"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 3.5L5.5 8 10 12.5" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="size-4.5 fill-none stroke-player-text stroke-[1.8]"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.2" />
      <path d="M12 12l4 4" />
    </svg>
  )
}

function Lesson({
  lesson,
  current,
  slug,
  nested,
  onNavigate,
  mobile,
}: {
  lesson: LessonNode
  current: boolean
  slug: string
  nested: boolean
  onNavigate?: () => void
  mobile?: boolean
}) {
  return (
    <Link
      to="/mis-cursos/$slug/$lessonId"
      params={{ slug, lessonId: lesson.id }}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-10 py-2 pr-3 text-player-text no-underline',
        mobile ? 'min-h-11' : 'min-h-10.5',
        nested ? 'pl-10' : 'pl-3',
      )}
    >
      <span
        className={cn(
          'flex size-4.5 flex-none items-center justify-center rounded-full border-2',
          current
            ? 'border-player-accent bg-lesson-current'
            : lesson.seen
              ? 'border-player-accent bg-player-accent'
              : 'border-player-todo bg-transparent',
        )}
      >
        {lesson.seen && !current && (
          <svg
            viewBox="0 0 10 10"
            className="size-2.5 fill-none stroke-player-on-accent stroke-[1.8]"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 5.2l2 2 4-4.4" />
          </svg>
        )}
      </span>
      <span
        className={cn(
          'flex-1 text-sm leading-135',
          current ? 'font-black' : 'font-normal',
          lesson.seen && !current && 'text-player-muted',
        )}
      >
        {lesson.title}
      </span>
      <span className="text-xs text-player-muted">{lesson.meta}</span>
    </Link>
  )
}

export function CoursePanel({
  slug,
  tree,
  currentId,
  currentChapterId,
  onClose,
  onNavigate,
  startSearching = false,
  mobile,
  momentsTotal,
  momentsOpen,
  onOpenMoments,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    currentChapterId ? { [currentChapterId]: true } : {},
  )
  // Al pasar a una lección de otro capítulo, ese capítulo se abre.
  useEffect(() => {
    if (currentChapterId) setOpen((o) => ({ ...o, [currentChapterId]: true }))
  }, [currentChapterId])
  const [searching, setSearching] = useState(startSearching)
  const [q, setQ] = useState('')

  const query = q.trim().toLowerCase()
  const has = (text: string) => text.toLowerCase().includes(query)

  // Con búsqueda: un bloque que coincide se muestra entero; si no, solo los capítulos y
  // lecciones que coinciden (y el capítulo se abre solo si coincide una de sus lecciones).
  const blocks = tree.flatMap((b) => {
    if (!query || has(b.title)) return [{ block: b, children: b.children }]
    const children = b.children.filter((c) =>
      c.type === 'lesson'
        ? has(c.title)
        : has(c.title) || c.lessons.some((l) => has(l.title)),
    )
    return children.length ? [{ block: b, children }] : []
  })

  function chapterOpen(c: ChapterNode, blockMatches: boolean) {
    if (!query) return !!open[c.id]
    return !has(c.title) && !blockMatches && c.lessons.some((l) => has(l.title))
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-6',
        mobile ? 'pt-4' : 'pt-4.5',
      )}
    >
      <div className="flex items-center gap-1.5 px-3 pb-1">
        <span className="text-2xl font-black tracking-landing-logo text-player-accent">
          Capagla
        </span>
        <button
          type="button"
          onClick={() => {
            setSearching(!searching)
            setQ('')
          }}
          aria-label="Buscar en el curso"
          className={cn(
            'ml-1 flex cursor-pointer items-center justify-center rounded-10 border-0',
            mobile ? 'size-10' : 'size-9',
            searching ? 'bg-player-open' : 'bg-transparent',
          )}
        >
          <SearchIcon />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Ocultar el menú del curso"
          className={cn(iconButton, mobile ? 'size-10' : 'size-8.5')}
        >
          <ChevronLeft />
        </button>
      </div>

      {searching && (
        <div className="relative px-3 pt-2 pb-1">
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar: galletas, brownie…"
            className={cn(
              'box-border w-full rounded-10 border border-player-border bg-player-control pr-10 pl-3.5 font-sans text-player-text',
              mobile ? 'h-11 text-base' : 'h-10.5 text-sm',
            )}
          />
          <button
            type="button"
            onClick={() => {
              setSearching(false)
              setQ('')
            }}
            aria-label="Cerrar búsqueda"
            className={cn(
              'absolute right-4.5 size-7.5 cursor-pointer rounded-lg border-0 bg-transparent text-base text-player-muted',
              mobile ? 'top-3.75' : 'top-3.5',
            )}
          >
            ✕
          </button>
        </div>
      )}

      {!query && (
        <button
          type="button"
          onClick={onOpenMoments}
          title="Los minutos que guardaste de los videos"
          className={cn(
            'mt-4 flex w-full cursor-pointer items-center gap-2.5 rounded-10 border-0 px-3 text-left font-sans text-player-text',
            mobile ? 'min-h-12' : 'min-h-11.5',
            momentsOpen ? 'bg-player-open' : 'bg-transparent',
          )}
        >
          <BookmarkIcon className="size-4.5 flex-none stroke-[1.6] text-player-accent" />
          <span
            className={cn(
              'flex-1 text-15 leading-135',
              momentsOpen ? 'font-black' : 'font-bold',
            )}
          >
            Mis momentos
          </span>
          <span className="text-13 font-bold text-player-muted">
            {momentsTotal}
          </span>
        </button>
      )}

      {blocks.map(({ block, children }) => (
        <div key={block.id}>
          <div className="mx-3 mt-5.5 mb-2 text-11 font-black tracking-player-caps-lg text-player-accent uppercase">
            {block.title}
          </div>
          {children.map((c) =>
            c.type === 'lesson' ? (
              <Lesson
                key={c.id}
                lesson={c}
                current={c.id === currentId}
                slug={slug}
                nested={false}
                onNavigate={onNavigate}
                mobile={mobile}
              />
            ) : (
              <div key={c.id}>
                {(() => {
                  const expanded = chapterOpen(c, !!query && has(block.title))
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setOpen({ ...open, [c.id]: !open[c.id] })
                        }
                        className={cn(
                          'mt-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-10 border-0 px-3 text-left font-sans text-player-text',
                          mobile ? 'min-h-12' : 'min-h-11.5',
                          expanded ? 'bg-player-open' : 'bg-transparent',
                        )}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          className={cn(
                            'size-4 flex-none fill-none stroke-[1.8] transition-transform',
                            expanded
                              ? 'rotate-90 stroke-player-accent'
                              : 'stroke-player-muted',
                          )}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M6 3.5l4.5 4.5L6 12.5" />
                        </svg>
                        <span
                          className={cn(
                            'flex-1 text-15 leading-135',
                            expanded ? 'font-black' : 'font-bold',
                          )}
                        >
                          {c.title}
                        </span>
                        <span
                          className={cn(
                            'text-13 font-bold whitespace-nowrap',
                            expanded
                              ? 'text-player-accent'
                              : 'text-player-muted',
                          )}
                        >
                          {c.seenCount} de {c.lessons.length}
                        </span>
                      </button>
                      {expanded &&
                        c.lessons.map((l) => (
                          <Lesson
                            key={l.id}
                            lesson={l}
                            current={l.id === currentId}
                            slug={slug}
                            nested
                            onNavigate={onNavigate}
                            mobile={mobile}
                          />
                        ))}
                    </>
                  )
                })()}
              </div>
            ),
          )}
        </div>
      ))}
      {query && blocks.length === 0 && (
        <div className="px-3.5 py-6 text-sm leading-normal text-player-muted">
          No hay resultados para “{q}”. Prueba con otra palabra.
        </div>
      )}
    </div>
  )
}
