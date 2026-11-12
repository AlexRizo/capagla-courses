import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { Play } from '#/components/landing-parts'
import { MobileMenu } from '#/components/mobile-menu'
import type { ToolPage, ToolPlan } from '#/lib/tool-page'
import { track } from '#/lib/track-client'

// Página pública de la herramienta de costos (maqueta última, 2026-11-11; solo hay diseño de
// escritorio: en móvil las columnas se apilan). Los textos y ejemplos son los de la maqueta; los
// planes y precios salen de los productos de la herramienta (`lib/tool-page.ts`).

const h2 =
  'm-0 text-28 leading-120 font-black tracking-landing-title-md md:text-34'
const wrap = 'mx-auto max-w-280 px-4 md:px-8'

// Iconos de línea de la maqueta (24×24, trazo 1.7).
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 5" />
    </>
  ),
  box: <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10" />,
  up: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  oven: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 8h18" />
      <rect x="7" y="11" width="10" height="6" rx="1" />
      <path d="M7 5.5h.01M10.5 5.5h.01" />
    </>
  ),
  tag: (
    <>
      <path d="M3 4h8l9 9-7 7-10-9V4Z" />
      <circle cx="7.5" cy="8" r="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M9 2h6m-3 7v4l3 2" />
    </>
  ),
  flame: (
    <path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7Z" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14c2 3 6 3 8 0M9 9.5h.01m6 0h.01" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0Z" />
      <path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4" />
    </>
  ),
  egg: <path d="M12 3c-4 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3-11-7-11Z" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h3l3 12h11l2-8H6" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h9l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
}

// ---------- Encabezado ----------

function Header() {
  const nav =
    'inline-flex min-h-10 items-center rounded-full px-4.5 text-15 font-bold text-landing-ink no-underline hover:bg-white hover:text-landing-primary'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-landing-line bg-white px-4 py-3 md:px-8 md:py-3.5">
      <Link
        to="/"
        className="text-22 font-black tracking-landing-logo text-landing-primary no-underline md:text-2xl"
      >
        Capagla
      </Link>
      <div className="hidden flex-wrap items-center gap-1.5 rounded-full border border-landing-line bg-landing-nav p-1.25 md:flex">
        <a href="/#cursos" className={nav}>
          Cursos
        </a>
        <a href="/clase-gratis" className={nav}>
          Clase gratis
        </a>
        <a href="#planes" className={nav}>
          Planes
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
          { href: '/#cursos', label: 'Cursos' },
          { href: '/clase-gratis', label: 'Clase gratis' },
          { href: '#planes', label: 'Planes' },
        ]}
      />
    </div>
  )
}

// ---------- Hero ----------

function Hero({ page }: { page: ToolPage }) {
  return (
    <div
      className={`${wrap} flex flex-wrap items-center gap-8 pt-8 pb-10 md:gap-12 md:pt-16 md:pb-14`}
    >
      <div className="flex min-w-0 flex-1 basis-105 flex-col gap-4 md:gap-5">
        <div className="self-start rounded-full bg-landing-tint px-3.5 py-1.5 text-sm font-bold text-landing-primary">
          Herramienta de costos
        </div>
        <h1 className="m-0 text-36 leading-106 font-black tracking-landing-title-2xl md:text-52 md:tracking-landing-title-3xl">
          {page.title}
        </h1>
        <p className="m-0 text-17 leading-155 text-landing-muted md:text-19">
          {page.intro}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a
            href="#planes"
            className="inline-block rounded-12 bg-landing-primary px-7 py-4 text-lg font-black text-white no-underline"
          >
            Ver planes
          </a>
          <a
            href="#como"
            className="inline-block px-2 py-4 text-base font-bold text-landing-primary no-underline"
          >
            Cómo funciona
          </a>
        </div>
        <div className="text-15 text-landing-muted">
          Desde ${page.fromMxn} al año · incluye el curso Aprende a Costear
        </div>
      </div>
      {/* Aún no hay video de la herramienta: el recuadro queda como en la maqueta, sin acción. */}
      <div className="relative flex aspect-video min-w-0 flex-1 basis-115 items-center justify-center overflow-hidden rounded-20 bg-landing-ink shadow-tool-video">
        <Play />
      </div>
    </div>
  )
}

