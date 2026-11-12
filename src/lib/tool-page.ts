import { createServerFn } from '@tanstack/react-start'

import type { Offer } from '#/lib/offers'
import { longDate } from '#/lib/promotions'
import { loadToolPage } from '#/lib/tool-page-data'

// Página pública de la herramienta (maqueta última, 2026-11-11). Igual que los cursos: la página
// base (`/herramienta-de-costos`, precios normales) y la landing de una promoción cuyo producto
// principal es un nivel de la herramienta (`/<url>`) son la misma página; la promoción solo cambia
// el título, el texto y el precio del nivel que vende (con el normal tachado y su vigencia).

export type ToolPlan = {
  slug: string
  // «Básico» / «Completo» (lo que va después de « · » en el nombre del producto).
  name: string
  rank: number
  itemLimit: number
  priceMxn: number
  // Precio normal tachado (solo con el precio especial de una promoción).
  strikeMxn: number | null
  note: string | null
  href: string
}

export type ToolPage = {
  layout: 'tool'
  title: string
  intro: string
  fromMxn: number
  plans: ToolPlan[]
  // Página del curso incluido (si está publicado).
  courseHref: string | null
  promoSlug?: string
}

const TITLE = '¿Cuánto te queda de verdad por cada postre?'
const INTRO =
  'Tú haces los postres. Aquí salen las cuentas: ingredientes, empaque, tus horas, el gas, la luz y hasta lo que le toca a tu horno.'

const tierName = (name: string) => name.split(' · ')[1] ?? name

export function buildToolPage(
  tiers: {
    slug: string
    name: string
    priceMxn: number
    rank: number
    itemLimit: number
  }[],
  courseHref: string | null,
  offer?: Offer,
): ToolPage {
  const promo = offer?.promotion ?? null
  const until = promo?.endsAt ? longDate(promo.endsAt) : null
  const plans = [...tiers]
    .sort((a, b) => a.rank - b.rank)
    .map((t): ToolPlan => {
      const base = {
        slug: t.slug,
        name: tierName(t.name),
        rank: t.rank,
        itemLimit: t.itemLimit,
      }
      if (offer && promo && offer.main.slug === t.slug) {
        const special =
          offer.applied && offer.main.normalMxn > offer.main.priceMxn
        const query = new URLSearchParams({ promo: promo.slug })
        if (offer.testKey) query.set('prueba', offer.testKey)
        return {
          ...base,
          priceMxn: offer.main.priceMxn,
          strikeMxn: special ? offer.main.normalMxn : null,
          note: special
            ? `Precio especial${until ? ` hasta el ${until}` : ''}.`
            : null,
          href: `/checkout?${query}`,
        }
      }
      return {
        ...base,
        priceMxn: t.priceMxn,
        strikeMxn: null,
        note: null,
        href: `/checkout?producto=${t.slug}`,
      }
    })
  return {
    layout: 'tool',
    title: promo?.introTitle || TITLE,
    intro: promo?.introText || INTRO,
    fromMxn: Math.min(...plans.map((p) => p.priceMxn)),
    plans,
    courseHref,
    promoSlug: promo?.slug,
  }
}

// /herramienta-de-costos: los niveles publicados a su precio normal.
export const getToolPage = createServerFn().handler(() => loadToolPage())
