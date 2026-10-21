import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  input,
  label,
  note,
  primaryButton,
} from '#/components/admin/form-styles'
import { FreeToggle } from '#/components/admin/free-toggle'
import { updateBlock } from '#/lib/admin-courses'

// Panel derecho del editor para un bloque: nombre y "bloque gratis".
export function BlockSettings({
  id,
  title,
  isFree,
  remove,
}: {
  id: string
  title: string
  isFree: boolean
  remove: React.ReactNode
}) {
  const router = useRouter()
  const [free, setFree] = useState(isFree)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setMessage(null)
    try {
      await updateBlock({
        data: { id, title: String(form.get('title')), isFree: free },
      })
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar. Revisa los datos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-1 basis-95 flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <div className="text-base font-semibold">Editar bloque</div>

      <div className={field}>
        <label htmlFor="title" className={label}>
          Nombre
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={title}
          className={input}
        />
      </div>

      <div className={note}>
        Los bloques solo separan el curso: llevan nombre y nada más. No tienen
        material y no se convierten en capítulo ni en lección.
      </div>

      <FreeToggle
        on={free}
        onChange={setFree}
        title="Bloque gratis (visible sin comprar)"
        description="Quien se registre con su correo ve todo este bloque sin pagar. Ahí nacen los leads."
      />

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
        {remove}
      </div>
    </form>
  )
}
