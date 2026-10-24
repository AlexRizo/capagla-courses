import { createFileRoute, redirect } from '@tanstack/react-router'

// Se entra por la primera sección del menú: Productos.
export const Route = createFileRoute('/herramienta/')({
  beforeLoad: () => {
    throw redirect({ to: '/herramienta/productos' })
  },
})
