import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthShell } from '#/components/auth-shell'
import { authClient } from '#/lib/auth-client'
import { startLogin } from '#/lib/login'

export const Route = createFileRoute('/entrar')({ component: Entrar })

const label = 'text-sm font-bold md:text-15'
const input =
  'box-border h-12.5 rounded-12 border-1.5 border-landing-field bg-white px-3.5 text-base text-landing-ink md:h-13 md:px-4 md:text-17'

function Entrar() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [loading, setLoading] = useState(false)

  async function sendLink(email: string) {
    await startLogin({ data: { email, forceLink: true } })
    navigate({ to: '/revisa-tu-correo', search: { correo: email } })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const email = form.correo.value
    setLoading(true)

    if (step === 'email') {
      const { next } = await startLogin({ data: { email } })
      setLoading(false)
      if (next === 'password') return setStep('password')
      if (next === 'blocked') {
        form.correo.setCustomValidity(
          'Demasiados intentos. Espera unos minutos',
        )
        return form.correo.reportValidity()
      }
      return navigate({ to: '/revisa-tu-correo', search: { correo: email } })
    }

    const { error } = await authClient.signIn.email({
      email,
      password: form.clave.value,
    })
    setLoading(false)

    if (error) {
      form.clave.setCustomValidity('Correo o contraseña incorrectos')
      form.clave.reportValidity()
      return
    }
    window.location.href = '/mis-cursos'
  }

  return (
    <AuthShell>
      <div className="flex flex-1 items-start justify-center px-4 py-6 md:items-center md:px-6 md:py-12">
        <div className="box-border flex w-full max-w-105 flex-col gap-4 rounded-18 border border-landing-line bg-white px-5 py-6 shadow-landing-card md:gap-5 md:rounded-20 md:px-8 md:py-9 md:shadow-landing-card-lg">
          <h1 className="m-0 text-28 font-black tracking-landing-title md:text-3xl">
            Entrar
          </h1>
          <form className="flex flex-col gap-4 md:gap-5" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="correo" className={label}>
                Correo
              </label>
              <input
                id="correo"
                name="username"
                type="email"
                autoComplete="username"
                placeholder="tucorreo@ejemplo.com"
                required
                onInput={(e) => {
                  e.currentTarget.setCustomValidity('')
                  setStep('email')
                }}
                className={input}
              />
            </div>
            {step === 'password' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="clave" className={label}>
                  Contraseña
                </label>
                <input
                  id="clave"
                autoFocus
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  required
                  onInput={(e) => e.currentTarget.setCustomValidity('')}
                  className={input}
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-13.5 cursor-pointer items-center justify-center rounded-12 bg-landing-primary text-17 font-black text-landing-primary-foreground md:text-lg"
            >
              {step === 'email' ? 'Continuar' : 'Entrar'}
            </button>
          </form>
          {step === 'password' && (
            <>
              <div className="h-px bg-landing-line" />
              <div className="flex flex-col gap-1.5 text-sm leading-145 text-landing-muted md:text-15 md:leading-normal">
                <a
                  href="/revisa-tu-correo"
                  onClick={(e) => {
                    e.preventDefault()
                    sendLink(
                      (document.getElementById('correo') as HTMLInputElement)
                        .value,
                    )
                  }}
                  className="font-bold text-landing-primary no-underline"
                >
                  No tengo acceso o olvidé mi contraseña
                </a>
                <span>
                  Te enviamos un enlace por correo
                  <span className="hidden md:inline"> para entrar</span>.
                  Funciona una sola vez y caduca en 15 minutos.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