// ---------- Lo que pasa en tu cocina ----------

const PAINS = [
  {
    icon: ICONS.people,
    title: 'Vendes al precio de otras',
    text: 'Sin saber si a ti te deja algo.',
  },
  {
    icon: ICONS.box,
    title: 'Un postre es más que ingredientes',
    text: 'La caja, tus horas, el gas y la luz también van en el precio.',
  },
  {
    icon: ICONS.up,
    title: 'Subió la mantequilla',
    text: 'Y no sabes cuánto le pega a tus recetas.',
  },
  {
    icon: ICONS.oven,
    title: 'Se descompone el horno',
    text: 'Y no hay de dónde sacar para el nuevo.',
  },
]

const CAKE = [
  { label: 'Ingredientes', value: 210, bg: 'bg-tool-bar-1', icon: ICONS.tag },
  { label: 'Empaque', value: 25, bg: 'bg-tool-bar-2' },
  { label: 'Tu tiempo', value: 120, bg: 'bg-tool-bar-3', icon: ICONS.clock },
  {
    label: 'Gas, luz y horno',
    value: 69,
    bg: 'bg-tool-bar-4 text-tool-bar-4-ink',
    icon: ICONS.flame,
  },
  { label: 'Te queda', value: 96, bg: 'bg-costing-rose', icon: ICONS.smile },
]

