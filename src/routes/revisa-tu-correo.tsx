import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthShell } from '#/components/auth-shell'
import { redirectIfSignedIn } from '#/lib/session'

export const Route = createFileRoute('/revisa-tu-correo')({
  beforeLoad: () => redirectIfSignedIn(),
  validateSearch: z.object({
    correo: z.string().optional(),
    // Desde Entrar con un correo sin contraseña o sin cuenta (no se distingue; H25).
    desde: z.enum(['entrar']).optional().catch(undefined),
  }),
  component: RevisaTuCorreo,
})

function RevisaTuCorreo() {
  const { correo, desde } = Route.useSearch()
  const fromLogin = desde === 'entrar'

  return (
    <AuthShell logoLink={false}>
      <div className="flex flex-1 items-start justify-center md:items-center md:px-6 md:py-12">
        <div className="box-border flex w-full max-w-110 flex-col items-center gap-4 px-4 py-8 text-center md:gap-4.5 md:rounded-20 md:border md:border-landing-line md:bg-white md:px-8 md:py-10 md:shadow-landing-card-lg">
          <div className="flex size-15 items-center justify-center rounded-full bg-landing-tint md:size-16">
            <svg
              className="size-7 stroke-landing-primary md:size-7.5"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </div>
          <h1 className="m-0 text-28 font-black tracking-landing-title md:text-3xl">
            Revisa tu correo
          </h1>
          <p className="m-0 text-15 leading-normal text-landing-muted md:text-base md:leading-155">
            {fromLogin ? 'Si hay una cuenta con ' : 'Te enviamos un enlace a '}
            <strong className="text-landing-ink">
              {correo ?? 'tucorreo@ejemplo.com'}
            </strong>
            {fromLogin
              ? ', te enviamos un enlace para entrar. Puede tardar un minuto.'
              : '. Puede tardar un minuto.'}
          </p>
          <div className="text-13 leading-normal text-landing-muted md:text-sm">
            Si no lo ves, revisa tu carpeta de spam. El enlace caduca en 15
            minutos.
          </div>
          <Link
            to="/entrar"
            className="px-2 py-2.5 text-15 font-bold text-landing-primary underline md:py-3"
          >
            Usar otro correo
          </Link>
          {/* Sin revelar si el correo existe (H25): la misma salida para todos. */}
          {fromLogin && (
            <div className="flex w-full flex-col gap-2.5 rounded-14 bg-landing-tint px-4 py-3.5 text-left text-sm leading-normal md:text-15">
              <span>
                <strong>¿Aún no tienes cuenta?</strong> Se crea al comprar un
                curso o al registrarte en la clase gratis.
              </span>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-bold">
                <Link to="/clase-gratis" className="text-landing-primary">
                  Ver la clase gratis
                </Link>
                <Link to="/" hash="cursos" className="text-landing-primary">
                  Ver los cursos
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
