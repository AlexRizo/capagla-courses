import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { deleteCourseItem } from '#/lib/admin-courses'

// "Eliminar" con confirmación; borra también todo lo que cuelga del elemento.
export function DeleteItem({
  id,
  descendants,
  onDeleted,
}: {
  id: string
  descendants: number
  onDeleted: () => void
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      await deleteCourseItem({ data: { id } })
      onDeleted()
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="ml-auto h-9 cursor-pointer rounded-md border border-border bg-card px-3.5 font-medium text-destructive"
      >
        Eliminar
      </button>
    )
  }

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <span className="text-13 text-muted-foreground">
        {descendants > 0
          ? `Se eliminará también lo que contiene (${descendants}).`
          : 'Se eliminará este elemento.'}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="h-9 cursor-pointer rounded-md border-none bg-destructive px-3.5 font-medium text-white disabled:opacity-60"
      >
        Confirmar
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="h-9 cursor-pointer rounded-md border border-border bg-card px-3.5 font-medium"
      >
        Cancelar
      </button>
    </div>
  )
}
