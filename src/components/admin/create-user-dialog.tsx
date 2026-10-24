import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  field,
  input,
  label,
  primaryButton,
} from '#/components/admin/form-styles'
import { createUser } from '#/lib/admin-users'

const secondaryButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium text-foreground disabled:opacity-60'

// "+ Crear usuario": nombre, correo y rol. La cuenta nace sin contraseña y recibe el enlace de
// acceso por correo; al crearla se abre su ficha para darle acceso a cursos.
export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [admin, setAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await createUser({ data: { name, email, admin } })
      if (!result.id)
        return setError(result.error ?? 'No se pudo crear el usuario.')
      await navigate({ to: '/admin/usuarios/$id', params: { id: result.id } })
    } catch {
      setError(
        'No se pudo crear el usuario. Revisa los datos e inténtalo de nuevo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 box-border flex items-center justify-center bg-black/45 p-8">
      <form
        onSubmit={submit}
        role="dialog"
        aria-label="Crear usuario"
        className="flex w-full max-w-110 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-admin-dialog"
      >
        <div className="flex flex-col gap-0.5 border-b border-border px-5 py-3.5">
          <span className="text-base font-semibold">Crear usuario</span>
          <span className="text-xs text-muted-foreground">
            Recibe un enlace por correo para entrar, sin contraseña.
          </span>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className={field}>
            <label htmlFor="new-name" className={label}>
              Nombre
            </label>
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              autoFocus
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="new-email" className={label}>
              Correo
            </label>
            <input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="new-role" className={label}>
              Rol
            </label>
            <select
              id="new-role"
              value={admin ? 'admin' : 'alumna'}
              onChange={(e) => setAdmin(e.target.value === 'admin')}
              className={input}
            >
              <option value="alumna">Alumna: entra a sus cursos</option>
              <option value="admin">Administrador: entra al panel</option>
            </select>
          </div>
          {error && <span className="text-13 text-destructive">{error}</span>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? 'Creando…' : 'Crear y enviar enlace'}
          </button>
        </div>
      </form>
    </div>
  )
}
