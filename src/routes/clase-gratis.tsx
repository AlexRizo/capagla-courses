import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthShell } from '#/components/auth-shell'
import { joinFreeClass, requireFreeClass } from '#/lib/free-class'
import { redirectIfSignedIn } from '#/lib/session'
import { cn } from '#/lib/utils'

// Captura de correo a cambio de la clase gratis. Solo existe si hay un bloque gratis que entregar.
export const Route = createFileRoute('/clase-gratis')({
  beforeLoad: async () => {
    await redirectIfSignedIn()
    await requireFreeClass()
  },
  component: ClaseGratis,
})

function ClaseGratis() {
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const email = form.correo.value
    setLoading(true)
    try {
      const { next } = await joinFreeClass({ data: { email, consent: true } })
      if (next === 'blocked') {
        form.correo.setCustomValidity(
          'Demasiados intentos. Espera unos minutos',
        )
        return form.correo.reportValidity()
      }
      await navigate({ to: '/revisa-tu-correo', search: { correo: email } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell enterLink>
      <div className="mx-auto flex w-full max-w-280 flex-col gap-3.5 px-4 pt-5 pb-7 md:flex-row md:flex-wrap md:items-center md:gap-14 md:px-8 md:py-16">
        <div className="flex flex-col gap-3.5 md:flex-1 md:basis-110 md:gap-5">
          <div className="self-start rounded-full bg-landing-tint px-3 py-1.25 text-xs font-bold text-landing-primary md:px-3.5 md:py-1.5 md:text-sm">
            Clase gratis · sin tarjeta
          </div>
          <h1 className="m-0 text-30 leading-108 font-black tracking-landing-title-xl md:text-46 md:tracking-landing-title-5xl">
            Empieza gratis con la introducción del curso
          </h1>
          <p className="m-0 text-15 leading-normal text-landing-muted md:text-19 md:leading-155">
            Conoce a Gladis, los utensilios, las duyas y el mise en place antes
            de tu primera receta
            <span className="hidden md:inline">
              , y mira cómo enseña paso a paso
            </span>
            .
          </p>
          <div className="relative aspect-video overflow-hidden rounded-14 md:max-w-130 md:rounded-18">
            <img
              src="/images/gladis-postres.jpg"
              alt="Gladis con sus postres"
              className="block size-full object-cover object-hero"
            />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="box-border flex flex-col gap-3.5 rounded-18 border border-landing-line bg-white p-5 shadow-landing-card md:max-w-115 md:flex-1 md:basis-95 md:gap-4.5 md:rounded-20 md:p-8 md:shadow-landing-card-lg"
        >
          <h2 className="m-0 text-21 font-black tracking-landing-title-sm md:text-26 md:tracking-landing-logo">
            Recibe la clase en tu correo
          </h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="correo" className="text-sm font-bold md:text-15">
              Tu correo
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              required
              onInput={(e) => e.currentTarget.setCustomValidity('')}
              className="box-border h-12.5 rounded-12 border-1.5 border-landing-field bg-white px-3.5 text-base text-landing-ink md:h-13 md:px-4 md:text-17"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="consent"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.25 size-5.5 flex-none accent-landing-primary md:mt-0.5"
            />
            <label
              htmlFor="consent"
              className="text-13 leading-145 text-landing-muted md:text-sm md:leading-normal"
            >
              Acepto el{' '}
              <a href="#" className="text-landing-primary">
                aviso de privacidad
              </a>{' '}
              y quiero recibir correos de Capagla con recetas y ofertas. Puedo
              darme de baja cuando quiera.
            </label>
          </div>

          <button
            type="submit"
            disabled={!accepted || loading}
            className={cn(
              'flex min-h-13.5 w-full items-center justify-center rounded-12 border-none font-sans text-17 font-black md:text-lg',
              accepted
                ? 'cursor-pointer bg-landing-primary text-landing-primary-foreground disabled:opacity-60'
                : 'cursor-not-allowed bg-landing-disabled text-landing-disabled-text',
            )}
          >
            Ver la clase gratis
          </button>
          {!accepted && (
            <div className="-mt-1 text-xs leading-140 text-landing-muted md:-mt-2 md:text-13">
              Marca la casilla para continuar.
            </div>
          )}
          <div
            className={cn(
              'text-xs leading-140 text-landing-muted md:text-sm md:leading-normal',
              !accepted && 'hidden md:block',
              accepted && '-mt-1 md:mt-0',
            )}
          >
            Te enviamos un enlace para entrar. No necesitas contraseña.
          </div>
        </form>
      </div>
    </AuthShell>
  )
}
