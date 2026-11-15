import { Link, rootRouteId, useLoaderData } from '@tanstack/react-router'

// «Entrar» de los encabezados públicos; con sesión iniciada, «Mis accesos» (H19).
export function EnterLink({ className }: { className: string }) {
  const { signedIn } = useLoaderData({ from: rootRouteId })
  return signedIn ? (
    <Link to="/mis-cursos" className={className}>
      Mis accesos
    </Link>
  ) : (
    <Link to="/entrar" className={className}>
      Entrar
    </Link>
  )
}