function Kitchen() {
  return (
    <div className="border-y border-landing-line bg-white">
      <div
        className={`${wrap} flex flex-wrap items-center gap-10 py-10 md:py-14`}
      >
        <div className="flex min-w-0 flex-1 basis-100 flex-col gap-6">
          <h2 className={h2}>Lo que pasa en tu cocina</h2>
          <ul className="m-0 flex list-none flex-col gap-4.5 p-0">
            {PAINS.map((p) => (
              <li key={p.title} className="flex items-start gap-3.5">
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-costing-face text-costing-rose">
                  <Icon>{p.icon}</Icon>
                </span>
                <div className="flex flex-col gap-0.5">
                  <strong className="text-lg font-black">{p.title}</strong>
                  <span className="text-15 leading-150 text-landing-muted">
                    {p.text}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-1 basis-110 flex-col gap-3.5 rounded-22 border border-costing-line bg-costing-paper p-5 md:p-7">
          <div className="text-11 font-bold tracking-landing-kicker text-costing-rose uppercase">
            Ejemplo
          </div>
          <div className="text-22 leading-110 font-black tracking-landing-title-2xs md:text-26">
            Vendes un pastel en $520. ¿Cuánto es tuyo?
          </div>
          <div
            role="img"
            aria-label="De $520: ingredientes $210, empaque $25, tu tiempo $120, gas, luz y horno $69, te quedan $96"
            className="flex h-13.5 overflow-hidden rounded-10"
          >
            {CAKE.map((c) => (
              <span
                key={c.label}
                title={`${c.label} $${c.value}`}
                className={`flex items-center justify-center text-white shadow-tool-seam ${c.bg}`}
                style={{ flex: `0 0 ${((c.value / 520) * 100).toFixed(2)}%` }}
              >
                {c.icon && <Icon size={18}>{c.icon}</Icon>}
              </span>
            ))}
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
            {CAKE.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                <span className={`size-3 flex-none rounded-sm ${c.bg}`} />
                <span className="text-landing-muted">{c.label}</span>
                <strong
                  className={`ml-auto tabular-nums ${c.label === 'Te queda' ? 'text-costing-rose' : ''}`}
                >
                  ${c.value}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------- Cómo funciona ----------

const mock =
  'flex h-42.5 flex-col gap-2 rounded-14 border border-tool-mock-line bg-tool-mock p-3.5 font-system text-xs text-landing-ink'
const mockRow = 'flex justify-between gap-1.5 rounded-lg bg-white px-2.5 py-2'

const STEPS: { title: string; text: string; mock: ReactNode }[] = [
  {
    title: 'Anota lo que compras',
    text: 'Precio y presentación, tal como viene en el ticket.',
    mock: (
      <div aria-hidden="true" className={mock}>
        <div className="text-13 font-bold">Ingredientes</div>
        {[
          ['Mantequilla · 1 kg', '$180'],
          ['Azúcar glass · 1 kg', '$44'],
          ['Caja para 6 · 10 pzas', '$95'],
        ].map(([l, v]) => (
          <div key={l} className={mockRow}>
            <span>{l}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Arma tus recetas',
    text: 'En gramos. Tu betún o tu masa base los capturas una vez.',
    mock: (
      <div aria-hidden="true" className={mock}>
        <div className="flex items-center justify-between">
          <span className="text-13 font-bold">Betún de mantequilla</span>
          <span className="rounded-full bg-landing-tint px-2 py-0.5 text-11 font-bold text-landing-primary">
            Premezcla
          </span>
        </div>
        <div className={mockRow}>
          <span>Mantequilla 250 g</span>
          <b>$45</b>
        </div>
        <div className={mockRow}>
          <span>Azúcar glass 500 g</span>
          <b>$22</b>
        </div>
        <div className="text-xs font-bold text-landing-primary">
          Se usa en 4 recetas
        </div>
      </div>
    ),
  },
  {
    title: 'Crea tu producto',
    text: 'Receta, empaque, tus horas y gastos fijos: tu costo real.',
    mock: (
      <div aria-hidden="true" className={`${mock} gap-1.75`}>
        <div className="text-13 font-bold">Cupcakes navideños · 12</div>
        <div className="flex h-3.5 overflow-hidden rounded-full">
          <span className="flex-96 bg-landing-primary" />
          <span className="flex-14 bg-landing-accent" />
          <span className="flex-80 bg-landing-pink-line" />
          <span className="flex-30 bg-landing-bar" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.75">
          <span>Ingredientes</span>
          <b>$96</b>
          <span>Empaque</span>
          <b>$14</b>
          <span>Tu tiempo</span>
          <b>$80</b>
          <span>Gastos fijos</span>
          <b>$30</b>
        </div>
        <div className="flex justify-between border-t border-tool-mock-line pt-1.25 font-bold">
          <span>Te cuesta</span>
          <span>$220</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Ponle precio',
    text: 'Te sugiere uno y el semáforo te dice cómo vas.',
    mock: (
      <div aria-hidden="true" className={mock}>
        <div className="text-13 font-bold">Precio</div>
        <div className={mockRow}>
          <span>Sugerido (×2.5)</span>
          <b>$550</b>
        </div>
        <div className={mockRow}>
          <span>Lo vendes a</span>
          <b>$600</b>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold">Te queda $380</span>
          <span className="rounded-full bg-landing-good-bg px-2.25 py-0.75 text-11 font-bold text-landing-good">
            ×2.7 Buen precio
          </span>
        </div>
      </div>
    ),
  },
]

function HowItWorks() {
  return (
    <div id="como" className={`${wrap} flex flex-col gap-7 py-10 md:py-16`}>
      <h2 className={h2}>Cómo funciona</h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3">
            {s.mock}
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-landing-primary font-black text-white">
                {i + 1}
              </span>
              <span className="text-19 font-black">{s.title}</span>
            </div>
            <span className="text-base leading-150 text-landing-muted">
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- Para lo que te pasa todos los días ----------

const DAILY = [
  {
    title: 'Tus costos reales',
    color: 'text-costing-step-1',
    line: 'border-costing-step-1',
    items: [
      [
        ICONS.bowl,
        'El mismo betún en 5 postres',
        'Guárdalo como premezcla: se suma solo.',
      ],
      [
        ICONS.up,
        'Subió el azúcar',
        'Cambias el precio una vez y se recalcula todo.',
      ],
      [ICONS.egg, '¿Huevo en piezas o en gramos?', 'Como tú lo uses.'],
      [
        ICONS.receipt,
        '¿Das factura?',
        'Eliges el impuesto y el precio ya lo incluye.',
      ],
    ],
  },
  {
    title: 'Lo que nadie cuenta',
    color: 'text-costing-step-2',
    line: 'border-costing-step-2',
    items: [
      [ICONS.clock, 'Tus horas', 'Dices cuánto quieres ganar por hora.'],
      [
        ICONS.flame,
        'Gas, luz y el cuarto',
        'Lo del mes se reparte entre tus horas.',
      ],
      [
        ICONS.oven,
        'Tu horno no es eterno',
        'Cada postre carga su parte. Apártala para reponerlo.',
      ],
      [
        ICONS.truck,
        'Lo vas a entregar',
        'Te recuerda sumar gasolina y comisiones.',
      ],
    ],
  },
  {
    title: 'Tus pedidos',
    color: 'text-costing-rose',
    line: 'border-costing-rose',
    badge: 'Plan Completo',
    items: [
      [ICONS.alert, 'Salieron menos piezas', 'Producción te avisa.'],
      [
        ICONS.calendar,
        '3 pedidos el sábado',
        'Suma cuánto necesitas de cada ingrediente.',
      ],
      [ICONS.cart, 'Llegas al súper', 'Lista por tienda, en tu celular.'],
      [
        ICONS.doc,
        '50 cupcakes para una boda',
        'Cotizas con tus costos reales.',
      ],
    ],
  },
] as const

function Daily() {
  return (
    <div className="border-y border-landing-line bg-costing-bg bg-[radial-gradient(at_100%_0%,var(--color-tool-icon)_0%,transparent_46%),radial-gradient(at_0%_100%,var(--color-tool-glow)_0%,transparent_40%)]">
      <div className={`${wrap} flex flex-col gap-8 py-10 md:py-16`}>
        <h2 className={h2}>Para lo que te pasa todos los días</h2>
        <div className="grid grid-cols-1 gap-9 md:grid-cols-3">
          {DAILY.map((col) => (
            <div key={col.title} className="flex min-w-0 flex-col gap-4.5">
              <div
                className={`flex flex-wrap items-center gap-2.5 border-b-2 pb-2.5 ${col.line}`}
              >
                <span className={`text-xl font-black ${col.color}`}>
                  {col.title}
                </span>
                {'badge' in col && (
                  <span className="rounded-full bg-landing-primary px-2.25 py-0.75 text-11 font-black text-white">
                    {col.badge}
                  </span>
                )}
              </div>
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {col.items.map(([icon, title, text]) => (
                  <li key={title} className="flex items-start gap-3">
                    <span
                      className={`flex size-8.5 flex-none items-center justify-center rounded-full bg-tool-icon ${col.color}`}
                    >
                      <Icon size={18}>{icon}</Icon>
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-base font-black">{title}</strong>
                      <span className="text-sm leading-145 text-tool-muted">
                        {text}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Semáforo ----------

const LIGHTS = [
  {
    label: 'Pierdes',
    dot: 'bg-tool-loss',
    pill: 'bg-tool-loss-bg text-tool-loss-ink',
  },
  {
    label: 'Ganas poco',
    dot: 'bg-tool-low',
    pill: 'bg-tool-low-bg text-tool-low-ink',
  },
  {
    label: 'Buen precio',
    dot: 'bg-tool-good',
    pill: 'bg-landing-good-bg text-landing-good',
  },
  {
    label: 'Excelente',
    dot: 'bg-tool-great shadow-tool-great',
    pill: 'bg-tool-great-bg text-tool-great-ink',
  },
]

const PRODUCTS = [
  ['Pastel tradicional', '$393', '$380', '−$13', 0],
  ['Pastel Red Velvet', '$424', '$520', '$96', 1],
  ['Enjambres (bolsa de 6)', '$54', '$150', '$96', 2],
  ['Galletas decoradas (docena)', '$110', '$420', '$310', 3],
] as const

const cols = 'grid grid-cols-[1.7fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-2'

function Traffic() {
  return (
    <div className="bg-landing-ink text-white">
      <div
        className={`${wrap} flex flex-wrap items-center gap-10 py-10 md:py-16`}
      >
        <div className="flex min-w-0 flex-1 basis-85 flex-col gap-4">
          <h2 className={h2}>¿Cuánto te queda por postre?</h2>
          <p className="m-0 text-17 leading-160 text-landing-lilac">
            El semáforo compara tu precio con lo que te cuesta hacerlo. Lo
            recomendado es cobrar al menos 2.5 veces tu costo.
          </p>
          <div className="grid grid-cols-2 gap-2.5 text-15">
            {LIGHTS.map((l) => (
              <div key={l.label} className="flex items-center gap-2.5">
                <span className={`size-3.5 flex-none rounded-full ${l.dot}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-130 overflow-hidden rounded-16 bg-white text-landing-ink">
          <div className="flex items-center justify-between border-b border-tool-row px-4.5 py-3.5">
            <span className="font-black">Mis productos</span>
            <span className="rounded-full bg-landing-nav px-2.5 py-0.75 text-xs font-bold text-landing-strike">
              Ejemplo
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-125">
              <div
                className={`${cols} px-4.5 py-2.5 text-xs font-bold tracking-[0.5px] text-landing-strike uppercase`}
              >
                <span>Producto</span>
                <span>Te cuesta</span>
                <span>Lo vendes</span>
                <span>Te queda</span>
                <span>Semáforo</span>
              </div>
              {PRODUCTS.map(([name, cost, price, left, light]) => (
                <div
                  key={name}
                  className={`${cols} items-center border-t border-tool-row px-4.5 py-3 text-15 tabular-nums`}
                >
                  <span>{name}</span>
                  <span>{cost}</span>
                  <span>{price}</span>
                  <span
                    className={
                      light === 0 ? 'font-bold text-tool-loss-ink' : undefined
                    }
                  >
                    {left}
                  </span>
                  <span
                    className={`justify-self-start rounded-full px-2.5 py-0.75 text-13 font-bold ${LIGHTS[light].pill}`}
                  >
                    {LIGHTS[light].label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Planes ----------

// Lo que incluye cada nivel (por `rank`: 1 Básico, 2 Completo), con su límite de elementos.
function features(plan: ToolPlan) {
  const limit = `Hasta ${plan.itemLimit.toLocaleString('en-US')} elementos`
  if (plan.rank === 1) {
    return [
      'Ingredientes, recetas y premezclas',
      'Precio sugerido y semáforo',
      'Tus horas, gastos fijos, horno e impuestos',
      limit,
      'Curso Aprende a Costear',
    ]
  }
  return [
    'Todo lo del Básico',
    'Producción para tus pedidos',
    'Lista de compra en el celular',
    'Registro de compras que actualiza tus precios',
    'Cotizador',
    limit,
    'Curso Aprende a Costear',
  ]
}

const PLAN_TEXT: Record<number, string> = {
  1: 'Para saber cuánto te cuesta cada postre y a cuánto venderlo.',
  2: 'Para cuando ya tienes pedidos: producción, compras y cotizaciones.',
}

function Plans({ plans }: { plans: ToolPlan[] }) {
  const top = Math.max(...plans.map((p) => p.rank))
  return (
    <div id="planes" className={`${wrap} flex flex-col gap-7 py-10 md:py-16`}>
      <div className="flex flex-col gap-2">
        <h2 className={h2}>Elige tu plan</h2>
        <p className="m-0 text-17 text-landing-muted">
          Pago anual. Los dos incluyen el curso Aprende a Costear.
        </p>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        {plans.map((p) => {
          const best = plans.length > 1 && p.rank === top
          return (
            <div
              key={p.slug}
              className={`relative flex flex-col gap-4 rounded-20 bg-white p-6 md:p-8 ${best ? 'border-2 border-landing-primary shadow-tool-plan' : 'border border-landing-line'}`}
            >
              {best && (
                <div className="absolute -top-3.5 left-6 rounded-full bg-landing-accent px-3 py-1.25 text-xs font-black tracking-landing-caps text-white md:left-8">
                  TODO INCLUIDO
                </div>
              )}
              <div className="text-2xl font-black">{p.name}</div>
              {PLAN_TEXT[p.rank] && (
                <div className="text-15 text-landing-muted">
                  {PLAN_TEXT[p.rank]}
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-2">
                {p.strikeMxn !== null && (
                  <span className="text-xl font-bold text-landing-strike line-through">
                    ${p.strikeMxn}
                  </span>
                )}
                <span className="text-44 font-black tracking-landing-title-2xl">
                  ${p.priceMxn}
                </span>
                <span className="text-base text-landing-muted">MXN al año</span>
              </div>
              {p.note && (
                <div className="-mt-2 text-sm font-bold text-landing-accent">
                  {p.note}
                </div>
              )}
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-15 leading-145">
                {features(p).map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="font-black text-landing-lock"
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex-1" />
              <a
                href={p.href}
                className={`flex min-h-13 items-center justify-center rounded-12 text-17 font-black no-underline ${best ? 'bg-landing-primary text-white' : 'border-1.5 border-landing-primary text-landing-primary'}`}
              >
                Elegir {p.name}
              </a>
            </div>
          )
        })}
      </div>
      <div className="text-sm text-landing-muted">
        Un elemento es un ingrediente, una premezcla, una receta, un producto o
        una cotización.
      </div>
    </div>
  )
}

// ---------- Curso incluido, preguntas y cierre ----------

function IncludedCourse({ href }: { href: string | null }) {
  return (
    <div className="border-y border-landing-promo-line bg-landing-promo">
      <div
        className={`${wrap} flex flex-wrap items-center justify-between gap-x-10 gap-y-6 py-10 md:py-12`}
      >
        <div className="flex min-w-0 flex-1 basis-120 flex-col gap-2">
          <div className="self-start rounded-full bg-landing-accent px-2.5 py-1 text-xs font-black tracking-landing-caps text-white">
            INCLUIDO EN LOS DOS PLANES
          </div>
          <h2 className="m-0 text-26 font-black tracking-landing-title-2xs md:text-28">
            Curso Aprende a Costear
          </h2>
          <p className="m-0 text-base leading-155 text-landing-muted">
            8 videos cortos con Gladis. Lo ves en una tarde y luego lo aplicas
            aquí.
          </p>
        </div>
        {href && (
          <a
            href={href}
            className="inline-flex min-h-12 items-center justify-center rounded-12 border-1.5 border-landing-primary px-6 text-base font-black text-landing-primary no-underline"
          >
            Ver el curso
          </a>
        )}
      </div>
    </div>
  )
}

const FAQ = [
  {
    q: '¿Necesito saber de costos o de contabilidad?',
    a: 'No. Los dos planes incluyen el curso Aprende a Costear. La herramienta usa un método sencillo, no el contable.',
  },
  {
    q: '¿Cuánto tiempo tengo acceso?',
    a: '365 días desde tu compra. La renovación es opcional: al vencer no hay cobro automático, y antes te avisamos para que renueves con descuento sobre el precio original.',
  },
  {
    q: '¿Qué cuenta como elemento?',
    a: 'Un ingrediente, una premezcla, una receta, un producto o una cotización. Las producciones y las listas de compra no cuentan: se borran solas a los 30 días.',
  },
  {
    q: '¿La puedo usar en el celular?',
    a: 'Sí, desde el navegador. La lista de compra del plan Completo está pensada para usarla en la tienda.',
  },
  {
    q: 'Ya compré Aprende a Costear, ¿lo pago otra vez?',
    a: 'Escríbenos y te descontamos lo que pagaste por el curso.',
  },
  {
    q: '¿Qué métodos de pago hay?',
    a: 'Tarjeta, Apple Pay o Google Pay, procesados con Stripe.',
  },
]

function Faq() {
  return (
    <div className="mx-auto flex max-w-200 flex-col gap-2.5 px-4 py-10 md:px-8 md:py-16">
      <h2 className={`${h2} mb-2.5`}>Preguntas frecuentes</h2>
      {FAQ.map((f) => (
        <details
          key={f.q}
          className="group rounded-12 border border-landing-line bg-white px-4.5"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 text-17 font-black [&::-webkit-details-marker]:hidden">
            <span>{f.q}</span>
            <span className="flex-none text-22 text-landing-primary">
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">−</span>
            </span>
          </summary>
          <div className="pb-4 text-base leading-155 text-landing-muted">
            {f.a}
          </div>
        </details>
      ))}
    </div>
  )
}

function Closing({ fromMxn }: { fromMxn: number }) {
  return (
    <div className="bg-landing-primary text-white">
      <div className="mx-auto flex max-w-190 flex-col items-center gap-3.5 px-4 py-12 text-center md:px-8 md:py-14">
        <h2 className="m-0 text-26 font-black tracking-landing-title-2xs md:text-32">
          Tú hornea. Las cuentas, déjalas aquí.
        </h2>
        <div className="text-base text-landing-lavender">
          Desde ${fromMxn} al año · incluye el curso Aprende a Costear
        </div>
        <a
          href="#planes"
          className="mt-1.5 inline-flex min-h-14 items-center justify-center rounded-12 bg-white px-8 text-lg font-black text-landing-primary no-underline"
        >
          Ver planes
        </a>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div className="mx-auto flex max-w-280 flex-col gap-2 px-4 pt-5 pb-7 text-13 text-landing-muted md:flex-row md:flex-wrap md:justify-between md:gap-x-7 md:gap-y-4 md:p-8 md:text-sm">
      <span>© Capagla</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 md:gap-5">
        <Link to="/privacidad" className="text-landing-muted">
          Aviso de privacidad
        </Link>
        <Link to="/terminos" className="text-landing-muted">
          Términos y condiciones
        </Link>
        <a href="mailto:contacto@capagla.com" className="text-landing-muted">
          contacto@capagla.com
        </a>
      </div>
    </div>
  )
}

export function ToolLanding({ page }: { page: ToolPage }) {
  // Marketing: ver la página de la herramienta (o la promoción que la vende).
  useEffect(() => {
    track('ViewContent', {
      params: {
        contentName: 'Herramienta de costos',
        contentIds: page.plans.map((p) => p.slug),
        value: page.fromMxn,
        currency: 'MXN',
      },
    })
  }, [page.promoSlug, page.fromMxn, page.plans])

  return (
    <div className="min-h-screen bg-landing-page font-sans text-landing-ink">
      <Header />
      <Hero page={page} />
      <Kitchen />
      <HowItWorks />
      <Daily />
      <Traffic />
      <Plans plans={page.plans} />
      <IncludedCourse href={page.courseHref} />
      <Faq />
      <Closing fromMxn={page.fromMxn} />
      <Footer />
    </div>
  )
}
