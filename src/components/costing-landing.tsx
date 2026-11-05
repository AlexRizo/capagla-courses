import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'

import { IntroVideo, Play, useLandingIntro } from '#/components/landing-parts'
import { MobileMenu } from '#/components/mobile-menu'
import type {
  CostingCoursePage,
  CostingKind,
  CostingTopicIcon,
} from '#/lib/course-pages'

const h2 = 'm-0 text-28 font-black tracking-landing-title-md md:text-34'
const footerLink = 'text-landing-muted underline'
// La maqueta mide el contenido sin contar el relleno: 1120 px útiles (1184 con el relleno de 32).
const sectionX = 'mx-auto max-w-296 px-4 md:px-8'

// Landing de venta del curso de costeo («Aprende a Costear»): la usan /cursos/calcular-costos
// (precio normal) y la promoción que lo regala (`page.free`, «Empieza gratis hoy»). La maqueta
// solo trae escritorio; el móvil es el mismo diseño apilado.
export function CostingLanding({ page }: { page: CostingCoursePage }) {
  const { playing, close, onPlay } = useLandingIntro(page)
  const price = page.priceMxn === 0 ? 'Gratis' : page.price
  const cta = page.free ? 'Quiero empezar gratis' : 'Quiero empezar'
  // «Costear»: la última palabra del título va en el color de acento.
  const words = page.title.split(' ')
  const accent = words.length > 1 ? words.pop() : null

  const buy = (className: string, label = cta) => (
    <Link
      to="/checkout"
      search={{ promo: page.promoSlug, prueba: page.promoTest }}
      className={className}
    >
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen bg-landing-page font-sans text-landing-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-landing-line bg-white px-4 py-3 md:px-8 md:py-4">
        {page.free ? (
          <div className="text-22 font-black tracking-landing-logo text-landing-primary md:text-2xl">
            Capagla
          </div>
        ) : (
          <Link
            to="/"
            className="text-22 font-black tracking-landing-logo text-landing-primary no-underline md:text-2xl"
          >
            Capagla
          </Link>
        )}
        <div className="hidden flex-wrap items-center gap-5 md:flex">
          <a
            href="#aprenderas"
            className="text-15 text-landing-ink no-underline"
          >
            Lo que aprenderás
          </a>
          <a
            href="#preguntas"
            className="text-15 text-landing-ink no-underline"
          >
            Preguntas
          </a>
          <Link
            to="/entrar"
            className="px-1 py-2.5 text-15 font-bold text-landing-primary no-underline"
          >
            Entrar
          </Link>
        </div>
        <MobileMenu
          items={[
            { href: '#aprenderas', label: 'Lo que aprenderás' },
            { href: '#preguntas', label: 'Preguntas' },
          ]}
        />
      </div>

      <div
        className={`${sectionX} flex flex-wrap items-center gap-8 pt-6 pb-10 md:gap-12 md:pt-14 md:pb-16`}
      >
        <div className="flex flex-1 basis-110 flex-col gap-4 md:gap-5.5">
          <div className="self-start rounded-full bg-landing-tint px-3.5 py-1.5 text-sm font-bold text-landing-primary">
            {page.badge}
          </div>
          <h1 className="m-0 text-40 leading-105 font-black tracking-landing-title-4xl md:text-64 md:leading-102 md:tracking-landing-hero">
            {words.join(' ')}
            {accent && (
              <>
                {' '}
                <span className="text-landing-accent">{accent}</span>
              </>
            )}
          </h1>
          <p className="m-0 text-17 leading-150 text-landing-muted md:text-xl">
            {page.intro}
          </p>
          <div className="flex flex-col gap-1.5 rounded-16 border-1.5 border-landing-pink-line bg-landing-pink px-5 py-4 md:px-6 md:py-5">
            <div className="text-xs font-black tracking-landing-caps-lg text-landing-berry">
              PREGÚNTATE
            </div>
            <div className="text-19 leading-135 font-black tracking-landing-title-3xs md:text-22">
              {page.question}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-4">
            {buy(
              'inline-block rounded-12 bg-landing-primary px-7 py-4 text-lg font-black text-white no-underline',
            )}
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline gap-2.5">
                {page.strike && !page.free && (
                  <span className="text-22 text-landing-strike line-through">
                    {page.strike}
                  </span>
                )}
                <span className="text-32 leading-110 font-black">{price}</span>
              </div>
              <span className="text-sm text-landing-muted">
                Acceso inmediato anual
              </span>
            </div>
          </div>
        </div>
        <div className="relative flex aspect-video flex-1 basis-110 items-center justify-center overflow-hidden rounded-20 border border-landing-line bg-landing-cover">
          <img
            src={page.heroImage}
            alt={page.heroAlt}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="md:hidden">
            <Play mobile onPlay={onPlay} />
          </div>
          <div className="hidden md:block">
            <Play onPlay={onPlay} />
          </div>
        </div>
      </div>

      {page.free && <FreeOffer page={page} cta={buy} />}

      <div
        className={`${page.free ? 'border-b' : 'border-y'} border-landing-line bg-white`}
      >
        <div
          className={`${sectionX} flex flex-wrap items-center gap-x-14 gap-y-10 py-10 md:py-16`}
        >
          <div className="flex flex-1 basis-85 flex-col gap-5.5">
            <h2 className="m-0 text-28 leading-112 font-black tracking-landing-title-md md:text-34">
              {page.problemsTitle}
            </h2>
            <div className="flex flex-col gap-3">
              {page.problems.map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-3 text-lg leading-140 md:text-19"
                >
                  <span className="size-2.5 flex-none rounded-full bg-landing-accent" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <ExampleChart example={page.example} />
        </div>
      </div>

      <div
        id="aprenderas"
        className="border-y border-landing-line bg-costing-bg bg-[radial-gradient(ellipse_at_100%_0%,#f4e4f7_0%,transparent_46%),radial-gradient(ellipse_at_0%_100%,#f8e6f3_0%,transparent_40%)]"
      >
        <div className={`${sectionX} py-10 md:py-16`}>
          <Learn page={page} />
        </div>
      </div>

      <div className="border-b border-landing-line bg-white md:border-y">
        <div
          className={`${sectionX} flex flex-wrap items-center gap-10 py-10 md:py-16`}
        >
          <div className="aspect-square w-full max-w-60 flex-initial basis-60 overflow-hidden rounded-full border border-landing-line md:max-w-80 md:basis-80">
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
      </div>

      <div
        id="preguntas"
        className="mx-auto flex max-w-221 flex-col gap-5 px-4 py-10 md:px-8 md:py-16"
      >
        <h2 className={h2}>Preguntas frecuentes</h2>
        {page.faq.map((f) => (
          <div
            key={f.q}
            className="flex flex-col gap-1.5 rounded-xl border border-landing-line bg-white px-5 py-4 md:px-6 md:py-5"
          >
            <div className="text-17 font-black">{f.q}</div>
            <div className="text-base leading-155 text-landing-muted">
              {f.a}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-landing-primary text-white">
        <div className="mx-auto flex max-w-221 flex-col items-center gap-4.5 px-4 py-12 text-center md:px-8 md:py-16">
          <h2 className="m-0 text-2xl font-black tracking-landing-title-md md:text-36">
            Toma tu calculadora, tu hoja y tu postre favorito
          </h2>
          <div className="text-base text-landing-lavender md:text-lg">
            {page.free ? 'Gratis por entrar desde nuestras redes' : price} ·
            Acceso inmediato anual
          </div>
          {buy(
            'inline-block rounded-12 bg-white px-8 py-4 text-lg font-black text-landing-primary no-underline',
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-7 gap-y-4 px-4 py-7 text-sm text-landing-muted md:px-8">
        <span>© Capagla</span>
        <Link to="/terminos" className={footerLink}>
          Términos y condiciones
        </Link>
        <Link to="/privacidad" className={footerLink}>
          Aviso de privacidad
        </Link>
        <Link to="/devoluciones" className={footerLink}>
          Política de devoluciones
        </Link>
        <a href="mailto:contacto@capagla.com" className={footerLink}>
          Contacto
        </a>
      </div>

      {playing && page.introVideo && (
        <IntroVideo src={page.introVideo} onClose={close} />
      )}
    </div>
  )
}

// Promoción gratis: la tarjeta del curso y, si la promoción la trae, la herramienta opcional.
function FreeOffer({
  page,
  cta,
}: {
  page: CostingCoursePage
  cta: (className: string, label?: string) => ReactNode
}) {
  const pill =
    'self-start rounded-full px-2.5 py-1 text-xs font-black tracking-landing-caps text-white'
  const button =
    'flex min-h-13.5 items-center justify-center rounded-12 bg-landing-primary text-lg font-black text-white no-underline'

  return (
    <div className="border-y border-landing-promo-line bg-landing-promo">
      <div className={`${sectionX} flex flex-col gap-6 py-10 md:py-14`}>
        <h2 className="m-0 text-26 font-black tracking-landing-title md:text-30">
          Empieza gratis hoy
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] items-stretch gap-6">
          <div className="flex flex-col gap-3.5 rounded-20 border-1.5 border-landing-primary bg-white p-5 md:p-7">
            <div className={`${pill} bg-landing-primary`}>TU CURSO</div>
            <div className="text-28 leading-110 font-black tracking-landing-title-md md:text-30">
              {page.title}
            </div>
            <div className="text-15 leading-normal text-landing-muted">
              {page.courseCardText}
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              {page.strike && (
                <span className="text-xl text-landing-strike line-through">
                  {page.strike}
                </span>
              )}
              <span className="text-40 font-black tracking-landing-title-2xl">
                Gratis
              </span>
            </div>
            <div className="text-15 text-landing-muted">
              Acceso gratuito por entrar desde nuestras redes.
            </div>
            <div className="flex-1" />
            {cta(button, 'Empieza gratis ahora')}
          </div>

          {page.tool && (
            <div className="flex flex-col gap-3.5 rounded-20 border-1.5 border-landing-pink-line bg-landing-pink p-5 md:p-7">
              <div className={`${pill} bg-landing-berry`}>
                OFERTA ESPECIAL PARA TI · OPCIONAL
              </div>
              <ToolPreview />
              <div className="text-2xl font-black tracking-landing-logo">
                {page.tool.name}
              </div>
              <div className="text-15 leading-normal text-landing-muted">
                Registra ingredientes, recetas y gastos, calcula de forma
                automática y genera tus listas de compra y producciones.
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                {page.tool.old && (
                  <span className="text-lg text-landing-strike line-through">
                    {page.tool.old}
                  </span>
                )}
                <span className="text-32 font-black tracking-landing-title-md">
                  {page.tool.now}
                </span>
              </div>
              <div className="flex items-start gap-2.5 rounded-12 border border-landing-promo-line bg-white px-3.5 py-3 text-sm leading-normal text-landing-ink">
                <svg
                  aria-hidden="true"
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-none stroke-landing-lock"
                >
                  <path d="M5 12l4 4 10-10" />
                </svg>
                <span>
                  <b>Ya viene en tu carrito como oferta especial.</b> Si solo
                  quieres el curso gratuito, la quitas al revisar tu carrito.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Vista previa decorativa de la herramienta (lista de productos). Es una ilustración de la
// maqueta: sus colores y tamaños diminutos no son del sistema de diseño, por eso van sueltos.
function ToolPreview() {
  const row =
    'grid grid-cols-[2.2fr_1fr_1fr_1.6fr] items-center gap-1 px-2 py-[5px] text-[8px] text-[#1c1220]'
  const chip = 'justify-self-start rounded-[9px] px-[5px] py-px text-[7px]'
  const nav = 'px-[5px] text-[8px] text-[#cdb4e6]'
  return (
    <div
      role="img"
      aria-label="Vista previa de la herramienta de costos: lista de productos con costo, precio y estado"
      className="flex aspect-video overflow-hidden rounded-12 border border-[#d9c3df] bg-[#f3f1f3]"
    >
      <div
        aria-hidden="true"
        className="flex flex-[0_0_24%] flex-col gap-1.5 bg-[#2a1340] px-2 py-2.5"
      >
        <div className="flex items-center gap-[5px]">
          <span className="size-3.5 flex-none rounded bg-[#8b3be6]" />
          <span className="text-[9px] font-bold text-[#f2e9fb]">Capagla</span>
        </div>
        <div className="flex h-3.5 items-center rounded bg-[#5a1fa0] px-[5px] text-[8px] text-white">
          Productos
        </div>
        <div className={nav}>Recetas</div>
        <div className={nav}>Ingredientes</div>
        <div className={nav}>Lista de compra</div>
        <div className={nav}>Producción</div>
      </div>
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5"
      >
        <div className="text-xs font-bold text-[#1c1220]">Productos</div>
        <div className="flex flex-col rounded-md border border-[#e6dfe8] bg-white">
          <div
            className={`${row} border-b border-[#eee7f0] text-[7.5px] !text-[#7a6a80]`}
          >
            <span>Producto</span>
            <span>Costo</span>
            <span>Precio</span>
            <span>Estado</span>
          </div>
          <div className={`${row} border-b border-[#eee7f0]`}>
            <span>Pastel Red Velvet</span>
            <span>$423.56</span>
            <span>$520.00</span>
            <span className={`${chip} bg-[#fcefc7] text-[#7a4a05]`}>
              Te queda poco
            </span>
          </div>
          <div className={`${row} border-b border-[#eee7f0]`}>
            <span>Pastel tradicional</span>
            <span>$392.51</span>
            <span>$380.00</span>
            <span className={`${chip} bg-[#fbe1e1] text-[#8a1c1c]`}>
              Vendes a pérdida
            </span>
          </div>
          <div className={row}>
            <span>Brownie de cheesecake</span>
            <span>$258.40</span>
            <span>$420.00</span>
            <span className={`${chip} bg-[#d9f3e0] text-[#1d6b35]`}>
              Buen margen
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Svg({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

const paths = {
  ingredients:
    'M5 20 19 6M9 16c-4 1-5-2-4-5 3 0 5 1 4 5Zm4-4c-4 1-5-2-4-5 3 0 5 1 4 5Zm0 0c-1 4 2 5 5 4 0-3-1-5-5-4Zm4-4c0-4 2-5 5-5 0 3-1 5-5 5Z',
  packaging: 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10M7.5 5l9 4v4',
  gas: 'M13 2c1 5-4 6-4 10 0 1 .4 2 1 2.5 0-3 3-3 4-6 3 3 5 5 5 8a7 7 0 0 1-14 0c0-6 5-9 8-14.5Z',
}

const clock = (
  <>
    <circle cx="12" cy="13" r="8" />
    <path d="M9 2h6m-3 7v4l3 2m3-8 2-2" />
  </>
)

// Ícono y colores de cada costo de la gráfica.
const costStyle: Record<
  CostingKind,
  { icon: ReactNode; bg: string; fg: string }
> = {
  ingredients: {
    icon: <path d={paths.ingredients} />,
    bg: '#562278',
    fg: '#fff',
  },
  packaging: {
    icon: <path d={paths.packaging} />,
    bg: '#b77bd4',
    fg: '#311640',
  },
  time: { icon: clock, bg: '#d9b6ed', fg: '#311640' },
  gas: { icon: <path d={paths.gas} />, bg: '#8b479d', fg: '#fff' },
}

const topicIcons: Record<CostingTopicIcon, ReactNode> = {
  price: (
    <>
      <path d="M3 4h8l9 9-7 7-10-9V4Z" />
      <circle cx="7.5" cy="8" r="1" />
    </>
  ),
  waste: <path d="M12 3v17m-5 0h10M4 7h16M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7Z" />,
  piece: (
    <>
      <path d="M11 3a9 9 0 1 0 10 10H11V3Z" />
      <path d="M14 3v7h7a9 9 0 0 0-7-7Z" />
    </>
  ),
  package: <path d={paths.packaging} />,
  time: clock,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chart: <path d="M4 4v16h16M7 15l4-4 3 2 5-6m-4 0h4v4" />,
  quote: <path d="M9 5H6v16h12V5h-3M9 3h6v5H9zm0 11 2 2 4-4" />,
}

const profitBg = 'linear-gradient(105deg,#ad166f,#cc258a)'
const segmentSheen = 'linear-gradient(160deg,#ffffff20,#00000012)'

// «¿Cuánto te queda por postre?»: una venta, dos barras. Los anchos salen de los pesos del
// ejemplo; cada tramo muestra su ícono y su monto según el ancho que le toca.
function ExampleChart({ example }: { example: CostingCoursePage['example'] }) {
  const { sale, costs } = example
  const pct = (n: number) => `${(n / sale) * 100}%`
  const base = costs[0]
  const hidden = costs.slice(1).reduce((sum, c) => sum + c.amount, 0)
  const hiddenStart = (base.amount / sale) * 100
  const hiddenWidth = (hidden / sale) * 100

  const Segment = ({ kind, amount }: { kind: CostingKind; amount: number }) => {
    const { icon, bg, fg } = costStyle[kind]
    return (
      <span
        className="@container grid min-w-0 place-items-center not-first:shadow-[inset_1px_0_#fff9]"
        style={{
          flex: `0 0 ${pct(amount)}`,
          color: fg,
          background: `${segmentSheen}, ${bg}`,
        }}
      >
        <span className="hidden items-center justify-center gap-[5px] text-xs font-bold whitespace-nowrap @min-[24px]:inline-flex">
          <Svg className="block size-4.5 flex-none">{icon}</Svg>
          <span className="hidden @min-[86px]:inline">${amount}</span>
        </span>
      </span>
    )
  }
  const Profit = ({ amount }: { amount: number }) => (
    <span
      className="@container grid min-w-0 place-items-center text-white not-first:shadow-[inset_1px_0_#fff9]"
      style={{ flex: `0 0 ${pct(amount)}`, background: profitBg }}
    >
      <span className="hidden text-xs font-bold whitespace-nowrap @min-[86px]:inline">
        Utilidad
      </span>
    </span>
  )
  const Head = ({
    label,
    profit,
    plum,
    children,
  }: {
    label: string
    profit: number
    plum?: boolean
    children: ReactNode
  }) => (
    <p className="m-0 mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5 p-0">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid size-7 flex-none place-items-center rounded-full ${plum ? 'bg-costing-face-plum text-costing-plum' : 'bg-costing-face text-costing-rose'}`}
        >
          <Svg className="block size-4.5">{children}</Svg>
        </span>
        <span className="text-15 font-black">{label}</span>
      </span>
      <span className="inline-flex flex-wrap items-baseline gap-x-1 text-xs font-bold text-costing-muted">
        <strong className="text-22 leading-none font-black tracking-landing-tight text-costing-rose tabular-nums md:text-29">
          ${profit}
        </strong>
        <span>de utilidad</span>
      </span>
    </p>
  )

  return (
    <div className="min-w-0 flex-1 basis-115 rounded-22 border border-costing-line bg-costing-paper p-4.5 text-sm leading-140 text-costing-ink [overflow-wrap:anywhere] md:p-7.5">
      <p className="m-0 p-0 text-11 font-bold tracking-landing-kicker text-costing-rose uppercase">
        {example.kicker}
      </p>
      <h3 className="m-0 mt-1 p-0 text-26 leading-106 font-black tracking-landing-tight md:text-36">
        {example.title}
      </h3>
      <p className="m-0 mt-1.75 p-0 text-sm text-costing-muted">
        Cada barra representa una venta de{' '}
        <strong className="text-costing-ink">${sale}</strong>.
      </p>

      <div className="mt-5.25 grid gap-4.25">
        <div>
          <Head
            label={example.perceived.label}
            profit={example.perceived.profit}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 14c2 3 6 3 8 0M9 9.5h.01m6 0h.01" />
          </Head>
          <div
            role="img"
            aria-label={`$${sale} de venta, ${base.label} $${base.amount}, $${example.perceived.profit} de utilidad`}
            className="relative flex h-11 overflow-hidden rounded-[9px] bg-costing-track md:h-14.5"
          >
            <Segment kind={base.kind} amount={base.amount} />
            <Profit amount={example.perceived.profit} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0"
              style={{
                left: `${hiddenStart}%`,
                width: `${hiddenWidth}%`,
                background:
                  'repeating-linear-gradient(135deg,transparent 0 5px,#fff5 5px 7px)',
              }}
            />
          </div>
        </div>

        <div>
          <Head
            label={example.actual.label}
            profit={example.actual.profit}
            plum
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9 15h6M9 9.5h.01m6 0h.01" />
          </Head>
          <div className="relative mb-0.75 h-7 text-costing-plum">
            <span
              aria-hidden="true"
              className="absolute bottom-0 h-1.75 rounded-t border border-b-0 border-costing-bracket"
              style={{ left: `${hiddenStart}%`, width: `${hiddenWidth}%` }}
            />
            <span
              className="absolute top-0 -translate-x-1/2 text-xs font-bold whitespace-nowrap"
              style={{
                left: `clamp(82px, ${hiddenStart + hiddenWidth / 2}%, calc(100% - 82px))`,
              }}
            >
              {example.actual.hiddenLabel} · ${hidden}
            </span>
          </div>
          <div
            role="img"
            aria-label={`$${sale} de venta, ${costs.map((c) => `${c.label} $${c.amount}`).join(', ')}, $${example.actual.profit} de utilidad`}
            className="relative flex h-11 overflow-hidden rounded-[9px] bg-costing-track md:h-14.5"
          >
            {costs.map((c) => (
              <Segment key={c.kind} kind={c.kind} amount={c.amount} />
            ))}
            <Profit amount={example.actual.profit} />
          </div>
        </div>
      </div>

      <p className="m-0 mt-3 p-0 text-xs text-costing-muted">
        {example.explain}
      </p>
      <ul
        aria-label="Costos por unidad"
        className="m-0 mt-4 grid list-none grid-cols-[repeat(auto-fit,minmax(min(125px,100%),1fr))] gap-x-3 gap-y-2.25 border-t border-costing-line px-0 pt-3.25 pb-0"
      >
        {costs.map((c) => {
          const { icon, bg, fg } = costStyle[c.kind]
          return (
            <li
              key={c.kind}
              className="flex min-w-0 items-center gap-1.75 text-xs leading-120"
            >
              <span
                className="grid size-6.75 flex-none place-items-center rounded-md"
                style={{ color: fg, background: bg }}
              >
                <Svg className="block size-4">{icon}</Svg>
              </span>
              <span>
                {c.label}
                <strong className="mt-0.5 block font-black">${c.amount}</strong>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="m-0 mt-2.25 p-0 text-11 text-costing-muted">
        {example.note}
      </p>
    </div>
  )
}

// «Lo que vas a dominar»: tres etapas unidas por un riel; en un ancho angosto se apilan.
function Learn({ page }: { page: CostingCoursePage }) {
  const steps = [
    ['var(--color-costing-step-1)', 'var(--color-costing-step-2)'],
    ['var(--color-costing-step-2)', 'var(--color-costing-rose)'],
    ['var(--color-costing-rose)', 'var(--color-costing-rose)'],
  ]
  return (
    <section className="@container" aria-labelledby="costing-learn">
      <h2
        id="costing-learn"
        className="m-0 text-28 leading-105 font-black tracking-landing-title-md md:text-36"
      >
        {page.learnTitle}
      </h2>
      <p className="m-0 mt-2.5 max-w-[72ch] text-17 leading-150 text-costing-text">
        {page.learnIntro}
      </p>
      <ol
        className="m-0 mt-9 grid list-none grid-cols-3 gap-x-(--column-gap) p-0 @max-[525px]:grid-cols-1 @max-[525px]:gap-x-0"
        style={{ '--column-gap': 'clamp(20px,3.5vw,48px)' } as CSSProperties}
      >
        {page.stages.map((stage, i) => (
          <li
            key={stage.title}
            className="relative min-w-0 @max-[525px]:pb-4.5 @max-[525px]:pl-13.5 @max-[525px]:last:pb-0"
            style={
              {
                '--step': steps[i % steps.length][0],
                '--rail-end': steps[i % steps.length][1],
              } as CSSProperties
            }
          >
            {i < page.stages.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-4.75 left-5 h-0.5 w-[calc(100%+var(--column-gap))] bg-linear-to-r from-(--step) to-(--rail-end) opacity-45 @max-[525px]:-bottom-4.5 @max-[525px]:left-4.75 @max-[525px]:h-auto @max-[525px]:w-0.5 @max-[525px]:bg-linear-to-b"
              />
            )}
            <div className="min-h-24 @max-[525px]:mb-1 @max-[525px]:min-h-0">
              <span
                aria-hidden="true"
                className="relative z-10 grid size-10 place-items-center rounded-full bg-(--step) text-15 font-bold text-white tabular-nums @max-[525px]:absolute @max-[525px]:top-0 @max-[525px]:left-0"
              >
                {i + 1}
              </span>
              <h3 className="m-0 mt-3.5 p-0 text-[clamp(19px,2.4vw,24px)] leading-113 font-black tracking-landing-tighter text-(--step) [overflow-wrap:anywhere] @max-[525px]:mt-1.5">
                {stage.title}
              </h3>
            </div>
            <ul className="m-0 list-none p-0">
              {stage.topics.map((t) => (
                <li
                  key={t.title}
                  className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)] items-start gap-3 py-4 not-first:border-t not-first:border-costing-line-2"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-8 place-items-center rounded-full bg-costing-mark text-(--step)"
                  >
                    <Svg className="block size-4.5">{topicIcons[t.icon]}</Svg>
                  </span>
                  <div>
                    <strong className="block text-base leading-130 font-bold [overflow-wrap:anywhere]">
                      {t.title}
                    </strong>
                    <p className="m-0 mt-1 p-0 text-15 leading-150 text-costing-text">
                      {t.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
