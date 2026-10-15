import { Link } from '@tanstack/react-router'
import { useState } from 'react'

const menuItem = 'rounded-md px-3 py-2.75 text-15 text-landing-ink no-underline'

// Encabezado móvil de la landing: "Entrar" + botón de menú con anclajes.
export function MobileMenu({
  items,
}: {
  items: { href: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center gap-2 md:hidden">
      <Link
        to="/entrar"
        className="inline-flex min-h-9.5 items-center rounded-full bg-landing-primary px-4.5 text-sm font-bold text-white no-underline"
      >
        Entrar
      </Link>
      <button
        type="button"
        aria-label="Menú"
        onClick={() => setOpen(!open)}
        className="flex size-9.5 cursor-pointer items-center justify-center rounded-full border border-landing-line bg-landing-nav p-0"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4.5 fill-none stroke-landing-primary"
          strokeWidth={2.4}
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute top-12 right-0 z-10 flex w-50 flex-col rounded-xl border border-landing-line bg-white p-1.5 shadow-landing-menu"
        >
          {items.map((i) => (
            <a key={i.href} href={i.href} className={menuItem}>
              {i.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
