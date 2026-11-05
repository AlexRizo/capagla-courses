import { Link } from '@tanstack/react-router'

import { AuthShell } from '#/components/auth-shell'
import { LEGAL, LEGAL_DOCS } from '#/lib/legal'

import type { LegalDoc } from '#/lib/legal'

const LINKS = [
  { to: '/privacidad', doc: LEGAL_DOCS.privacidad },
  { to: '/terminos', doc: LEGAL_DOCS.terminos },
  { to: '/devoluciones', doc: LEGAL_DOCS.devoluciones },
  { to: '/cookies', doc: LEGAL_DOCS.cookies },
] as const

// Página de texto legal (aviso de privacidad, términos, devoluciones y cookies). La maqueta no
// trae diseño para estas páginas: usa el marco de Entrar y los colores de la landing.
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <AuthShell>
      <main className="mx-auto box-border w-full max-w-190 flex-1 px-4 py-8 md:px-8 md:py-12">
        <h1 className="m-0 text-28 font-black tracking-landing-title md:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-2 mb-0 text-13 text-landing-muted md:text-sm">
          Última actualización: {LEGAL.actualizado}
        </p>
        <p className="mt-5 mb-0 text-15 leading-normal md:text-base md:leading-155">
          {doc.intro}
        </p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="m-0 text-xl font-black md:text-2xl">
              {section.heading}
            </h2>
            {section.paragraphs?.map((p) => (
              <p
                key={p}
                className="mt-3 mb-0 text-15 leading-normal text-landing-muted md:text-base md:leading-155"
              >
                {p}
              </p>
            ))}
            {section.items && (
              <ul className="mt-3 mb-0 flex list-disc flex-col gap-2 pl-5 text-15 leading-normal text-landing-muted md:text-base md:leading-155">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav
          aria-label="Otras políticas"
          className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-landing-line pt-6 text-sm"
        >
          {LINKS.filter((l) => l.doc.slug !== doc.slug).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="font-bold text-landing-primary underline"
            >
              {l.doc.title}
            </Link>
          ))}
          <a
            href={`mailto:${LEGAL.email}`}
            className="text-landing-muted underline"
          >
            {LEGAL.email}
          </a>
        </nav>
      </main>
    </AuthShell>
  )
}
