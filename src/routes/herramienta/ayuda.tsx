import { createFileRoute } from '@tanstack/react-router'
import { Play } from 'lucide-react'

import { useToolHelp } from '#/components/tool/tool-help'
import { HELP_TOPICS, helpDuration } from '#/lib/tool-help'

// /herramienta/ayuda (tema 11): todos los videos de ayuda que ya existen para su nivel. Los datos
// los trae el marco de la herramienta (`getToolUsage`).
export const Route = createFileRoute('/herramienta/ayuda')({
  component: Ayuda,
})

function Ayuda() {
  const { videos, open } = useToolHelp()
  const shown = HELP_TOPICS.flatMap((t) => {
    const video = videos.find((v) => v.key === t.key)
    return video ? [{ ...t, seconds: video.seconds }] : []
  })

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Ayuda</h1>
        <p className="m-0 mt-1 max-w-165 leading-normal text-muted-foreground">
          Un video corto por sección, con Gladis. Si es tu primera vez, empieza
          por la bienvenida.
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="m-0 text-muted-foreground">
          Pronto vas a encontrar aquí los videos de ayuda.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
          {shown.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => open(t.key)}
              aria-label={`Ver ${t.key}: ${t.title}`}
              className="flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card p-0 text-left font-tool text-sm text-foreground shadow-xs"
            >
              <div className="relative flex aspect-video w-full items-center justify-center bg-sidebar text-white">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-white pl-0.75 text-sidebar">
                  <Play className="size-4.5 fill-current" aria-hidden="true" />
                </span>
                <span className="absolute top-2.5 left-2.5 text-xs font-semibold tracking-wider text-sidebar-muted">
                  {t.key}
                </span>
                <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/45 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                  {helpDuration(t.seconds)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="leading-tight font-semibold">{t.title}</span>
                  {t.module && (
                    <span className="rounded-md bg-secondary px-1.5 py-px text-11 font-medium text-secondary-foreground">
                      Completo
                    </span>
                  )}
                </div>
                <span className="leading-snug text-muted-foreground">
                  {t.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
