import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { getMyCourses, sendTicket, setMyPassword } from '#/lib/session'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/mis-cursos/')({
  loader: () => getMyCourses(),
  component: MisCursos,
})

const primaryBtn =
  'min-h-12 cursor-pointer rounded-12 border-none bg-landing-primary px-6 text-base font-black text-white'
const textBtn =
  'min-h-12 cursor-pointer border-none bg-transparent px-4 text-15 font-bold text-landing-primary underline'
const label = 'text-15 font-bold'
const field =
  'box-border h-12.5 rounded-12 border-1.5 bg-white px-4 text-base text-landing-ink'
const formCard =
  'flex flex-col gap-4 rounded-2xl border-1.5 border-landing-primary bg-white px-7 py-6'
const okBox =
  'rounded-xl border border-landing-ok-line bg-landing-ok px-6 py-4 text-15 text-landing-ok-ink'
const menuItem =
  'cursor-pointer rounded-md border-none bg-transparent px-3 py-2.75 text-left text-15 text-landing-ink no-underline'

function MisCursos() {
  const data = Route.useLoaderData()!
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [step, setStep] = useState<'ask' | 'form' | 'done' | 'none'>(
    data.hasPassword ? 'none' : 'ask',
  )
  const [ticket, setTicket] = useState<'none' | 'form' | 'sent'>('none')

  const { name, email, isAdmin } = data.user
  const initial = name.charAt(0).toUpperCase()
  const course = data.courses.find((c) => c.slug === 'postres-navidad')
  const expires = course
    ? new Date(course.expiresAt).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''
  const active = course?.active ?? false
  const lessons = course?.lessons ?? 0
  const seen = course?.seen ?? 0
  const pct = lessons ? Math.round((seen / lessons) * 100) : 0

  function openTicket() {
    setTicket('form')
    setMenu(false)
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await setMyPassword({ data: { password: e.currentTarget.nueva.value } })
    setStep('done')
  }

  async function submitTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    await sendTicket({
      data: { tipo: form.tipo.value, detalle: form.detalle.value },
    })
    setTicket('sent')
  }

  async function logout() {
    await authClient.signOut()
    navigate({ to: '/entrar' })
  }

  return (
    <div className="min-h-screen bg-landing-page font-sans text-landing-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-landing-line bg-white px-4 py-2.5 md:px-8 md:py-4">
        <div className="text-22 font-black tracking-landing-logo text-landing-primary md:text-2xl">
          Capagla
        </div>
        <div className="flex items-center gap-1.5 md:gap-5">
          <Link
            to="/mis-cursos"
            className="hidden px-1 py-2.5 text-15 font-bold text-landing-primary no-underline md:block"
          >
            Mis cursos
          </Link>
          <div className="relative">
            <button
              type="button"
              aria-label="Menú de mi cuenta"
              onClick={() => setMenu(!menu)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-transparent p-0 text-15 text-landing-ink md:gap-2.5 md:px-2 md:py-1"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-landing-primary font-black text-white">
                {initial}
              </span>
              <span className="hidden md:inline">{name}</span>
              <span
                aria-hidden="true"
                className="hidden text-11 text-landing-muted md:inline"
              >
                ▾
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4.5 flex-none fill-none stroke-landing-muted stroke-2 md:hidden"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 6l4.5 4.5L12.5 6" />
              </svg>
            </button>
            {menu && (
              <div className="absolute top-12 right-0 z-10 flex w-65 flex-col rounded-xl border border-landing-line bg-white p-1.5 shadow-landing-menu">
                {isAdmin && (
                  <Link to="/admin" className={menuItem}>
                    Ir al panel
                  </Link>
                )}
                <a href="#" className={menuItem}>
                  Editar mi cuenta
                </a>
                <button type="button" onClick={openTicket} className={menuItem}>
                  Ayuda y reportar un fallo
                </button>
                <button type="button" onClick={logout} className={menuItem}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-260 flex-col gap-4 px-4 pt-5 md:gap-8 md:px-8 md:pt-12 md:pb-16">
        <div className="flex flex-col gap-1 md:gap-2">
          <h1 className="m-0 text-28 font-black tracking-landing-title-md md:text-36 md:tracking-landing-title-xl">
            Mis cursos
          </h1>
          <p className="m-0 text-15 text-landing-muted md:text-17">
            Aquí están tus cursos y tu avance.
          </p>
        </div>

        <div className="flex flex-col gap-3.5 md:gap-8">
          {step === 'ask' && (
            <div className="flex flex-col gap-2.5 rounded-16 border-1.5 border-landing-pink-line bg-landing-pink p-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-5 md:rounded-18 md:px-7 md:py-6">
              <div className="flex flex-col gap-1.5 md:grow md:basis-90">
                <div className="text-17 leading-120 font-black md:text-xl md:leading-normal">
                  Crea tu contraseña para entrar más fácil
                </div>
                <div className="text-sm leading-145 text-landing-muted md:text-15 md:leading-normal">
                  Así no dependes del correo cada vez. Tu usuario será {email}.
                </div>
              </div>
              <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className={primaryBtn}
                >
                  Crear contraseña ahora
                </button>
                <button
                  type="button"
                  onClick={() => setStep('none')}
                  className={textBtn}
                >
                  Ahora no, entraré siempre con enlace
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={savePassword} className={`${formCard} max-w-130`}>
              <div className="text-xl font-black">Crea tu contraseña</div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="usuario" className={label}>
                  Usuario (tu correo)
                </label>
                <input
                  id="usuario"
                  name="username"
                  type="email"
                  autoComplete="username"
                  value={email}
                  readOnly
                  className={`${field} border-landing-line bg-landing-soft`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nueva" className={label}>
                  Nueva contraseña
                </label>
                <input
                  id="nueva"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                  className={`${field} border-landing-field`}
                />
              </div>
              <div className="text-13 leading-normal text-landing-muted">
                Tu teléfono te ofrecerá guardarla junto con tu correo, para que
                no se te olvide con qué usuario entras.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={primaryBtn}>
                  Guardar contraseña
                </button>
                <button
                  type="button"
                  onClick={() => setStep('none')}
                  className={textBtn}
                >
                  Ahora no
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className={`${okBox} font-bold`}>
              Listo. Desde ahora entras con {email} y tu contraseña.
            </div>
          )}

          {ticket === 'form' && (
            <form
              id="ayuda"
              onSubmit={submitTicket}
              className={`${formCard} max-w-155`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xl font-black">
                  Reportar un fallo o pedir ayuda
                </div>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setTicket('none')}
                  className="size-9 cursor-pointer rounded-full border-none bg-landing-soft text-lg text-landing-primary"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tipo" className={label}>
                  ¿Qué te pasa?
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  className="box-border h-12.5 rounded-12 border-1.5 border-landing-field bg-white px-3 text-base text-landing-ink"
                >
                  <option>No puedo entrar a mi cuenta</option>
                  <option>Un video no carga o se corta</option>
                  <option>Problema con mi pago o mi acceso</option>
                  <option>Algo no funciona en el sitio</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="detalle" className={label}>
                  Cuéntanos qué pasó
                </label>
                <textarea
                  id="detalle"
                  name="detalle"
                  rows={4}
                  required
                  placeholder="Qué intentabas hacer y qué pasó en su lugar"
                  className="box-border resize-y rounded-12 border-1.5 border-landing-field bg-white px-3.5 py-3 text-base text-landing-ink"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className={label}>
                  Captura de pantalla{' '}
                  <span className="font-normal text-landing-muted">
                    (opcional)
                  </span>
                </div>
                <div
                  tabIndex={0}
                  className="box-border flex min-h-23 flex-col items-center justify-center gap-1 rounded-12 border-2 border-dashed border-landing-field bg-landing-dropzone p-3.5 text-center text-sm text-landing-muted"
                >
                  <span className="font-bold text-landing-ink">
                    Haz clic aquí y pega tu captura
                  </span>
                  <span>
                    con Ctrl + V (en Mac, ⌘ + V), o arrastra una imagen
                  </span>
                </div>
              </div>
              <div className="rounded-12 bg-landing-soft px-3.5 py-3 text-sm leading-normal text-landing-muted">
                ¿Dudas sobre una receta o una lección? Escríbelas en la pestaña{' '}
                <strong className="text-landing-ink">Preguntas</strong>, dentro
                de cada lección, para que la chef y los demás alumnos las vean.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={primaryBtn}>
                  Enviar reporte
                </button>
                <button
                  type="button"
                  onClick={() => setTicket('none')}
                  className={textBtn}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {ticket === 'sent' && (
            <div className={`${okBox} leading-normal`}>
              <strong>Recibimos tu reporte.</strong> Te respondemos a {email} en
              cuanto lo revisemos.
            </div>
          )}

          {course && (
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-landing-line bg-white md:flex-row md:flex-wrap md:rounded-20">
              <div className="aspect-video overflow-hidden bg-landing-cover md:relative md:aspect-auto md:min-h-55 md:grow md:basis-70">
                <img
                  src="/images/postres-navidad.jpg"
                  alt={course.name}
                  className="block size-full object-cover md:absolute md:inset-0"
                />
              </div>
              <div className="flex flex-col gap-3 p-4 md:grow-2 md:basis-100 md:justify-center md:gap-4 md:px-8 md:py-7">
                <div className="text-21 leading-115 font-black tracking-landing-title-sm md:text-26 md:leading-normal md:tracking-landing-logo">
                  {course.name}
                </div>
                <div className="text-sm text-landing-muted md:text-15">
                  11 recetas · Tu acceso {active ? 'vence' : 'venció'} el{' '}
                  {expires}
                </div>
                <div className="flex flex-col gap-1.5 md:gap-2">
                  <div className="h-2.5 overflow-hidden rounded-full bg-landing-track">
                    <div
                      className="h-full rounded-full bg-landing-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-13 text-landing-muted md:text-sm">
                    {seen} de {lessons} lecciones vistas · {pct}%
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                  <Link
                    to="/mis-cursos/$slug"
                    params={{ slug: course.slug }}
                    aria-disabled={!active}
                    className={cn(
                      'flex min-h-13 items-center justify-center rounded-12 bg-landing-primary text-17 font-black text-white no-underline md:inline-flex md:min-h-12.5 md:px-7',
                      !active && 'pointer-events-none opacity-50',
                    )}
                  >
                    Continuar progreso
                  </Link>
                  <a
                    href={active ? '#' : undefined}
                    aria-disabled={!active}
                    className={cn(
                      'flex min-h-11.5 items-center justify-center gap-2 rounded-12 border-1.5 border-landing-field text-sm font-bold text-landing-primary no-underline md:inline-flex md:min-h-12.5 md:px-4 md:text-15',
                      !active && 'pointer-events-none opacity-50',
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4.5 fill-none stroke-landing-primary stroke-2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 4v11" />
                      <path d="M7 11l5 5 5-5" />
                      <path d="M5 20h14" />
                    </svg>
                    Descargar recetario (PDF)
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-landing-line bg-white p-3 md:flex-wrap md:items-stretch md:gap-0 md:rounded-20 md:p-0">
            <div className="flex size-21 shrink-0 items-center justify-center rounded-12 bg-landing-ink p-1.5 text-center text-13 font-black text-landing-neon md:size-auto md:min-h-35 md:grow md:basis-70 md:rounded-none md:p-5 md:text-2xl">
              Herramienta de costos
            </div>
            <div className="flex flex-1 flex-col gap-2 md:grow-2 md:basis-100 md:justify-center md:gap-3 md:px-8 md:py-6">
              <div className="text-13 leading-snug text-landing-muted md:text-15 md:leading-normal">
                <span className="md:hidden">
                  Costo por porción y precio sugerido de cada receta.
                </span>
                <span className="hidden md:inline">
                  Calcula el costo por porción y el precio sugerido de cada
                  receta, con las recetas del curso ya cargadas.
                </span>
              </div>
              <div>
                <a
                  href="#"
                  className="inline-flex items-center justify-center self-start rounded-lg border-1.5 border-landing-primary px-3.5 py-2 text-sm font-black text-landing-primary no-underline md:min-h-11.5 md:rounded-12 md:px-6 md:py-0 md:text-base"
                >
                  Abrir herramienta
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4.5 flex flex-col gap-2.5 border-t border-landing-line bg-white p-4 text-13 text-landing-muted md:hidden">
        <button
          type="button"
          onClick={openTicket}
          className="cursor-pointer border-none bg-transparent p-0 text-left text-sm font-bold text-landing-primary"
        >
          Ayuda y reportar un fallo
        </button>
        <span>Las dudas de una lección van en su pestaña Preguntas.</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span>© Capagla</span>
          <a href="#" className="text-landing-muted">
            Aviso de privacidad
          </a>
          <a href="#" className="text-landing-muted">
            Términos y condiciones
          </a>
        </div>
      </div>
      <div className="hidden border-t border-landing-line bg-white md:block">
        <div className="mx-auto flex max-w-260 flex-wrap items-center justify-between gap-x-7 gap-y-3 px-8 py-5 text-sm text-landing-muted">
          <span>
            © Capagla · Las dudas de una lección van en su pestaña Preguntas.
          </span>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={openTicket}
              className="cursor-pointer border-none bg-transparent p-0 text-sm font-bold text-landing-primary"
            >
              Ayuda y reportar un fallo
            </button>
            <a href="#" className="text-landing-muted">
              Aviso de privacidad
            </a>
            <a href="#" className="text-landing-muted">
              Términos y condiciones
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
