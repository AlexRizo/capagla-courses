import { useState } from 'react'
import type { ReactNode } from 'react'

// Sección oscura «Herramienta de costos» de la Home (maqueta última, 2026-11-11): texto con
// viñetas, «Conocer la herramienta», el precio más bajo de sus niveles y un carrusel de 4
// tarjetas de ejemplo (se cambia con las flechas o los puntos; no avanza solo).

const PAGE = '/herramienta-de-costos'

const POINTS = [
  'Lo que te cuesta cada postre, con tus horas, gas, luz y horno',
  'Precio sugerido y semáforo para saber si ganas',
  'Premezclas, lista de compra y cotizador',
  'Incluye el curso Aprende a Costear',
]

const card = 'rounded-16 bg-white shadow-landing-slide'
const chip =
  'rounded-full bg-white px-3 py-1.5 text-13 font-bold text-landing-primary'

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l4 4 10-10" />
    </svg>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-15">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Legend({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className={`size-2.75 rounded-sm ${color}`} />
        {label}
      </span>
      <b>{value}</b>
    </>
  )
}

function Item({
  label,
  qty,
  done,
}: {
  label: string
  qty: string
  done?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2.5 text-15 ${done ? 'text-landing-done line-through' : ''}`}
    >
      <span
        className={`size-5 flex-none rounded-md ${done ? 'bg-landing-primary' : 'border-1.5 border-landing-field'}`}
      />
      <span className="flex-1">{label}</span>
      <span>{qty}</span>
    </div>
  )
}

const SLIDES: { caption: string; body: ReactNode }[] = [
  {
    caption: 'El semáforo te dice si ganas',
    body: (
      <div className="flex w-full max-w-85 flex-col gap-3">
        <div className={`${card} flex justify-between px-4.5 py-4 text-base`}>
          <span>Lo vendes a</span>
          <b>$600</b>
        </div>
        <div className={`${card} flex flex-col gap-2.5 p-4.5`}>
          <span className="text-sm text-landing-strike">Te queda</span>
          <span className="text-48 font-extrabold tracking-landing-title-3xl">
            $380
          </span>
          <span className="self-start rounded-full bg-landing-good-bg px-3.5 py-1.5 text-15 font-bold text-landing-good">
            ×2.7 Buen precio
          </span>
        </div>
      </div>
    ),
  },
  {
    caption: 'Tu betún se captura una vez',
    body: (
      <div className="flex w-full max-w-85 flex-col gap-3">
        <div className={`${card} flex flex-col gap-3 p-4.5`}>
          <div className="flex items-center justify-between gap-2">
            <b className="text-17">Betún de mantequilla</b>
            <span className="rounded-full bg-landing-tint px-2.5 py-1 text-xs font-bold text-landing-primary">
              Premezcla
            </span>
          </div>
          <Row label="Mantequilla 250 g" value="$45" />
          <Row label="Azúcar glass 500 g" value="$22" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['Cupcakes', 'Lunch box cake', 'Pastel', 'Galletas'].map((t) => (
            <span key={t} className={chip}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    caption: 'Lo que de verdad te cuesta',
    body: (
      <div className={`${card} flex w-full max-w-85 flex-col gap-3.5 p-5`}>
        <div className="flex items-baseline justify-between">
          <span className="text-15 text-landing-strike">Cupcakes · 12</span>
          <span className="text-40 font-extrabold tracking-landing-title-2xl">
            $220
          </span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-full">
          <span className="flex-96 bg-landing-primary" />
          <span className="flex-14 bg-landing-accent" />
          <span className="flex-80 bg-landing-pink-line" />
          <span className="flex-30 bg-landing-bar" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-2 text-15">
          <Legend color="bg-landing-primary" label="Ingredientes" value="$96" />
          <Legend color="bg-landing-accent" label="Empaque" value="$14" />
          <Legend color="bg-landing-pink-line" label="Tu tiempo" value="$80" />
          <Legend color="bg-landing-bar" label="Gastos fijos" value="$30" />
        </div>
      </div>
    ),
  },
  {
    caption: 'Tu lista para el súper',
    body: (
      <div className="flex w-full max-w-75 flex-col gap-3 rounded-22 bg-white p-4.5 shadow-landing-slide">
        <div className="flex items-center justify-between">
          <b className="text-base">Súper del sábado</b>
          <span className="text-xs text-landing-strike">2 de 4</span>
        </div>
        <Item label="Mantequilla" qty="2 kg" done />
        <Item label="Azúcar glass" qty="1 kg" done />
        <Item label="Chocolate semiamargo" qty="1 kg" />
        <Item label="Cajas para 6" qty="10 pzas" />
      </div>
    ),
  },
]

function Arrow({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Foto anterior' : 'Foto siguiente'}
      onClick={onClick}
      className={`absolute top-1/2 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white shadow-landing-arrow ${side === 'left' ? 'left-3' : 'right-3'}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-landing-primary"
      >
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}

function Carousel({ square }: { square?: boolean }) {
  const [at, setAt] = useState(0)
  const go = (i: number) => setAt((i + SLIDES.length) % SLIDES.length)
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="relative">
        <div className="overflow-hidden rounded-22">
          <div
            className="flex transition-transform duration-450"
            style={{ transform: `translateX(-${at * 100}%)` }}
          >
            {SLIDES.map((s, i) => (
              <div
                key={s.caption}
                role="group"
                aria-roledescription="foto"
                aria-label={`${i + 1} de ${SLIDES.length}: ${s.caption}`}
                aria-hidden={i !== at}
                className="box-border min-w-0 w-full flex-none px-0.5"
              >
                <div
                  className={`box-border flex items-center justify-center rounded-22 bg-linear-160 from-landing-stripe to-landing-slide-end font-system text-landing-slide-ink ${square ? 'aspect-square p-4.5' : 'aspect-4/3 p-7'}`}
                >
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Arrow side="left" onClick={() => go(at - 1)} />
        <Arrow side="right" onClick={() => go(at + 1)} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-bold text-landing-haze">
          {SLIDES[at].caption}
        </span>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.caption}
              type="button"
              aria-label={`Ver foto ${i + 1}`}
              onClick={() => setAt(i)}
              className={`h-2 cursor-pointer rounded-full border-0 p-0 transition-[width] duration-300 ${i === at ? 'w-6 bg-landing-neon' : 'w-2 bg-white/35'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Points({ mobile }: { mobile?: boolean }) {
  return (
    <ul
      className={`m-0 flex list-none flex-col p-0 ${mobile ? 'gap-2' : 'gap-2.5'}`}
    >
      {POINTS.map((p) => (
        <li
          key={p}
          className={`flex items-start text-landing-haze ${mobile ? 'gap-2 text-sm leading-140' : 'gap-2.5 text-base leading-145'}`}
        >
          <span
            className={`flex-none text-landing-neon ${mobile ? 'mt-px' : 'mt-0.5'}`}
          >
            <Check />
          </span>
          {p}
        </li>
      ))}
    </ul>
  )
}

const badge =
  'self-start rounded-full bg-landing-neon font-black tracking-landing-caps-lg text-landing-ink'

export function HomeTool({ fromMxn }: { fromMxn: number }) {
  return (
    <>
      <div
        id="herramienta"
        className="hidden bg-landing-ink bg-radial-[at_90%_10%] from-landing-plum to-transparent to-55% text-white md:block"
      >
        <div className="mx-auto flex max-w-280 flex-wrap items-center gap-12 px-8 py-18">
          <div className="flex min-w-0 flex-1 basis-100 flex-col gap-4.5">
            <div className={`${badge} px-3 py-1.25 text-13`}>
              HERRAMIENTA EN LÍNEA
            </div>
            <h2 className="m-0 text-44 leading-106 font-black tracking-landing-title-6xl">
              Herramienta de costos
            </h2>
            <p className="m-0 text-lg leading-155 text-landing-lilac">
              Tú haces los postres; aquí salen las cuentas. Sabes cuánto te
              queda de cada uno antes de venderlo.
            </p>
            <Points />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href={PAGE}
                className="inline-flex min-h-14 items-center justify-center rounded-12 bg-white px-7.5 text-lg font-black text-landing-primary no-underline"
              >
                Conocer la herramienta
              </a>
              <span className="flex flex-col">
                <span className="text-26 font-black">Desde ${fromMxn}</span>
                <span className="text-sm text-landing-lilac">al año</span>
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 basis-120">
            <Carousel />
          </div>
        </div>
      </div>

      <div className="mb-7 flex flex-col gap-3.5 bg-landing-ink bg-radial-[at_90%_0%] from-landing-plum to-transparent to-60% px-4 py-8 text-white md:hidden">
        <div className={`${badge} px-2.5 py-1 text-11`}>
          HERRAMIENTA EN LÍNEA
        </div>
        <h2 className="m-0 text-30 leading-108 font-black tracking-landing-title-md">
          Herramienta de costos
        </h2>
        <p className="m-0 text-15 leading-150 text-landing-lilac">
          Tú haces los postres; aquí salen las cuentas.
        </p>
        <Carousel square />
        <Points mobile />
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black">Desde ${fromMxn}</span>
          <span className="text-13 text-landing-lilac">al año</span>
        </div>
        <a
          href={PAGE}
          className="flex min-h-12.5 items-center justify-center rounded-12 bg-white text-base font-black text-landing-primary no-underline"
        >
          Conocer la herramienta
        </a>
      </div>
    </>
  )
}
