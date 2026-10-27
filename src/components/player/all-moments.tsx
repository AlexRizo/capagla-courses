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

  if (groups.length === 0) {
    return (
      <div className="px-1 text-sm leading-normal text-player-muted">
        Todavía no has guardado momentos. Mientras ves un video, toca «Marcar» y
        aparecerá aquí, con el nombre del tema en ese minuto.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4.5">
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
