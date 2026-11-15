import { Link } from '@tanstack/react-router'

import { AuthShell } from '#/components/auth-shell'

const option =
  'box-border flex w-full items-center justify-between gap-3 rounded-12 border border-landing-line bg-white px-4 py-3.5 text-left text-15 font-bold text-landing-ink no-underline md:text-base'

// Página 404 (H24): con el diseño del sitio (marco de Entrar) y salidas a cursos, herramienta y
// clase gratis. La usa el router para cualquier ruta o recurso que no existe.
export function NotFoundPage() {
  const links = [
    { to: '/', hash: 'cursos', label: 'Ver los cursos' },
    { to: '/herramienta-de-costos', label: 'Conocer la herramienta de costos' },
    { to: '/clase-gratis', label: 'Tomar la clase gratis' },
  ] as const

  return (
    <AuthShell enterLink>
      <div className="flex flex-1 items-start justify-center md:items-center md:px-6 md:py-12">
        <div className="box-border flex w-full max-w-110 flex-col items-center gap-4 px-4 py-8 text-center md:gap-4.5 md:rounded-20 md:border md:border-landing-line md:bg-white md:px-8 md:py-10 md:shadow-landing-card-lg">
          <div className="flex size-15 items-center justify-center rounded-full bg-landing-tint text-22 font-black text-landing-primary md:size-16">
            404
          </div>
          <h1 className="m-0 text-28 font-black tracking-landing-title md:text-3xl">
            No encontramos esta página
          </h1>
          <p className="m-0 text-15 leading-normal text-landing-muted md:text-base md:leading-155">
            Puede que el enlace esté mal escrito o que la página ya no exista.
            Sigue por aquí:
          </p>
          <div className="flex w-full flex-col gap-2.5">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                hash={'hash' in l ? l.hash : undefined}
                className={option}
              >
                {l.label}
                <span aria-hidden="true" className="text-landing-primary">
                  →
                </span>
              </Link>
            ))}
          </div>
          <Link
            to="/"
            className="px-2 py-2.5 text-15 font-bold text-landing-primary underline md:py-3"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
