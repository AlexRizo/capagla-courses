import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthShell } from '#/components/auth-shell'

export const Route = createFileRoute('/revisa-tu-correo')({
  validateSearch: z.object({ correo: z.string().optional() }),
  component: RevisaTuCorreo,
})

function RevisaTuCorreo() {
  const { correo } = Route.useSearch()

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
            Te enviamos un enlace a{' '}
            <strong className="text-landing-ink">
              {correo ?? 'tucorreo@ejemplo.com'}
            </strong>
            . Puede tardar un minuto.
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
        </div>
      </div>
    </AuthShell>
  )
}
