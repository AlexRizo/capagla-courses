import { Link, createFileRoute } from '@tanstack/react-router'

import { MobileMenu } from '#/components/mobile-menu'
import { getHomeProducts } from '#/lib/home'

export const Route = createFileRoute('/')({
  loader: () => getHomeProducts(),
  component: Home,
})

const nav =
  'inline-flex min-h-10 items-center rounded-full px-4.5 text-15 font-bold text-landing-ink no-underline hover:bg-white hover:text-landing-primary'
const solid =
  'flex items-center justify-center rounded-12 bg-landing-primary font-black text-white no-underline'
const outline =
  'flex items-center justify-center rounded-12 border-1.5 border-landing-primary font-black text-landing-primary no-underline'

type HomeProduct = Awaited<ReturnType<typeof getHomeProducts>>[number]

// Dónde lleva "Ver el curso" / "Ver detalles": la página de venta si existe; la herramienta
// va al checkout (como en la maqueta) y el resto de detalles aún no tiene pantalla.
const link = (p: HomeProduct) =>
  p.hasPage ? `/cursos/${p.slug}` : p.isTool ? '/checkout' : '#'

function Home() {
  const products = Route.useLoaderData()
  return (
    <div className="min-h-screen bg-landing-page font-sans text-landing-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-landing-line bg-white px-4 py-3 md:px-8 md:py-3.5">
        <Link
          to="/"
          className="text-22 font-black tracking-landing-logo text-landing-primary no-underline md:text-2xl"
        >
          Capagla
        </Link>
        <div className="hidden flex-wrap items-center gap-1.5 rounded-full border border-landing-line bg-landing-nav p-1.25 md:flex">
          <a href="#cursos" className={nav}>
            Cursos
          </a>
          <a href="/clase-gratis" className={nav}>
            Clase gratis
          </a>
          <a href="#gladis" className={nav}>
            Quién soy
          </a>
          <Link
            to="/entrar"
            className="inline-flex min-h-10 items-center rounded-full bg-landing-primary px-5.5 text-15 font-bold text-white no-underline"
          >
            Entrar
          </Link>
        </div>
        <MobileMenu
          items={[
            { href: '#cursos', label: 'Cursos' },
            { href: '/clase-gratis', label: 'Clase gratis' },
            { href: '#gladis', label: 'Quién soy' },
          ]}
        />
      </div>

      <div className="mx-auto flex max-w-280 flex-col gap-3.5 px-4 pt-5.5 pb-6 md:flex-row md:flex-wrap md:items-center md:gap-12 md:px-8 md:pt-16 md:pb-14">
        <div className="flex flex-col gap-3.5 md:flex-1 md:basis-105 md:gap-5">
          <h1 className="m-0 text-32 leading-108 font-black tracking-landing-title-2xl md:text-52 md:leading-106 md:tracking-landing-title-3xl">
            Postres para vender en Navidad
          </h1>
          <p className="m-0 text-base leading-normal text-landing-muted md:text-19 md:leading-155">
            Cursos en línea con medidas exactas y técnicas de pastelería real,
            para que prepares postres ricos y, si quieres, los vendas.
          </p>
          <div className="flex flex-col gap-3.5 md:mt-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
            <a
              href="/cursos/postres-navidad"
              className={`${solid} min-h-13.5 text-17 md:px-7 md:text-lg`}
            >
              Ver el curso
            </a>
            <a
              href="/clase-gratis"
              className="flex min-h-13 items-center justify-center p-1 text-15 font-bold text-landing-primary no-underline md:px-2 md:text-base"
            >
              Probar una clase gratis
            </a>
          </div>
        </div>
        <div className="aspect-4/3 overflow-hidden rounded-16 border border-landing-line md:flex md:aspect-16/10 md:flex-1 md:basis-105 md:rounded-20">
          <img
            src="/images/gladis-postres.jpg"
            alt="Gladis con sus postres"
            className="block size-full object-cover object-hero"
          />
        </div>
      </div>

      <div id="gratis" className="mx-auto max-w-280 px-4 pb-6 md:px-8 md:pb-14">
        <div className="flex flex-col gap-2 rounded-16 bg-landing-ink p-5 text-white md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-6 md:rounded-20 md:p-8">
          <div className="flex flex-col gap-2 md:flex-1 md:basis-95">
            <div className="text-11 font-black tracking-landing-caps-lg text-landing-neon md:text-13">
              CLASE GRATIS · SIN TARJETA
            </div>
            <div className="text-21 leading-115 font-black tracking-landing-title-sm md:text-28 md:leading-normal md:tracking-landing-title-2xs">
              Introducción al curso
            </div>
            <div className="text-sm leading-145 text-landing-lilac md:text-base md:leading-normal">
              <span className="hidden md:inline">
                Utensilios, duyas y mise en place.{' '}
              </span>
              Mira la clase completa y conoce cómo enseña Gladis.
            </div>
          </div>
          <a
            href="/clase-gratis"
            className="mt-1.5 flex min-h-12 items-center justify-center rounded-12 bg-white text-base font-black text-landing-primary no-underline md:mt-0 md:min-h-13.5 md:px-7 md:text-17"
          >
            Ver la clase gratis
          </a>
        </div>
      </div>

      <div
        id="cursos"
        className="mx-auto flex max-w-280 flex-col gap-3 px-4 pb-7 md:gap-6 md:px-8 md:pb-16"
      >
        <h2 className="m-0 text-2xl font-black tracking-landing-logo md:text-32 md:tracking-landing-title-md">
          Cursos
        </h2>
        <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
          {products.map((c) => (
            <div
              key={c.slug}
              className="flex flex-col overflow-hidden rounded-20 border border-landing-line bg-white"
            >
              {c.coverUrl && (
                <div className="flex aspect-video items-center justify-center overflow-hidden">
                  <img
                    src={c.coverUrl}
                    alt={c.name}
                    className="block size-full object-cover"
                  />
                </div>
              )}
              {!c.coverUrl && !c.isTool && (
                <div className="flex aspect-video items-center justify-center bg-stripes-lg font-bold text-landing-primary">
                  [Imagen del curso]
                </div>
              )}
              {!c.coverUrl && c.isTool && (
                <div className="flex aspect-video items-center justify-center bg-landing-ink p-5 text-center text-2xl font-black text-landing-neon">
                  Herramienta de costos
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2.5 p-6">
                <div className="text-22 font-black tracking-landing-title-sm">
                  {c.name}
                </div>
                <div className="text-15 leading-normal text-landing-muted">
                  {c.description}
                </div>
                <div className="flex-1" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-2xl font-black">${c.priceMxn} MXN</span>
                  <a
                    href={link(c)}
                    className={`${c.hasPage ? solid : outline} min-h-11.5 px-5.5 text-base`}
                  >
                    {c.hasPage ? 'Ver el curso' : 'Ver detalles'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:hidden">
          {products.map((c) => (
            <div
              key={c.slug}
              className="flex gap-3 rounded-16 border border-landing-line bg-white p-3"
            >
              {c.coverUrl && (
                <div className="size-24 flex-none overflow-hidden rounded-12">
                  <img
                    src={c.coverUrl}
                    alt={c.name}
                    className="block size-full object-cover"
                  />
                </div>
              )}
              {!c.coverUrl && !c.isTool && (
                <div className="flex size-24 flex-none items-center justify-center overflow-hidden rounded-12 bg-stripes-sm text-center text-11 font-bold text-landing-primary">
                  [Imagen]
                </div>
              )}
              {!c.coverUrl && c.isTool && (
                <div className="box-border flex size-24 flex-none items-center justify-center rounded-12 bg-landing-ink p-2 text-center text-sm font-black text-landing-neon">
                  Herramienta de costos
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1">
                <div className="text-base leading-120 font-black">{c.name}</div>
                <div className="line-clamp-2 text-13 leading-135 text-landing-muted">
                  {c.description}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-black">${c.priceMxn}</span>
                  <a
                    href={link(c)}
                    className="text-sm font-black text-landing-primary no-underline"
                  >
                    {c.hasPage ? 'Ver el curso' : 'Ver detalles'} →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="gladis" className="border-y border-landing-line bg-white">
        <div className="mx-auto flex max-w-280 flex-col items-center gap-3 px-4 py-7 text-center md:flex-row md:flex-wrap md:items-center md:gap-10 md:px-8 md:py-16 md:text-left">
          <div className="size-30 flex-none overflow-hidden rounded-full border border-landing-line md:aspect-square md:size-auto md:w-full md:max-w-70 md:flex-initial md:basis-70">
            <img
              src="/images/gladis.jpg"
              alt="Gladis"
              className="block size-full object-cover object-face"
            />
          </div>
          <div className="flex flex-col items-center gap-3 md:flex-1 md:basis-105 md:items-start md:gap-4">
            <h2 className="m-0 text-26 font-black tracking-landing-logo text-landing-primary md:text-34 md:tracking-landing-title-md">
              Capagla
            </h2>
            <p className="m-0 text-15 leading-155 text-landing-muted md:text-lg md:leading-160">
              Durante más de 10 años he creado postres y pasteles para todo tipo
              de celebración. Hoy preparo también recetas de postres saludables
              y quiero compartir contigo mis dulces momentos, con medidas
              exactas y paso a paso
              <span className="hidden md:inline">
                , para que crees tus propios postres y les des tu toque único
              </span>
              .
            </p>
            <a
              href="#"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-landing-secondary px-7.5 text-15 text-white no-underline md:min-h-12 md:px-9 md:text-base"
            >
              Saber más
            </a>
          </div>
        </div>
      </div>

      <div className="bg-linear-135 from-landing-grape to-landing-grape-dark text-white">
        <div className="mx-auto flex max-w-190 flex-col items-center gap-3 px-5 py-9 text-center md:gap-4 md:px-8 md:py-16">
          <h2 className="m-0 text-2xl leading-120 font-bold tracking-landing-title-3xs md:text-34 md:leading-normal md:font-medium md:tracking-landing-title-sm">
            Únete a la comunidad de Capagla
          </h2>
          <p className="m-0 text-sm leading-155 md:text-base md:leading-170">
            <span className="md:hidden">
              Síguenos en redes para ver más contenido y enterarte de los
              próximos lanzamientos.
            </span>
            <span className="hidden md:inline">
              Síguenos en nuestras redes sociales para ver más contenido y estar
              atento a los próximos lanzamientos.
            </span>
          </p>
          <div className="flex gap-5 text-15 font-bold md:mt-2 md:gap-7 md:text-base">
            <a href="#" className="text-white">
              Instagram
            </a>
            <a href="#" className="text-white">
              TikTok
            </a>
            <a href="#" className="text-white">
              YouTube
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-280 flex-col gap-2 px-4 pt-5 pb-7 text-13 text-landing-muted md:flex-row md:flex-wrap md:justify-between md:gap-x-7 md:gap-y-4 md:p-8 md:text-sm">
        <span>© Capagla</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 md:gap-5">
          <a href="#" className="text-landing-muted">
            Aviso de privacidad
          </a>
          <a href="#" className="text-landing-muted">
            Términos y condiciones
          </a>
          <a href="#" className="text-landing-muted">
            <span className="md:hidden">Contacto</span>
            <span className="hidden md:inline">contacto@capagla.com</span>
          </a>
        </div>
      </div>
    </div>
  )
}
