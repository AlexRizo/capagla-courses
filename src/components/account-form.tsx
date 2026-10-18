import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  formCard,
  label,
  primaryBtn,
} from '#/components/landing-form-styles'
import { changeMyPassword, setMyPassword, updateMyName } from '#/lib/session'

const saved = 'text-15 font-bold text-landing-ok-ink'
const failed = 'text-15 font-bold text-landing-primary'

// "Editar mi cuenta" (menú de Mis cursos): el nombre y la contraseña, cada uno con su botón.
// El correo solo se muestra: es con el que compró y entra, y sus órdenes y accesos cuelgan de él.
export function AccountForm({
  name,
  email,
  hasPassword,
  onPasswordSet,
  onClose,
}: {
  name: string
  email: string
  hasPassword: boolean
  // Ya tiene contraseña: el aviso "Crea tu contraseña" de Mis cursos sobra.
  onPasswordSet: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string }>()
  const [passwordNote, setPasswordNote] = useState<{
    ok: boolean
    text: string
  }>()
  const [busy, setBusy] = useState<'name' | 'password'>()
  // Una contraseña creada aquí pasa a ser "cambiar" sin esperar a que se recargue la página.
  const [has, setHas] = useState(hasPassword)

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = String(new FormData(e.currentTarget).get('name') ?? '').trim()
    if (!next) return setNameNote({ ok: false, text: 'Escribe tu nombre.' })
    setBusy('name')
    setNameNote(undefined)
    try {
      await updateMyName({ data: { name: next } })
      await router.invalidate()
      setNameNote({ ok: true, text: 'Listo. Guardamos tu nombre.' })
    } catch {
      setNameNote({
        ok: false,
        text: 'No pudimos guardar tu nombre. Inténtalo de nuevo.',
      })
    } finally {
      setBusy(undefined)
    }
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const password = String(data.get('new-password') ?? '')
    setBusy('password')
    setPasswordNote(undefined)
    try {
      if (has) {
        const result = await changeMyPassword({
          data: {
            current: String(data.get('current-password') ?? ''),
            password,
          },
        })
        if (result.error) {
          return setPasswordNote({ ok: false, text: result.error })
        }
      } else {
        await setMyPassword({ data: { password } })
        setHas(true)
        onPasswordSet()
      }
      form.reset()
      setPasswordNote({
        ok: true,
        text: has
          ? 'Listo. Tu contraseña se actualizó.'
          : `Listo. Desde ahora entras con ${email} y tu contraseña.`,
      })
    } catch {
      setPasswordNote({
        ok: false,
        text: 'No pudimos guardar tu contraseña. Inténtalo de nuevo.',
      })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div id="cuenta" className={`${formCard} max-w-130`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xl font-black">Editar mi cuenta</div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="size-9 cursor-pointer rounded-full border-none bg-landing-soft text-lg text-landing-primary"
        >
          ×
        </button>
      </div>

      <form onSubmit={saveName} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cuenta-nombre" className={label}>
            Nombre
          </label>
          <input
            id="cuenta-nombre"
            name="name"
            type="text"
            autoComplete="name"
            defaultValue={name}
            maxLength={80}
            required
            className={`${field} border-landing-field`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cuenta-correo" className={label}>
            Correo
          </label>
          <input
            id="cuenta-correo"
            type="email"
            value={email}
            readOnly
            className={`${field} border-landing-line bg-landing-soft`}
          />
          <div className="text-13 leading-normal text-landing-muted">
            Es con el que compraste y entras, por eso no se cambia aquí. Si
            necesitas otro, escríbenos desde «Ayuda y reportar un fallo».
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy === 'name'}
            className={primaryBtn}
          >
            Guardar nombre
          </button>
          {nameNote && (
            <span role="status" className={nameNote.ok ? saved : failed}>
              {nameNote.text}
            </span>
          )}
        </div>
      </form>

      <div className="border-t border-landing-line" />

      <form onSubmit={savePassword} className="flex flex-col gap-4">
        <div className="text-17 font-black">
          {has ? 'Cambiar tu contraseña' : 'Crea tu contraseña'}
        </div>
        <input
          name="username"
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
        {has && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cuenta-actual" className={label}>
              Contraseña actual
            </label>
            <input
              id="cuenta-actual"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              className={`${field} border-landing-field`}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cuenta-nueva" className={label}>
            Nueva contraseña
          </label>
          <input
            id="cuenta-nueva"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            required
            className={`${field} border-landing-field`}
          />
        </div>
        {!has && (
          <div className="text-13 leading-normal text-landing-muted">
            Así no dependes del correo cada vez. Tu teléfono te ofrecerá
            guardarla junto con tu correo.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy === 'password'}
            className={primaryBtn}
          >
            {has ? 'Cambiar contraseña' : 'Guardar contraseña'}
          </button>
          {passwordNote && (
            <span role="status" className={passwordNote.ok ? saved : failed}>
              {passwordNote.text}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
