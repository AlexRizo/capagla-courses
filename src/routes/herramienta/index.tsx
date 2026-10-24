import { createFileRoute, redirect } from '@tanstack/react-router'

// La primera sección del menú (Productos) aún no existe: se entra por Ingredientes.
export const Route = createFileRoute('/herramienta/')({
  beforeLoad: () => {
    throw redirect({ to: '/herramienta/ingredientes' })
  },
})
