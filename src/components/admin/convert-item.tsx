import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { convertCourseItem } from '#/lib/admin-courses'

// "Convertir en lección" / "Convertir en capítulo". Si no se puede, el botón queda
// desactivado y dice por qué.
export function ConvertItem({
  id,
  to,
  blockedReason,
}: {
  id: string
  to: 'CHAPTER' | 'LESSON'
  blockedReason: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function convert() {
    setBusy(true)
    setError(null)
    try {
      const result = await convertCourseItem({ data: { id, to } })
      if ('error' in result) setError(result.error ?? null)
      else await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  const reason = blockedReason ?? error
  return (
    <>
      <button
        type="button"
        onClick={convert}
        disabled={busy || blockedReason !== null}
        title={blockedReason ?? undefined}
        className="h-9 cursor-pointer rounded-md border border-border bg-card px-3.5 font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {to === 'LESSON' ? 'Convertir en lección' : 'Convertir en capítulo'}
      </button>
      {reason && (
        <span className="basis-full text-xs text-muted-foreground">
          {reason}
        </span>
      )}
    </>
  )
}
