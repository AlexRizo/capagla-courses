import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { setLessonFavorite } from '#/lib/player'
import type { FavoriteGroup } from '#/lib/player-tree'
import { cn } from '#/lib/utils'

import { StarIcon } from './all-moments'

export const favoritesCount = (groups: FavoriteGroup[]) =>
  groups.reduce((total, g) => total + g.lessons.length, 0)

// "Lecciones guardadas": las que la alumna guardó con "Guardar lección", por módulo, para
// encontrarlas rápido. Al elegir una se abre; la estrella la quita de las guardadas.
export function AllFavorites({
  slug,
  groups,
  currentLessonId,
  onPick,
  mobile,
}: {
  slug: string
  groups: FavoriteGroup[]
  currentLessonId: string
  // Después de elegir una (en móvil cierra la ventana).
  onPick: () => void
  mobile?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(lessonId: string) {
    setBusy(lessonId)
    try {
      await setLessonFavorite({ data: { lessonId, favorite: false } })
      await router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  const intro = (
    <div className="px-1 text-13 leading-normal text-player-muted">
      Aquí están las lecciones que guardaste para encontrarlas rápido, por
      módulo. Toca una para abrirla. Para guardar una, toca «Guardar lección»
      debajo del video.
    </div>
  )

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <div className="px-1 text-sm leading-normal font-bold">
          Todavía no has guardado lecciones.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4.5">
      {intro}
      {groups.map((g) => (
        <div key={g.blockId} className="flex flex-col gap-1">
          <div className="px-1 pb-1 text-11 font-black tracking-player-caps-lg text-player-accent uppercase">
            {g.blockTitle}
          </div>
          {g.lessons.map((l) => (
            <div key={l.lessonId} className="flex items-center gap-1">
              <Link
                to="/mis-cursos/$slug/$lessonId"
                params={{ slug, lessonId: l.lessonId }}
                onClick={onPick}
                aria-current={
                  l.lessonId === currentLessonId ? 'page' : undefined
                }
                className={cn(
                  'flex min-w-0 flex-1 flex-col justify-center rounded-10 px-3 py-2 font-sans text-player-text no-underline',
                  mobile ? 'min-h-12' : 'min-h-11',
                  l.lessonId === currentLessonId && 'bg-player-open',
                )}
              >
                <span className="text-15 leading-135 font-bold">{l.title}</span>
                {l.chapterTitle && (
                  <span className="text-13 text-player-muted">
                    {l.chapterTitle}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => remove(l.lessonId)}
                disabled={busy === l.lessonId}
                aria-label={`Quitar «${l.title}» de las lecciones guardadas`}
                title="Quitar de guardadas"
                className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-player-accent disabled:opacity-50"
              >
                <StarIcon filled className="size-4.5 stroke-[1.6]" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
