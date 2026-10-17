import { Link } from '@tanstack/react-router'
import { createContext, useContext } from 'react'

// "Ver como alumna" (panel de la chef): el reproductor se ve igual, pero lo que guarda
// (marcar como vista, momentos y preguntas) queda desactivado.
export const PreviewContext = createContext(false)
export const usePreview = () => useContext(PreviewContext)

// Aviso flotante de la vista previa, con regreso al editor del curso.
export function PreviewBanner({ slug }: { slug: string }) {
  return (
    <div
      role="note"
      className="fixed top-2 left-1/2 z-50 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-landing-deep px-4 py-2 text-13 text-white shadow-landing-menu"
    >
      <span>
        <strong>Vista de alumna.</strong> No se guarda nada.
      </span>
      <Link
        to="/admin/cursos/$slug"
        params={{ slug }}
        className="flex-none font-bold text-landing-neon"
      >
        Volver al editor
      </Link>
    </div>
  )
}
