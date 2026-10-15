import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { MobileMenu } from '#/components/mobile-menu'
import { coursePages } from '#/lib/course-pages'
import type { CoursePage } from '#/lib/course-pages'

// Landing de venta de un curso. El contenido sale de `lib/course-pages.ts` (en duro por ahora).
export const Route = createFileRoute('/cursos/$slug')({
  loader: ({ params }) => {
    const page = coursePages[params.slug]
    if (!page) throw notFound()
    return page
  },
  component: CoursePageView,
})

const solid =
  'flex items-center justify-center rounded-12 bg-landing-primary font-black text-white no-underline'
const footerLink = 'text-landing-muted'

function CoursePageView() {
  const page = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-landing-page font-sans text-landing-ink">
      <Desktop page={page} />
      <Mobile page={page} />
    </div>
  )
}

function Play({ mobile }: { mobile?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-landing-primary/92 shadow-landing-play ${mobile ? 'size-16' : 'size-21'}`}
    >
      <div
        className={`size-0 border-y-transparent border-l-white ${mobile ? 'ml-1.25 border-y-12 border-l-19' : 'ml-1.5 border-y-15 border-l-25'}`}
      />
    </div>
  )
}

function Desktop({ page }: { page: CoursePage }) {
  const link = 'text-15 text-landing-ink no-underline'
  const h2 = 'm-0 text-34 font-black tracking-landing-title-md'

  return (
    <div className="hidden md:block">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-landing-line bg-white px-8 py-4">
        <Link
          to="/"
          className="text-2xl font-black tracking-landing-logo text-landing-primary no-underline"
        >
          Capagla
        </Link>
        <div className="flex flex-wrap items-center gap-5">
          <a href="#recetas" className={link}>
            Recetas
          </a>
          <a href="#incluye" className={link}>
            Qué incluye
          </a>
          <a href="#preguntas" className={link}>
            Preguntas
          </a>
          <Link
            to="/entrar"
            className="px-1 py-2.5 text-15 font-bold text-landing-primary no-underline"
          >
            Entrar
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-280 flex-wrap items-center gap-12 px-8 pt-14 pb-16">
        <div className="flex flex-1 basis-105 flex-col gap-5">
          <div className="self-start rounded-full bg-landing-tint px-3.5 py-1.5 text-sm font-bold text-landing-primary">
            {page.badge}
          </div>
          <h1 className="m-0 text-52 leading-106 font-black tracking-landing-title-3xl">
            {page.title}
          </h1>
          <p className="m-0 text-19 leading-155 text-landing-muted">
            {page.intro}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/checkout"
              className={`${solid} min-h-14 px-7 text-lg`}
            >
              Quiero empezar ahora
            </Link>
          </div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            {page.strike && (
              <span className="text-22 text-landing-strike line-through">
                {page.strike}
              </span>
            )}
            <span className="text-32 font-black">{page.price}</span>
            <span className="text-15 text-landing-muted">{page.priceNote}</span>
          </div>
        </div>
        <div className="relative flex aspect-16/10 flex-1 basis-105 items-center justify-center overflow-hidden rounded-20 border border-landing-line bg-stripes-lg">
          <img
            src={page.heroImage}
            alt={page.heroAlt}
            className="absolute inset-0 size-full object-cover"
          />
          <Play />
        </div>
      </div>

      {page.promo && (
        <div className="border-y border-landing-promo-line bg-landing-promo py-12">
          <div className="mx-auto flex max-w-280 flex-col gap-5 px-8">
            <h2 className="m-0 text-26 font-black tracking-landing-title-2xs">
              {page.promo.title}
            </h2>
            <div className="grid grid-cols-2 gap-5">
              {[page.promo.left, page.promo.right].map((o, i) => (
                <div
                  key={o.tag}
                  className={`flex flex-col gap-2.5 rounded-18 border-1.5 p-6 ${i === 0 ? 'border-landing-pink-line bg-landing-pink' : 'border-landing-primary bg-landing-tint'}`}
                >
                  <div
                    className={`self-start rounded-full px-2.5 py-1 text-xs font-black tracking-landing-caps text-white ${i === 0 ? 'bg-landing-accent' : 'bg-landing-primary'}`}
                  >
                    {o.tag}
                  </div>
                  <div className="text-22 font-black tracking-landing-title-sm">
                    {o.title}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span className="text-lg text-landing-strike line-through">
                      {o.old}
                    </span>
                    <span className="text-3xl font-black">{o.now}</span>
                  </div>
                  <div className="text-15 leading-normal text-landing-muted">
                    {o.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-y border-landing-line bg-white">
        <div className="mx-auto flex max-w-280 flex-col gap-7 px-8 py-14">
          <h2 className={h2}>Este curso es para ti si…</h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
            {page.forWhom.map((text, i) => (
              <div
                key={text}
                className="flex flex-col gap-2.5 rounded-16 border border-landing-line bg-landing-page p-6"
              >
                <div className="text-40 leading-none font-black text-landing-accent">
                  {i + 1}
                </div>
                <div className="text-lg leading-normal">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        id="recetas"
        className="mx-auto flex max-w-280 flex-col gap-7 px-8 py-16"
      >
        <h2 className={h2}>{page.recipesTitle}</h2>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {page.recipes.map((r) => (
            <div
              key={r.name}
              className="overflow-hidden rounded-16 border border-landing-line bg-white"
            >
              <div className="h-42.5 overflow-hidden bg-landing-cover">
                <img
                  src={`/images/recetas/${r.image}.jpg`}
                  alt={r.name}
                  loading="lazy"
                  className="block size-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1 px-4.5 py-4">
                <div className="text-lg font-black">{r.name}</div>
                <div className="text-sm text-landing-muted">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="incluye" className="bg-landing-ink text-white">
        <div className="mx-auto flex max-w-280 flex-wrap items-center gap-12 px-8 py-16">
          <div className="flex flex-1 basis-95 flex-col gap-4">
            <h2 className={h2}>Todo lo que incluye</h2>
            <p className="m-0 text-17 leading-160 text-landing-lilac">
              {page.includesText}
            </p>
          </div>
          <div className="grid flex-1 basis-95 grid-cols-2 gap-4">
            {page.includes.map((i) => (
              <div
                key={i.big}
                className="flex flex-col gap-1 rounded-xl bg-landing-deep p-5"
              >
                <div className="text-32 font-black text-landing-neon">
                  {i.big}
                </div>
                <div className="text-15 text-landing-lilac">{i.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-280 flex-wrap items-center gap-10 px-8 py-16">
        <div className="aspect-square w-full max-w-80 flex-initial basis-80 overflow-hidden rounded-full border border-landing-line">
          <img
            src="/images/gladis-postres.jpg"
            alt="Gladis"
            className="block size-full object-cover object-face"
          />
        </div>
        <div className="flex flex-1 basis-105 flex-col gap-3.5">
          <h2 className={h2}>Quién te enseña</h2>
          <p className="m-0 text-lg leading-160 text-landing-muted">
            {page.teacherText}
          </p>
        </div>
      </div>

      <div className="border-y border-landing-line bg-white">
        <div className="mx-auto flex max-w-280 flex-col gap-6 px-8 py-14">
          <h2 className={h2}>Lo que dicen las alumnas</h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
            {Array.from({ length: page.testimonials }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-16 border border-dashed border-landing-field bg-landing-page p-6"
              >
                <div className="text-base leading-normal text-landing-muted">
                  [Opinión real de una alumna, pendiente]
                </div>
                <div className="text-15 font-bold">[Nombre, ciudad]</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        id="preguntas"
        className="mx-auto flex max-w-205 flex-col gap-5 px-8 py-16"
      >
        <h2 className={h2}>Preguntas frecuentes</h2>
        {page.faq.map((f) => (
          <div
            key={f.q}
            className="flex flex-col gap-1.5 rounded-xl border border-landing-line bg-white px-6 py-5"
          >
            <div className="text-17 font-black">{f.q}</div>
            <div className="text-base leading-155 text-landing-muted">
              {f.a}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-landing-primary text-white">
        <div className="mx-auto flex max-w-205 flex-col items-center gap-4.5 px-8 py-16 text-center">
          <h2 className="m-0 text-36 font-black tracking-landing-title-md">
            Empieza hoy y prepara tus primeros postres
          </h2>
          <div className="text-lg text-landing-lavender">
            <span>{page.price}</span> · pago único con tarjeta · acceso
            inmediato
          </div>
          <Link
            to="/checkout"
            className="flex min-h-14 items-center justify-center rounded-12 bg-white px-8 text-lg font-black text-landing-primary no-underline"
          >
            Quiero empezar ahora
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-7 gap-y-4 px-8 py-7 text-sm text-landing-muted">
        <span>© Capagla</span>
        <a href="#" className={footerLink}>
          Términos y condiciones
        </a>
        <a href="#" className={footerLink}>
          Aviso de privacidad
        </a>
        <a href="#" className={footerLink}>
          Política de devoluciones
        </a>
        <a href="#" className={footerLink}>
          Contacto
        </a>
      </div>
    </div>
  )
}

function Mobile({ page }: { page: CoursePage }) {
  const h2 = 'm-0 text-2xl font-black tracking-landing-logo'

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-landing-line bg-white px-4 py-3">
        <Link
          to="/"
          className="text-22 font-black tracking-landing-logo text-landing-primary no-underline"
        >
          Capagla
        </Link>
        <MobileMenu
          items={[
            { href: '#recetas', label: 'Recetas' },
            { href: '#incluye', label: 'Qué incluye' },
            { href: '#preguntas', label: 'Preguntas' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4.5 pb-5.5">
        <div className="self-start rounded-full bg-landing-tint px-3 py-1.25 text-xs font-bold text-landing-primary">
          {page.badge}
        </div>
        <h1 className="m-0 text-34 leading-105 font-black tracking-landing-title-4xl">
          {page.title}
        </h1>
        <p className="m-0 text-15 leading-normal text-landing-muted">
          {page.introShort}
        </p>
        <div className="relative flex aspect-16/10 items-center justify-center overflow-hidden rounded-16">
          <img
            src={page.heroImage}
            alt={page.heroAlt}
            className="absolute inset-0 size-full object-cover"
          />
          <Play mobile />
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-center gap-2.5">
          {page.strike && (
            <span className="text-lg text-landing-strike line-through">
              {page.strikeShort}
            </span>
          )}
          <span className="text-3xl font-black">{page.price}</span>
        </div>
        <div className="-mt-1.5 text-center text-13 text-landing-muted first-letter:uppercase">
          {page.priceNote}
        </div>
        <Link to="/checkout" className={`${solid} min-h-13.5 text-17`}>
          Quiero empezar ahora
        </Link>
      </div>

      {page.promo && (
        <div className="flex flex-col gap-3 border-y border-landing-promo-line bg-landing-promo px-4 py-5.5">
          <div className="text-19 leading-120 font-black tracking-landing-title-sm">
            {page.promo.title}
          </div>
          {[page.promo.left, page.promo.right].map((o, i) => (
            <div
              key={o.tag}
              className={`flex flex-col gap-1 rounded-xl border-1.5 p-3.5 ${i === 0 ? 'border-landing-pink-line bg-landing-pink' : 'border-landing-primary bg-landing-tint'}`}
            >
              <div
                className={`self-start rounded-full px-2.25 py-0.75 text-10 font-black tracking-landing-caps text-white ${i === 0 ? 'bg-landing-accent' : 'bg-landing-primary'}`}
              >
                {o.tag}
              </div>
              <div className="text-base font-black">{o.title}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-landing-strike line-through">
                  {o.old}
                </span>
                <span className="text-22 font-black">{o.now}</span>
              </div>
              <div className="text-xs text-landing-muted">{o.note}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3.5 px-4 pt-7 pb-2">
        <h2 className={h2}>Este curso es para ti si…</h2>
        {page.forWhom.map((text, i) => (
          <div key={text} className="flex items-start gap-3">
            <div className="flex size-7.5 flex-none items-center justify-center rounded-full bg-landing-tint font-black text-landing-accent">
              {i + 1}
            </div>
            <div className="pt-1 text-15 leading-145">{text}</div>
          </div>
        ))}
      </div>

      <div id="recetas" className="pt-7 pb-2">
        <h2 className={`${h2} mx-4 mb-3`}>{page.recipesTitle}</h2>
        <div className="flex gap-2.5 overflow-x-auto px-4 pb-2">
          {page.recipes.map((r) => (
            <div
              key={r.name}
              className="w-37.5 flex-none overflow-hidden rounded-xl border border-landing-line bg-white"
            >
              <div className="h-26">
                <img
                  src={`/images/recetas/${r.image}.jpg`}
                  alt=""
                  loading="lazy"
                  className="block size-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <div className="text-sm leading-120 font-black">{r.name}</div>
                <div className="text-xs text-landing-muted">{r.descShort}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-4 mt-0.5 text-xs text-landing-muted">
          Desliza para ver todas →
        </div>
      </div>

      <div
        id="incluye"
        className="mt-5 flex flex-col gap-3.5 bg-landing-ink px-4 py-7 text-white"
      >
        <h2 className={h2}>Todo lo que incluye</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {page.includes.map((i) => (
            <div
              key={i.big}
              className="flex flex-col gap-0.5 rounded-12 bg-landing-deep p-3.5"
            >
              <div className="text-22 font-black text-landing-neon">
                {i.bigShort ?? i.big}
              </div>
              <div className="text-xs leading-130 text-landing-lilac">
                {i.labelShort}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3.5 px-4 py-7">
        <div className="size-24 flex-none overflow-hidden rounded-full border border-landing-line">
          <img
            src="/images/gladis-postres.jpg"
            alt="Gladis"
            className="block size-full object-cover object-face"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xl font-black tracking-landing-title-sm">
            Quién te enseña
          </div>
          <div className="text-sm leading-145 text-landing-muted">
            {page.teacherTextShort}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-6">
        <h2 className={`${h2} mb-1`}>Lo que dicen las alumnas</h2>
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-landing-field bg-white p-4">
          <div className="text-sm leading-145 text-landing-muted">
            [Opinión real de una alumna, pendiente]
          </div>
          <div className="text-sm font-bold">[Nombre, ciudad]</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-7">
        <h2 className={`${h2} mb-1`}>Preguntas frecuentes</h2>
        {page.faq.map((f) => (
          <details
            key={f.q}
            className="rounded-12 border border-landing-line bg-white px-3.5"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-15 font-black">
              <span>{f.q}</span>
              <span className="flex-none text-xl text-landing-primary">+</span>
            </summary>
            <div className="pb-3.5 text-sm leading-normal text-landing-muted">
              {f.aShort}
            </div>
          </details>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 bg-landing-primary px-4 py-8 text-center text-white">
        <div className="text-2xl leading-115 font-black tracking-landing-logo">
          Empieza hoy y prepara tus primeros postres
        </div>
        <div className="text-sm text-landing-lavender">
          {page.price} · pago único · acceso inmediato
        </div>
        <Link
          to="/checkout"
          className="box-border flex min-h-13.5 w-full items-center justify-center rounded-12 bg-white text-17 font-black text-landing-primary no-underline"
        >
          Quiero empezar ahora
        </Link>
      </div>

      <div className="flex flex-col gap-2 px-4 pt-5 pb-7 text-13 text-landing-muted">
        <span>© Capagla</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <a href="#" className={footerLink}>
            Aviso de privacidad
          </a>
          <a href="#" className={footerLink}>
            Términos y condiciones
          </a>
          <a href="#" className={footerLink}>
            Contacto
          </a>
        </div>
      </div>
    </div>
  )
}
