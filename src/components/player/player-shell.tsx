import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { RichTextView } from '#/components/rich-text-view'
import { authClient } from '#/lib/auth-client'
import { setLessonSeen } from '#/lib/player'
import type { getPlayer } from '#/lib/player'
import { minutes } from '#/lib/player-tree'
import { cn } from '#/lib/utils'

import { CoursePanel, SearchIcon } from './course-panel'
import {
  ChapterMaterial,
  LessonTabs,
  hasChapterMaterial,
} from './lesson-extras'
import type { PlayerResource } from './lesson-extras'
import { Questions } from './questions'
import { VideoPlayer, VideoProvider } from './video'
import { VideoSide, useMarkMoment } from './video-side'

type Data = Awaited<ReturnType<typeof getPlayer>>

const THEME_KEY = 'capagla-player-theme'
const pill =
  'inline-flex min-h-10.5 items-center gap-2 rounded-full border border-player-border bg-player-surface px-4 text-sm font-bold text-player-text no-underline'
const iconButton =
  'flex size-8.5 flex-none cursor-pointer items-center justify-center rounded-10 border border-player-border bg-player-surface p-0'
const menuItem =
  'block w-full cursor-pointer border-0 bg-transparent px-3 py-2.75 text-left font-sans text-15 text-player-text no-underline'

// ¿Escritorio (768 o más)? Vale `undefined` hasta montar: ahí se pintan las dos vistas y ninguna
// carga el video; luego solo la que corresponde monta el `<video>`.
function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desktop
}

// "Amplia" (1440 o más): los dos paneles pueden estar abiertos; en pantallas menores, abrir uno cierra el otro.
function useWide() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1440px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 fill-none stroke-player-text stroke-[1.8]"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={left ? 'M10 3.5L5.5 8 10 12.5' : 'M6 3.5L10.5 8 6 12.5'} />
    </svg>
  )
}

