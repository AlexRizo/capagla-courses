import { Link } from '@tanstack/react-router'

import { clock } from '#/lib/duration'
import type { MomentGroup } from '#/lib/player-tree'
import { cn } from '#/lib/utils'

import { useVideo } from './video'

export function BookmarkIcon({ className }: { className: string }) {
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

// Estrella: "Guardar lección" (la lección completa). El marcador de arriba es de los momentos.
export function StarIcon({
  className,
  filled,
}: {
  className: string
  filled?: boolean
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      className={cn(
        'stroke-current',
        filled ? 'fill-current' : 'fill-none',
        className,
      )}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 2l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 13l-4.3 2.4.9-4.9L2 7.1l4.9-.6z" />
    </svg>
  )
}

export const momentsCount = (groups: MomentGroup[]) =>
  groups.reduce(
    (total, g) => total + g.lessons.reduce((n, l) => n + l.moments.length, 0),
    0,
  )

// "Mis momentos" del curso: todos los que la alumna guardó, por módulo y lección. Al elegir uno
// se abre su video en ese segundo (`?t=`); si es de la lección que ya está abierta, solo salta.
export function AllMoments({
  slug,
  groups,
  currentLessonId,
  onPick,
  mobile,
}: {
  slug: string
  groups: MomentGroup[]
  currentLessonId: string
  // Después de elegir uno (en móvil cierra la ventana).
  onPick: () => void
  mobile?: boolean
}) {
  const { seek } = useVideo()
  const row = cn(
    'flex w-full cursor-pointer items-center gap-3 rounded-10 border-0 bg-transparent px-3 text-left font-sans text-player-text no-underline',
    mobile ? 'min-h-12' : 'min-h-10.5',
  )

  const intro = (
    <div className="px-1 text-13 leading-normal text-player-muted">
      Aquí están todos los minutos que guardaste en el curso, ordenados por
      módulo y lección. Toca uno para abrir el video justo en ese minuto. Para
      guardar uno nuevo, toca «+ Guardar momento» mientras ves un video.
    </div>
  )

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <div className="px-1 text-sm leading-normal font-bold">
          Todavía no has guardado momentos.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4.5">
      {intro}
      {groups.map((g) => (
        <div key={g.blockId} className="flex flex-col gap-2">
          <div className="px-1 text-11 font-black tracking-player-caps-lg text-player-accent uppercase">
            {g.blockTitle}
          </div>
          {g.lessons.map((l) => (
            <div key={l.lessonId} className="flex flex-col gap-0.5">
              <div className="px-3 pt-1 text-15 leading-135 font-black">
                {l.title}
                {l.chapterTitle && (
                  <span className="block text-13 font-normal text-player-muted">
                    {l.chapterTitle}
                  </span>
                )}
              </div>
              {l.moments.map((m) => {
                const content = (
                  <>
                    <span className="w-11 flex-none text-13 font-bold text-player-accent">
                      {clock(m.seconds)}
                    </span>
                    <span className="flex-1 text-sm">{m.name}</span>
                  </>
                )
                return l.lessonId === currentLessonId ? (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      seek(m.seconds)
                      onPick()
                    }}
                    aria-label={`Ir al minuto ${clock(m.seconds)}: ${m.name}`}
                    className={row}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    key={m.id}
                    to="/mis-cursos/$slug/$lessonId"
                    params={{ slug, lessonId: l.lessonId }}
                    search={{ t: m.seconds }}
                    onClick={onPick}
                    aria-label={`Abrir «${l.title}» en el minuto ${clock(m.seconds)}: ${m.name}`}
                    className={row}
                  >
                    {content}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
