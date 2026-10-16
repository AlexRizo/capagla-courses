import { Link } from '@tanstack/react-router'

// Marco común de "Entrar" y "Revisa tu correo" (maqueta landing, escritorio y móvil).
export function AuthShell({
  children,
  logoLink = true,
  enterLink = false,
}: {
  children: React.ReactNode
  logoLink?: boolean
  // Enlace "Entrar" a la derecha (lo tiene la pantalla de Clase gratis).
  enterLink?: boolean
}) {
  const logo =
    'text-22 font-black tracking-landing-logo text-landing-primary no-underline md:text-2xl'

  return (
    <div className="flex min-h-screen flex-col bg-landing-page font-sans text-landing-ink">
      <div className="flex items-center justify-between border-b border-landing-line bg-white px-4 py-3 md:px-8 md:py-4">
        {logoLink ? (
          <Link to="/" className={logo}>
            Capagla
          </Link>
        ) : (
          <div className={logo}>Capagla</div>
        )}
        {enterLink && (
          <Link
            to="/entrar"
            className="px-1 py-2 text-sm font-bold text-landing-primary no-underline md:py-2.5 md:text-15"
          >
            Entrar
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}
