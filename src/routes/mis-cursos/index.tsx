import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { AccountForm } from '#/components/account-form'
import {
  field,
  formCard,
  label,
  okBox,
  primaryBtn,
  textBtn,
} from '#/components/landing-form-styles'
import { authClient } from '#/lib/auth-client'
import { RENEWAL_DISCOUNT_PCT, mxn } from '#/lib/catalog'
import { getMyCourses, sendTicket, setMyPassword } from '#/lib/session'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/mis-cursos/')({
  // `?cuenta` (desde el menú del reproductor) abre "Editar mi cuenta".
  validateSearch: z.object({
    cuenta: z.boolean().optional().catch(undefined),
  }),
  loader: () => getMyCourses(),
  component: MisCursos,
})

const menuItem =
  'cursor-pointer rounded-md border-none bg-transparent px-3 py-2.75 text-left text-15 text-landing-ink no-underline'

function MisCursos() {
  const data = Route.useLoaderData()!
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [menu, setMenu] = useState(false)
  const [account, setAccount] = useState(!!search.cuenta)
  const [step, setStep] = useState<'ask' | 'form' | 'done' | 'none'>(
    data.hasPassword ? 'none' : 'ask',
  )
  const [ticket, setTicket] = useState<'none' | 'form' | 'sent'>('none')

  const { name, email, isAdmin } = data.user
  const initial = name.charAt(0).toUpperCase()

  function openTicket() {
    setTicket('form')
    setMenu(false)
  }

  function openAccount() {
    setAccount(true)
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
                <button
                  type="button"
                  onClick={openAccount}
                  className={menuItem}
                >
                  Editar mi cuenta
                </button>
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

          {account && (
            <AccountForm
              name={name}
              email={email}
              hasPassword={data.hasPassword}
              onPasswordSet={() => setStep('none')}
              onClose={() => setAccount(false)}
            />
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

          {data.courses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
          {data.freeCourses.map((course) => (
            <FreeCourseCard key={course.slug} course={course} />
          ))}

          {data.tool && <ToolCard tool={data.tool} />}
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

type MyCourse = NonNullable<
  Awaited<ReturnType<typeof getMyCourses>>
>['courses'][number]

type FreeCourse = NonNullable<
  Awaited<ReturnType<typeof getMyCourses>>
>['freeCourses'][number]

type MyTool = NonNullable<
  NonNullable<Awaited<ReturnType<typeof getMyCourses>>>['tool']
>

// Curso que la cuenta aún no tiene: la misma tarjeta, con su clase gratis y la compra
// ("Quiero el curso" va al checkout y, al pagar, vuelve aquí).
function FreeCourseCard({ course }: { course: FreeCourse }) {
  const { lessons, seen } = course
  const pct = lessons ? Math.round((seen / lessons) * 100) : 0

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-landing-line bg-white md:flex-row md:flex-wrap md:rounded-20">
      <div className="aspect-video overflow-hidden bg-landing-cover md:relative md:aspect-auto md:min-h-55 md:grow md:basis-70">
        {course.coverUrl && (
          <img
            src={course.coverUrl}
            alt={course.name}
            className="block size-full object-cover md:absolute md:inset-0"
          />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4 md:grow-2 md:basis-100 md:justify-center md:gap-4 md:px-8 md:py-7">
        <div className="text-21 leading-115 font-black tracking-landing-title-sm md:text-26 md:leading-normal md:tracking-landing-logo">
          {course.name}
        </div>
        <div className="text-sm text-landing-muted md:text-15">
          Clase gratis · {lessons} {lessons === 1 ? 'lección' : 'lecciones'}
        </div>
        <div className="flex flex-col gap-1.5 md:gap-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-landing-track">
            <div
              className="h-full rounded-full bg-landing-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-13 text-landing-muted md:text-sm">
            {seen} de {lessons}{' '}
            {lessons === 1 ? 'lección vista' : 'lecciones vistas'} · {pct}%
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <Link
            to="/mis-cursos/$slug"
            params={{ slug: course.slug }}
            className="flex min-h-13 items-center justify-center rounded-12 bg-landing-primary text-17 font-black text-white no-underline md:inline-flex md:min-h-12.5 md:px-7"
          >
            Ver clase gratis
          </Link>
          <Link
            to="/checkout"
            search={{ desde: 'mis-cursos' }}
            className="flex min-h-11.5 items-center justify-center rounded-12 border-1.5 border-landing-field text-sm font-bold text-landing-primary no-underline md:inline-flex md:min-h-12.5 md:px-4 md:text-15"
          >
            Quiero el curso
          </Link>
        </div>
      </div>
    </div>
  )
}

// Tarjeta de un curso comprado: avance, vencimiento, "Continuar progreso" y recetario.
// Herramienta de costos. Con acceso la abre; sin él ofrece comprarla a precio normal; vencida o
// por vencer, renovarla con descuento (misma regla que los cursos). Ninguno de los tres botones
// ni los avisos están en la maqueta (decisión del cliente, 2026-10-26).
function ToolCard({ tool }: { tool: MyTool }) {
  const { active, renewalMxn, accessDays, options } = tool
  const daysLeft = tool.expiresAt
    ? Math.ceil(
        (new Date(tool.expiresAt).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )
    : 0
  const buttonClass =
    'inline-flex items-center justify-center self-start rounded-lg bg-landing-primary px-3.5 py-2 text-sm font-black text-white no-underline md:min-h-11.5 md:rounded-12 md:px-6 md:py-0 md:text-base'
  const renewLink = {
    to: '/checkout',
    search: { renovar: tool.slug, desde: 'mis-cursos' },
  } as const

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-landing-line bg-white p-3 md:flex-wrap md:items-stretch md:gap-0 md:rounded-20 md:p-0">
      <div className="flex size-21 shrink-0 items-center justify-center rounded-12 bg-landing-ink p-1.5 text-center text-13 font-black text-landing-neon md:size-auto md:min-h-35 md:grow md:basis-70 md:rounded-none md:p-5 md:text-2xl">
        Herramienta de costos
        {active && (
          <span className="mt-1 block text-xs font-bold md:text-sm">
            {tool.name.replace('Herramienta de costos · ', '')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 md:grow-2 md:basis-100 md:justify-center md:gap-3 md:px-8 md:py-6">
        <div className="text-13 leading-snug text-landing-muted md:text-15 md:leading-normal">
          <span className="md:hidden">
            Costo por porción y precio sugerido de cada receta.
          </span>
          <span className="hidden md:inline">
            Calcula el costo por porción y el precio sugerido de cada receta,
            con las recetas del curso ya cargadas.
          </span>
        </div>
        {renewalMxn !== null && (
          <div className="rounded-xl border-1.5 border-landing-warn-line bg-landing-warn p-3 text-13 leading-normal md:text-15">
            {active ? (
              <>
                <strong>
                  Tu acceso vence en {daysLeft}{' '}
                  {daysLeft === 1 ? 'día' : 'días'}.
                </strong>{' '}
                Renuévalo por {mxn(renewalMxn)} y suma {accessDays} días a los
                que te quedan.{' '}
                <Link {...renewLink} className="font-bold text-landing-primary">
                  Renovar
                </Link>
              </>
            ) : (
              <>
                <strong>Tu acceso venció.</strong> Renuévalo por{' '}
                {mxn(renewalMxn)} y tienes {accessDays} días más. Tus datos se
                conservan.
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {active ? (
            <Link to="/herramienta" className={buttonClass}>
              Abrir herramienta
            </Link>
          ) : renewalMxn !== null ? (
            <Link {...renewLink} className={buttonClass}>
              Renovar por {mxn(renewalMxn)}
            </Link>
          ) : null}
          {options.map((o) => (
            <Link
              key={o.slug}
              to="/checkout"
              search={{ producto: o.slug, desde: 'mis-cursos' }}
              className={
                active || renewalMxn !== null
                  ? 'text-sm font-bold text-landing-primary'
                  : buttonClass
              }
            >
              {active || renewalMxn !== null ? 'Pasar a' : 'Comprar'}{' '}
              {o.name.replace('Herramienta de costos · ', '')} por{' '}
              {o.compareAtMxn && (
                <s className="font-normal opacity-70">{mxn(o.compareAtMxn)}</s>
              )}{' '}
              {mxn(o.priceMxn)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function CourseCard({ course }: { course: MyCourse }) {
  const expires =
    course.expiresAt &&
    new Date(course.expiresAt).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  const { active, lessons, seen, renewalMxn } = course
  const pct = lessons ? Math.round((seen / lessons) * 100) : 0
  const daysLeft = course.expiresAt
    ? Math.ceil(
        (new Date(course.expiresAt).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )
    : 0
  const renewLink = {
    to: '/checkout',
    search: { renovar: course.slug, desde: 'mis-cursos' },
  } as const

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-landing-line bg-white md:flex-row md:flex-wrap md:rounded-20">
      <div className="aspect-video overflow-hidden bg-landing-cover md:relative md:aspect-auto md:min-h-55 md:grow md:basis-70">
        {course.coverUrl && (
          <img
            src={course.coverUrl}
            alt={course.name}
            className="block size-full object-cover md:absolute md:inset-0"
          />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4 md:grow-2 md:basis-100 md:justify-center md:gap-4 md:px-8 md:py-7">
        <div className="text-21 leading-115 font-black tracking-landing-title-sm md:text-26 md:leading-normal md:tracking-landing-logo">
          {course.name}
        </div>
        <div className="text-sm text-landing-muted md:text-15">
          {course.recipes > 0 && `${course.recipes} recetas · `}
          {expires ? (
            <>
              Tu acceso {active ? 'vence' : 'venció'} el {expires}
            </>
          ) : (
            'Acceso de administradora'
          )}
        </div>
        <div className="flex flex-col gap-1.5 md:gap-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-landing-track">
            <div
              className="h-full rounded-full bg-landing-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-13 text-landing-muted md:text-sm">
            {seen} de {lessons}{' '}
            {lessons === 1 ? 'lección vista' : 'lecciones vistas'} · {pct}%
          </div>
        </div>
        {/* Renovación (no está en la maqueta; decisión del cliente 2026-10-17). */}
        {renewalMxn !== null && (
          <div className="rounded-xl border-1.5 border-landing-warn-line bg-landing-warn p-3.5 text-sm leading-normal md:text-15">
            {active ? (
              <>
                <strong>
                  Tu acceso vence en {daysLeft}{' '}
                  {daysLeft === 1 ? 'día' : 'días'}.
                </strong>{' '}
                Renuévalo ahora con {RENEWAL_DISCOUNT_PCT}% de descuento por{' '}
                {mxn(renewalMxn)} y suma {course.accessDays} días a los que te
                quedan.{' '}
                <Link {...renewLink} className="font-bold text-landing-primary">
                  Renovar
                </Link>
              </>
            ) : (
              <>
                <strong>Tu acceso venció.</strong> Renuévalo con{' '}
                {RENEWAL_DISCOUNT_PCT}% de descuento por {mxn(renewalMxn)} y
                tienes {course.accessDays} días más. Tu avance se conserva.
              </>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          {active || renewalMxn === null ? (
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
          ) : (
            <Link
              {...renewLink}
              className="flex min-h-13 items-center justify-center rounded-12 bg-landing-primary text-17 font-black text-white no-underline md:inline-flex md:min-h-12.5 md:px-7"
            >
              Renovar por {mxn(renewalMxn)}
            </Link>
          )}
          {/* Solo los cursos con recetario (`assets/recetarios/<slug>.pdf`); vencido, inerte. */}
          {course.recipeBook && (
            <a
              href={active ? `/api/recetarios/${course.slug}` : undefined}
              download={active ? '' : undefined}
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
          )}
        </div>
      </div>
    </div>
  )
}
