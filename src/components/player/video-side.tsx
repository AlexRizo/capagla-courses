import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { addMoment, deleteMoment, renameMoment } from '#/lib/player'
import { clock, partAt } from '#/lib/duration'
import type { VideoPart } from '#/lib/duration'
import { cn } from '#/lib/utils'

import { useVideo } from './video'

type Moment = { id: string; seconds: number; name: string }

const label = 'text-11 font-black tracking-player-caps text-player-accent'

// Marca el minuto en el que va el video. Devuelve un aviso si no se pudo.
export function useMarkMoment(lessonId: string, hasVideo: boolean) {
  const router = useRouter()
  const { time } = useVideo()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mark() {
    if (!hasVideo || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await addMoment({
        data: { lessonId, seconds: Math.floor(time) },
      })
      if (result.error) setError(result.error)
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }
  return { mark, saving, error, time, canMark: hasVideo }
}

function MomentRow({ moment }: { moment: Moment }) {
  const router = useRouter()
  const { seek } = useVideo()
  const [name, setName] = useState(moment.name)

  async function save() {
    const next = name.trim()
    if (!next) return setName(moment.name)
    if (next === moment.name) return
    await renameMoment({ data: { id: moment.id, name: next } })
    await router.invalidate()
  }

  async function remove() {
    await deleteMoment({ data: { id: moment.id } })
    await router.invalidate()
  }

  return (
    <div className="flex min-h-11 items-center gap-3 rounded-10 border border-player-border bg-player-surface pr-1.5 pl-3">
      <button
        type="button"
        onClick={() => seek(moment.seconds)}
        aria-label={`Ir al minuto ${clock(moment.seconds)}`}
        className="w-11 cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-13 font-bold text-player-accent"
      >
        {clock(moment.seconds)}
      </button>
      <input
        type="text"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Nombre del momento"
        className="box-border h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-sans text-sm text-player-text"
      />
      <button
        type="button"
        onClick={remove}
        aria-label="Quitar momento"
        className="size-7.5 cursor-pointer rounded-lg border-0 bg-transparent text-15 text-player-muted"
      >
        ✕
      </button>
    </div>
  )
}

// "En este video": las partes (saltan al minuto) y los momentos de la alumna.
export function VideoSide({
  lessonId,
  hasVideo,
  parts,
  moments,
}: {
  lessonId: string
  hasVideo: boolean
  parts: VideoPart[]
  moments: Moment[]
}) {
  const { time, seek } = useVideo()
  const { mark, saving, error, canMark } = useMarkMoment(lessonId, hasVideo)
  const current = partAt(parts, time)

  return (
    <div className="flex flex-col gap-4.5">
      {parts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className={label}>PARTES DEL VIDEO</div>
          {parts.map((p) => {
            const active = p === current
            return (
              <button
                key={p.seconds}
                type="button"
                onClick={() => seek(p.seconds)}
                className={cn(
                  'flex min-h-10.5 w-full cursor-pointer items-center gap-3 rounded-10 border-0 px-3 text-left font-sans',
                  active ? 'bg-player-open' : 'bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'w-11 text-13 font-bold',
                    active ? 'text-player-accent' : 'text-player-muted',
                  )}
                >
                  {clock(p.seconds)}
                </span>
                <span
                  className={cn(
                    'flex-1 text-sm text-player-text',
                    active ? 'font-black' : 'font-normal',
                  )}
                >
                  {p.title}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className={label}>MIS MOMENTOS</div>
          <button
            type="button"
            onClick={mark}
            disabled={!canMark || saving}
            className="cursor-pointer border-0 bg-transparent px-1.5 py-px font-sans text-13 font-black text-player-accent disabled:opacity-50"
          >
            + Marcar {clock(time)}
          </button>
        </div>
        {error && <div className="text-13 text-landing-warn-line">{error}</div>}
        {moments.map((m) => (
          <MomentRow key={`${m.id}-${m.name}`} moment={m} />
        ))}
        {moments.length === 0 && (
          <div className="px-0.5 py-1 text-13 leading-normal text-player-muted">
            Aún no marcas nada. Pulsa el icono de marcador junto al video; el
            momento toma el nombre de la parte en la que vas y puedes cambiarlo.
          </div>
        )}
      </div>
    </div>
  )
}