function SeenButton({
  lesson,
  compact,
}: {
  lesson: Data['lesson']
  compact?: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    try {
      await setLessonSeen({ data: { lessonId: lesson.id, seen: !lesson.seen } })
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={cn(
        'inline-flex cursor-pointer items-center rounded-full border-2 py-0 font-sans font-black disabled:opacity-60',
        compact
          ? 'min-h-8 gap-1.75 pr-3 pl-1.5 text-13'
          : 'min-h-10 gap-2.5 pr-4.5 pl-2.5 text-sm',
        lesson.seen
          ? 'border-player-seen bg-player-seen text-white'
          : 'border-landing-accent bg-transparent text-landing-accent',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          compact ? 'size-4.5 text-11' : 'size-5.5 text-13',
          lesson.seen
            ? 'bg-white text-player-seen'
            : 'bg-landing-accent text-white',
        )}
      >
        ✓
      </span>
      {lesson.seen ? 'Vista' : 'Marcar como vista'}
    </button>
  )
}

function ThemeToggle({
  dark,
  onChange,
}: {
  dark: boolean
  onChange: (dark: boolean) => void
}) {
  const base =
    'size-7 cursor-pointer rounded-full border-none text-sm leading-none'
  const on = 'bg-player-toggle text-player-toggle-text'
  const off = 'bg-transparent text-player-muted'
  return (
    <div className="inline-flex rounded-full bg-player-track p-0.5">
      <button
        type="button"
        aria-label="Tema claro"
        onClick={() => onChange(false)}
        className={cn(base, dark ? off : on)}
      >
        ☀
      </button>
      <button
        type="button"
        aria-label="Tema oscuro"
        onClick={() => onChange(true)}
        className={cn(base, dark ? on : off)}
      >
        ☾
      </button>
    </div>
  )
}

function AccountMenu({
  user,
  small,
}: {
  user: Data['user']
  // Móvil: avatar de 36 px.
  small?: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-account-menu]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function logout() {
    await authClient.signOut()
    navigate({ to: '/entrar' })
  }

  const item = cn(menuItem, small && 'py-3')

  return (
    <div data-account-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Mi cuenta"
        className={cn(
          'cursor-pointer rounded-full border-none bg-player-accent font-black text-player-on-accent',
          small ? 'size-9 text-15' : 'size-10 text-base',
        )}
      >
        {user.name.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          className={cn(
            'absolute right-0 z-20 flex w-64.5 flex-col rounded-14 border border-player-border bg-player-surface p-2',
            small
              ? 'top-11 shadow-player-menu-mobile'
              : 'top-12 shadow-player-menu',
          )}
        >
          <div className="flex flex-col gap-0.5 border-b border-player-border px-3 py-2.5">
            <span className="text-15 font-black">{user.name}</span>
            <span className="text-13 text-player-muted">{user.email}</span>
          </div>
          <div className="px-3 pt-3 pb-1 text-11 font-black tracking-player-caps text-player-accent">
            MI CONTENIDO
          </div>
          {user.isAdmin && (
            <Link to="/admin" className={item}>
              Ir al panel
            </Link>
          )}
          <Link to="/mis-cursos" className={cn(item, 'font-bold')}>
            Mis cursos
          </Link>
          <div className="my-1.5 border-t border-player-border" />
          <div className="px-3 pt-1.5 pb-1 text-11 font-black tracking-player-caps text-player-accent">
            MI CUENTA
          </div>
          <a href="#" className={item}>
            Editar mi cuenta
          </a>
          <Link to="/mis-cursos" className={item}>
            Ayuda y reportar un fallo
          </Link>
          <button type="button" onClick={logout} className={item}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// Lo que se ve en lugar del video: la lección de texto muestra su texto; la de video, el reproductor
// (si tiene URL y esta es la vista activa) o el recuadro de la maqueta.
function LessonContent({
  data,
  showVideo,
  compact,
}: {
  data: Data
  showVideo: boolean
  compact?: boolean
}) {
  const { lesson, chapter } = data
  if (lesson.type === 'TEXT') {
    return (
      <div className="rounded-16 border border-player-border bg-player-surface p-6">
        {lesson.body ? (
          <RichTextView doc={lesson.body} className="text-base leading-160" />
        ) : (
          <div className="text-sm text-player-muted">
            Esta lección aún no tiene contenido.
          </div>
        )}
      </div>
    )
  }
  if (lesson.videoUrl && showVideo) {
    return (
      <VideoPlayer
        src={lesson.videoUrl}
        durationSec={lesson.durationSec}
        parts={lesson.parts}
        moments={lesson.moments}
        compact={compact}
      />
    )
  }
  return (
    <div
      className={cn(
        'relative flex aspect-video flex-none items-center justify-center overflow-hidden bg-player-video text-center font-bold text-landing-lilac',
        compact ? 'p-4 text-sm' : 'rounded-16 p-6',
      )}
    >
      {!lesson.videoUrl &&
        (compact ? (
          '[Reproductor de video]'
        ) : (
          <>
            [Reproductor de video · {chapter?.title ?? lesson.blockTitle},{' '}
            {lesson.title.toLowerCase()}]
          </>
        ))}
    </div>
  )
}

function PrevNext({
  slug,
  lesson,
  onMark,
  compact,
}: {
  slug: string
  lesson: Data['lesson']
  compact?: boolean
  // Solo en lecciones de video: marcar el minuto en el que va.
  onMark?: () => void
}) {
  const prev = cn(pill, compact && 'gap-1.5 px-3.5')
  const next = cn(
    'inline-flex min-h-10 items-center rounded-full bg-player-btn text-sm font-black text-player-btn-text no-underline',
    compact ? 'gap-1.5 px-4.5' : 'gap-2 px-5',
  )
  return (
    <div
      className={cn(
        'flex flex-none flex-wrap items-center',
        compact ? 'gap-2' : '-mt-1 gap-2.5',
      )}
    >
      {lesson.previousId ? (
        <Link
          to="/mis-cursos/$slug/$lessonId"
          params={{ slug, lessonId: lesson.previousId }}
          className={prev}
        >
          <span aria-hidden="true">←</span>Anterior
        </Link>
      ) : (
        <span className={cn(prev, 'opacity-50')}>
          <span aria-hidden="true">←</span>Anterior
        </span>
      )}
      {onMark && (
        <button
          type="button"
          onClick={onMark}
          disabled={!lesson.videoUrl}
          aria-label="Marcar este momento"
          title="Marcar este momento"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-player-border bg-player-surface p-0 text-player-accent disabled:cursor-default disabled:opacity-50"
        >
          <BookmarkIcon className="size-4 stroke-[1.8]" />
        </button>
      )}
      <div className="flex-1" />
      {lesson.nextId ? (
        <Link
          to="/mis-cursos/$slug/$lessonId"
          params={{ slug, lessonId: lesson.nextId }}
          className={next}
        >
          Siguiente<span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className={cn(next, 'opacity-50')}>
          Siguiente<span aria-hidden="true">→</span>
        </span>
      )}
    </div>
  )
}

function BookmarkIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      className={cn('fill-none stroke-current', className)}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 2.5h8v13l-4-3-4 3z" />
    </svg>
  )
}

function DocIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      className={cn('fill-none stroke-current stroke-[1.6]', className)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 2.5h6.5L14 5.5v10H4.5z" />
      <path d="M7 9h5M7 12h5" />
    </svg>
  )
}

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 22 22" className={className} aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="16"
        height="12"
        rx="2.5"
        className="fill-none stroke-current stroke-[1.7]"
      />
      <path d="M9.5 8.5l4 2.5-4 2.5z" className="fill-current" />
    </svg>
  )
}

function ChatIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      className={cn('fill-none stroke-current stroke-[1.7]', className)}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5h14v9H10l-4 3.5v-3.5H4z" />
    </svg>
  )
}

function LessonHeader({ data, compact }: { data: Data; compact?: boolean }) {
  const { lesson } = data
  const place = `Lección ${lesson.inGroup} de ${lesson.groupTotal}${
    lesson.type === 'VIDEO' && lesson.durationSec
      ? ` · ${minutes(lesson.durationSec)}`
      : ''
  }`
  if (compact) {
    return (
      <div className="flex flex-none items-end gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <div className="truncate text-xs text-player-muted">
            {lesson.blockTitle}
            {lesson.chapterTitle && ` › ${lesson.chapterTitle}`}
          </div>
          <h1 className="m-0 text-22 font-black tracking-landing-logo">
            {lesson.title}
          </h1>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.25">
          <SeenButton lesson={lesson} compact />
          <div className="text-xs font-bold text-player-muted">{place}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-none flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex flex-col gap-0.5">
        <div className="text-13 text-player-muted">
          {lesson.blockTitle}
          {lesson.chapterTitle && (
            <>
              <span className="px-1">›</span>
              {lesson.chapterTitle}
            </>
          )}
        </div>
        <h1 className="m-0 text-26 font-black tracking-landing-title-2xs">
          {lesson.title}
        </h1>
      </div>
      <div className="flex flex-col items-end gap-2">
        <SeenButton lesson={lesson} />
        <div className="text-13 font-bold text-player-muted">{place}</div>
      </div>
    </div>
  )
}

function ProgressSummary({ progress }: { progress: Data['progress'] }) {
  return (
    <div className="flex items-center gap-3 text-13 text-player-muted">
      <span>
        {progress.seen} de {progress.total} lecciones · {progress.pct}%
      </span>
      <div className="h-2 w-30 overflow-hidden rounded-full bg-player-track">
        <div
          className="h-full bg-player-accent"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  )
}

// Notas y recursos de ESTA lección más el material del capítulo, apilados (móvil).
function MobileMaterial({ data, material }: { data: Data; material: boolean }) {
  const { lesson, chapter } = data
  const resources: PlayerResource[] = lesson.resources
  return (
    <>
      <h2 className="m-0 text-22 font-black tracking-landing-title-sm">
        Material
      </h2>
      <div className="flex flex-col gap-5.5">
        {(lesson.notes || resources.length > 0) && (
          <div className="flex flex-col gap-2.5">
            <div className="text-11 font-black tracking-player-caps text-player-accent">
              SOLO DE ESTA LECCIÓN
            </div>
            {lesson.notes && (
              <div className="flex flex-col gap-2">
                <div className="text-17 font-black">Notas de esta lección</div>
                <div className="text-15 leading-160 whitespace-pre-line text-player-muted">
                  {lesson.notes}
                </div>
              </div>
            )}
            {resources.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="text-17 font-black">
                  Recursos de esta lección
                </div>
                {resources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-12 border border-player-border p-3.5"
                  >
                    <span className="text-15">{r.name}</span>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-player-accent no-underline"
                    >
                      Descargar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {material && chapter && (
          <ChapterMaterial chapter={chapter} note={false} />
        )}
      </div>
    </>
  )
}

export function PlayerShell({ data }: { data: Data }) {
  // Cada lección empieza con su video en 0.
  return (
    <VideoProvider key={data.lesson.id}>
      <PlayerLayout data={data} />
    </VideoProvider>
  )
}

function PlayerLayout({ data }: { data: Data }) {
  const { course, lesson, chapter, tree, progress, user } = data
  const wide = useWide()
  const isDesktop = useIsDesktop()
  const [dark, setDark] = useState(false)
  const [left, setLeft] = useState(true)
  const [right, setRight] = useState(true)
  const [rightTab, setRightTab] = useState<'mat' | 'vid'>('mat')
  const [mobileTab, setMobileTab] = useState<'les' | 'mat' | 'preg'>('les')
  const [searchFromRail, setSearchFromRail] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === 'dark') setDark(true)
    } catch {
      // Sin almacenamiento: queda el tema claro.
    }
  }, [])
  // En pantallas menores a 1440 no caben los dos paneles: se queda abierto solo uno.
  useEffect(() => {
    if (!wide && left && right) setLeft(false)
  }, [wide, left, right])

  function chooseTheme(next: boolean) {
    setDark(next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      // Sin almacenamiento: el tema vale solo para esta visita.
    }
  }

  const isVideo = lesson.type === 'VIDEO'
  const material = hasChapterMaterial(chapter)
  const hasRight = material || isVideo
  // Pestaña que se ve: la elegida si existe para esta lección; si no, la que haya.
  const tab =
    rightTab === 'mat' && !material
      ? 'vid'
      : rightTab === 'vid' && !isVideo
        ? 'mat'
        : rightTab
  // Lo que se ve en móvil: la lección de texto no tiene la vista "Lección".
  const view = isVideo || mobileTab === 'preg' ? mobileTab : 'mat'
  const resources: PlayerResource[] = lesson.resources
  const marker = useMarkMoment(lesson.id, !!lesson.videoUrl)

  const toggleLeft = (search = false) => {
    setSearchFromRail(search)
    if (left && !search) return setLeft(false)
    setLeft(true)
    if (!wide) setRight(false)
  }
  const toggleRight = () => {
    if (right) return setRight(false)
    setRight(true)
    if (!wide) setLeft(false)
  }
  const openRightTab = (next: 'mat' | 'vid') => {
    setRightTab(next)
    setRight(true)
    if (!wide) setLeft(false)
  }
  async function markMoment() {
    await marker.mark()
    if (isDesktop) openRightTab('vid')
    else setMobileTab('les')
  }

  const rightPanel = (
    <>
      {material && isVideo && (
        <div className="flex flex-1 rounded-12 bg-player-track p-0.75">
          {(
            [
              ['mat', 'Material'],
              ['vid', 'En este video'],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRightTab(id)}
              className={cn(
                'flex-1 cursor-pointer rounded-lg border-0 px-1.5 py-2 font-sans text-13 font-black',
                tab === id
                  ? 'bg-player-surface text-player-accent'
                  : 'bg-transparent text-player-muted',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div
      className={cn(
        'player min-h-screen bg-player-bg font-sans text-player-text',
        dark && 'dark',
      )}
    >
      {/* ===== Escritorio ===== */}
      <div className="hidden h-screen md:flex">
        {left ? (
          <aside className="flex w-85 flex-none flex-col border-r border-player-border bg-player-side">
            <CoursePanel
              slug={course.slug}
              tree={tree}
              currentId={lesson.id}
              currentChapterId={lesson.chapterId}
              onClose={() => toggleLeft()}
              startSearching={searchFromRail}
            />
          </aside>
        ) : (
          <aside className="flex w-16 flex-none flex-col items-center gap-3.5 border-r border-player-border bg-player-side py-4.5">
            <button
              type="button"
              onClick={() => toggleLeft()}
              aria-label="Mostrar el menú del curso"
              className={iconButton}
            >
              <Chevron />
            </button>
            <button
              type="button"
              onClick={() => toggleLeft(true)}
              aria-label="Buscar en el curso"
              className="flex size-9 cursor-pointer items-center justify-center rounded-10 border-0 bg-transparent"
            >
              <SearchIcon />
            </button>
            <div className="w-9 border-t border-player-border" />
            <div className="flex flex-col items-center gap-0.5 text-11 font-black text-player-accent">
              <span>{progress.seen}</span>
              <span className="font-normal text-player-muted">
                de {progress.total}
              </span>
            </div>
          </aside>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="box-border flex h-15 flex-none items-center gap-5 border-b border-player-border bg-player-side px-6">
            <div className="text-15 font-black">{course.name}</div>
            <div className="flex-1" />
            <ProgressSummary progress={progress} />
            <ThemeToggle dark={dark} onChange={chooseTheme} />
            <AccountMenu user={user} />
          </div>

          <div className="flex min-h-0 flex-1">
            <main className="box-border flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pt-5.5 pb-10">
              <div
                className="mx-auto flex flex-none flex-col gap-4"
                style={{ width: 'min(100%, calc((100vh - 340px) * 16 / 9))' }}
              >
                <LessonHeader data={data} />
                <LessonContent data={data} showVideo={isDesktop === true} />
                <PrevNext
                  slug={course.slug}
                  lesson={lesson}
                  onMark={isVideo ? markMoment : undefined}
                />
                <LessonTabs
                  key={lesson.id}
                  lessonId={lesson.id}
                  notes={lesson.notes}
                  resources={resources}
                  questions={lesson.questions}
                />
              </div>
            </main>

            {hasRight &&
              (right ? (
                <aside className="flex w-85 flex-none flex-col gap-4 overflow-y-auto border-l border-player-border bg-player-side px-4 pt-4.5 pb-6">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={toggleRight}
                      aria-label="Ocultar el panel"
                      className={iconButton}
                    >
                      <Chevron />
                    </button>
                    {rightPanel}
                  </div>
                  {tab === 'mat' && chapter && (
                    <ChapterMaterial chapter={chapter} />
                  )}
                  {tab === 'vid' && (
                    <VideoSide
                      lessonId={lesson.id}
                      hasVideo={!!lesson.videoUrl}
                      parts={lesson.parts}
                      moments={lesson.moments}
                    />
                  )}
                </aside>
              ) : (
                <aside className="flex w-16 flex-none flex-col items-center gap-3.5 border-l border-player-border bg-player-side py-4.5">
                  <button
                    type="button"
                    onClick={toggleRight}
                    aria-label="Mostrar el panel"
                    className={iconButton}
                  >
                    <Chevron left />
                  </button>
                  <div className="w-9 border-t border-player-border" />
                  {material && (
                    <button
                      type="button"
                      onClick={() => openRightTab('mat')}
                      aria-label="Material del capítulo"
                      className={iconButton}
                    >
                      <DocIcon className="size-4.5 text-player-text" />
                    </button>
                  )}
                  {isVideo && (
                    <button
                      type="button"
                      onClick={() => openRightTab('vid')}
                      aria-label="Partes y momentos"
                      className={cn(iconButton, 'relative')}
                    >
                      <BookmarkIcon className="size-4.5 stroke-[1.6] text-player-text" />
                      <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-player-accent text-11 font-black text-player-on-accent">
                        {lesson.moments.length}
                      </span>
                    </button>
                  )}
                </aside>
              ))}
          </div>
        </div>
      </div>

      {/* ===== Móvil ===== */}
      <div className="flex min-h-screen flex-col md:hidden">
        <div className="box-border flex h-15 flex-none items-center gap-2.5 border-b border-player-border bg-player-side px-3">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Abrir el menú del curso"
            className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-10 border border-player-border bg-player-surface p-0"
          >
            <svg
              viewBox="0 0 22 22"
              className="size-5 fill-none stroke-player-text stroke-[1.9]"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h14M4 11h14M4 16h14" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1.25">
            <div className="truncate text-sm font-black">{course.name}</div>
            <div className="flex items-center gap-2 text-xs text-player-muted">
              <span className="whitespace-nowrap">
                {progress.seen} de {progress.total} · {progress.pct}%
              </span>
              <div className="h-1.25 flex-1 overflow-hidden rounded-full bg-player-track">
                <div
                  className="h-full bg-player-accent"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => chooseTheme(!dark)}
            aria-label="Cambiar tema"
            className="size-9 flex-none cursor-pointer rounded-full border-0 bg-player-track text-base text-player-text"
          >
            {dark ? '☀' : '☾'}
          </button>
          <AccountMenu user={user} small />
        </div>

        <LessonHeader data={data} compact />
        {isVideo ? (
          <LessonContent data={data} showVideo={isDesktop === false} compact />
        ) : (
          <div className="px-4">
            <LessonContent data={data} showVideo={false} />
          </div>
        )}
        <div className="border-b border-player-border px-4 py-2.5">
          <PrevNext
            slug={course.slug}
            lesson={lesson}
            onMark={isVideo ? markMoment : undefined}
            compact
          />
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-6">
          {view === 'les' && (
            <VideoSide
              lessonId={lesson.id}
              hasVideo={!!lesson.videoUrl}
              parts={lesson.parts}
              moments={lesson.moments}
            />
          )}
          {view === 'mat' && <MobileMaterial data={data} material={material} />}
          {view === 'preg' && (
            <Questions lessonId={lesson.id} questions={lesson.questions} page />
          )}
        </div>

        <div className="sticky bottom-0 flex flex-none border-t border-player-border bg-player-side px-2 pt-1.5 pb-3.5">
          {(
            [
              ...(isVideo ? [['les', 'Lección', PlayIcon] as const] : []),
              ['mat', 'Material', DocIcon],
              ['preg', 'Preguntas', ChatIcon],
            ] as const
          ).map(([id, text, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={cn(
                'flex flex-1 cursor-pointer flex-col items-center gap-0.75 border-0 bg-transparent py-1.5 font-sans text-xs font-bold',
                view === id ? 'text-player-accent' : 'text-player-muted',
              )}
            >
              <span className="relative inline-flex">
                <Icon className="size-5.5" />
                {id === 'preg' && (
                  <span className="absolute -top-1.25 -right-2.75 flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-player-accent text-11 font-black text-player-on-accent">
                    {lesson.questions.length}
                  </span>
                )}
              </span>
              {text}
            </button>
          ))}
        </div>

        {drawer && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40"
              onClick={() => setDrawer(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-40 flex w-[88%] max-w-85 flex-col border-r border-player-border bg-player-side shadow-player-drawer">
              <CoursePanel
                slug={course.slug}
                tree={tree}
                currentId={lesson.id}
                currentChapterId={lesson.chapterId}
                onClose={() => setDrawer(false)}
                onNavigate={() => setDrawer(false)}
                mobile
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
