import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  field,
  input,
  label,
  note,
  primaryButton,
} from '#/components/admin/form-styles'
import { BunnyVideoField } from '#/components/admin/bunny-video-field'
import type { OriginRow } from '#/lib/attribution'
import { setPromotionPaused, updatePromotion } from '#/lib/admin-promotions'
import { MAX_PROMOTION_PRODUCTS } from '#/lib/promotions'
import { cn } from '#/lib/utils'

type CatalogProduct = {
  id: string
  name: string
  isCourse: boolean
  hasPage: boolean
  normalPriceMxn: number
}

type Promotion = {
  id: string
  name: string
  slug: string
  status: string
  paused: boolean
  startsAt: string
  endsAt: string
  introTitle: string
  introText: string
  introVideoId: string | null
  visits: number
  carts: number
  purchases: number
  revenueMxn: number
  origins: OriginRow[]
  baseUrl: string
  testKey: string
  slots: { productId: string; price: string }[]
  catalog: CatalogProduct[]
}

const card =
  'flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-xs'
const cardTitle = 'text-xs font-medium text-muted-foreground'
const secondaryButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium disabled:cursor-default disabled:opacity-60'

// Enlaces con etiquetas UTM por canal; cada compra se atribuye al anuncio correcto.
function channelLinks(base: string, slug: string) {
  const url = `${base}/${slug}`
  return [
    {
      channel: 'Meta Ads',
      url: `${url}?utm_source=meta&utm_medium=paid&utm_campaign=${slug}&utm_content=[creativo]`,
    },
    {
      channel: 'TikTok Ads',
      url: `${url}?utm_source=tiktok&utm_medium=paid&utm_campaign=${slug}&utm_content=[creativo]`,
    },
    {
      channel: 'Correo (Brevo)',
      url: `${url}?utm_source=brevo&utm_medium=email&utm_campaign=${slug}`,
    },
    {
      channel: 'Instagram orgánico',
      url: `${url}?utm_source=instagram&utm_medium=social&utm_campaign=${slug}`,
    },
  ]
}

export function PromotionEditor({ promotion }: { promotion: Promotion }) {
  const router = useRouter()
  const [slots, setSlots] = useState(promotion.slots)
  const [introVideoId, setIntroVideoId] = useState(promotion.introVideoId)
  const [open, setOpen] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const testUrl = `${promotion.baseUrl}/${promotion.slug}?prueba=${promotion.testKey}`
  const byId = new Map(promotion.catalog.map((p) => [p.id, p]))

  // El menú de productos se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (open < 0) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-product-menu]')) setOpen(-1)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(-1)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Productos que se pueden elegir en un lugar: cualquiera, sin repetir los de otros lugares.
  // Un lugar puede estar sin elegir (`productId` vacío) mientras se agrega un adicional.
  function options(index: number) {
    const others = new Set(
      slots.filter((_, i) => i !== index).map((s) => s.productId),
    )
    return promotion.catalog.filter((p) => !others.has(p.id))
  }
  const unused = promotion.catalog.filter(
    (p) => !slots.some((s) => s.productId === p.id),
  )

  function setSlot(index: number, patch: Partial<(typeof slots)[number]>) {
    setOpen(-1)
    setSlots(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (slots.some((s) => !s.productId)) {
      return setMessage('Elige un producto en cada lugar o quita el adicional.')
    }
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setMessage(null)
    try {
      const result = await updatePromotion({
        data: {
          id: promotion.id,
          name: String(form.get('name')),
          slug: String(form.get('slug')),
          startsAt: String(form.get('startsAt')),
          endsAt: String(form.get('endsAt')),
          introTitle: String(form.get('introTitle')),
          introText: String(form.get('introText')),
          introVideoId: introVideoId ?? '',
          products: slots.map((s) => ({
            productId: s.productId,
            priceMxn: Number(s.price),
          })),
        },
      })
      if (result.error) return setMessage(result.error)
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar. Revisa los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePause() {
    await setPromotionPaused({
      data: { id: promotion.id, paused: !promotion.paused },
    })
    await router.invalidate()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Sin permiso del portapapeles: el enlace sigue visible para copiarlo a mano.
    }
  }

  return (
    <>
      <div className="px-6 pt-6">
        <Link
          to="/admin/promociones"
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-13 font-medium"
        >
          ‹ Todas las promociones
        </Link>
      </div>
      <form onSubmit={save} className="flex max-w-240 flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
            {promotion.name}
          </h1>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
            {promotion.status}
          </span>
        </div>

        <div className={card}>
          <div className={cardTitle}>DATOS</div>
          <div className="flex flex-wrap gap-3">
            <div className={cn(field, 'flex-1 basis-60')}>
              <label htmlFor="name" className={label}>
                Nombre interno
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={promotion.name}
                className={input}
              />
            </div>
            <div className={cn(field, 'flex-1 basis-60')}>
              <label htmlFor="slug" className={label}>
                URL
              </label>
              <input
                id="slug"
                name="slug"
                required
                defaultValue={`/${promotion.slug}`}
                className={input}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className={cn(field, 'flex-1 basis-60')}>
              <label htmlFor="startsAt" className={label}>
                Los precios especiales empiezan
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={promotion.startsAt}
                className={input}
              />
            </div>
            <div className={cn(field, 'flex-1 basis-60')}>
              <label htmlFor="endsAt" className={label}>
                Los precios especiales terminan
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={promotion.endsAt}
                className={input}
              />
            </div>
          </div>
          <div className={note}>
            La URL siempre existe, así el anuncio se puede aprobar antes de
            salir. Como un cupón, los precios especiales solo se aplican si la
            alumna agrega al carrito dentro de las fechas; fuera de ellas ve los
            precios normales. Si ya tenía el carrito abierto cuando terminó, se
            le respeta el precio hasta 1 hora después. Zona America/Mexico_City.
          </div>
        </div>

        <div className={card}>
          <div className={cardTitle}>INTRO DE LA LANDING</div>
          <div className={field}>
            <label htmlFor="introTitle" className={label}>
              Título
            </label>
            <input
              id="introTitle"
              name="introTitle"
              defaultValue={promotion.introTitle}
              placeholder="Título que amplía lo que dice el anuncio"
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="introText" className={label}>
              Texto descriptivo
            </label>
            <textarea
              id="introText"
              name="introText"
              defaultValue={promotion.introText}
              placeholder="Un poco de cada cosa que incluye la oferta"
              className="box-border min-h-18 resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm"
            />
          </div>
          <BunnyVideoField
            label="Video de intro"
            value={introVideoId}
            onChange={setIntroVideoId}
          />
        </div>

        <div className={card}>
          <div className={cardTitle}>
            PRODUCTOS · 1 principal y hasta 2 adicionales
          </div>
          <div className={note}>
            El principal pone el cuerpo de la landing. Los adicionales aparecen
            abajo con su precio normal tachado y el precio especial. Al
            agregarlos al carrito ya llevan ese precio, como un cupón aplicado.
            Pon 0 para regalarlo.
          </div>
          {slots.map((slot, i) => {
            const product = byId.get(slot.productId)
            return (
              <div
                key={i}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
              >
                <div
                  data-product-menu
                  className="relative flex flex-3 basis-65 flex-col gap-1.5"
                >
                  <span className={label}>
                    {i === 0 ? 'Producto principal' : `Adicional ${i}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? -1 : i)}
                    className="flex h-9 cursor-pointer items-center justify-between rounded-md border border-border bg-card px-3 text-left text-sm text-foreground"
                  >
                    {product ? (
                      <span>
                        {product.name}{' '}
                        <span className="text-muted-foreground">
                          · {product.isCourse ? 'Curso' : 'Herramienta'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Elige un producto
                      </span>
                    )}
                    <span className="text-muted-foreground">▾</span>
                  </button>
                  {open === i && (
                    <div className="absolute inset-x-0 top-16 z-10 flex flex-col rounded-lg border border-border bg-card p-1.5 shadow-lg">
                      {options(i).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSlot(i, { productId: p.id })}
                          className={cn(
                            'flex cursor-pointer justify-between rounded-md border-none px-2.5 py-2 text-left text-sm text-foreground',
                            p.id === slot.productId
                              ? 'bg-accent'
                              : 'bg-transparent',
                          )}
                        >
                          <span className="font-medium">
                            {p.id === slot.productId && '✓ '}
                            {p.name}
                          </span>
                          <span className="text-muted-foreground">
                            {p.isCourse ? 'Curso' : 'Herramienta'}
                          </span>
                        </button>
                      ))}
                      {options(i).length === 0 && (
                        <div className="px-2.5 py-2 text-13 text-muted-foreground">
                          No hay productos disponibles.
                        </div>
                      )}
                      {product && options(i).length === 1 && (
                        <div className="px-2.5 py-2 text-13 text-muted-foreground">
                          Los demás productos ya están en esta promoción.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={cn(field, 'flex-1 basis-27.5')}>
                  <span className={label}>Precio normal</span>
                  <div
                    className={cn(
                      'flex h-9 items-center text-muted-foreground',
                      product && 'line-through',
                    )}
                  >
                    {product ? `$${product.normalPriceMxn}` : '—'}
                  </div>
                </div>
                <div className={cn(field, 'flex-1 basis-32.5')}>
                  <label htmlFor={`price-${i}`} className={label}>
                    Precio especial (MXN)
                  </label>
                  <input
                    id={`price-${i}`}
                    inputMode="numeric"
                    required
                    value={slot.price}
                    onChange={(e) => setSlot(i, { price: e.target.value })}
                    className={input}
                  />
                </div>
                {i > 0 && (
                  <div className="flex h-9 flex-none items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(-1)
                        setSlots(slots.filter((_, j) => j !== i))
                      }}
                      className="cursor-pointer border-none bg-transparent text-13 font-medium text-chart-3 underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
                {i === 0 && product && !product.hasPage && (
                  <div className={cn(note, 'basis-full')}>
                    Este producto todavía no tiene página de venta, así que la
                    landing de esta promoción no se podrá ver. Elige uno que sí
                    la tenga.
                  </div>
                )}
              </div>
            )
          })}
          {slots.length < MAX_PROMOTION_PRODUCTS &&
            unused.length > 0 &&
            slots.every((s) => s.productId) && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSlots([...slots, { productId: '', price: '' }])
                    setOpen(slots.length)
                  }}
                  className={secondaryButton}
                >
                  + Agregar adicional
                </button>
              </div>
            )}
        </div>

        <div className={card}>
          <div className={cardTitle}>ENLACES Y RESULTADOS</div>
          <div className="flex flex-wrap gap-3">
            {[
              ['Visitas', String(promotion.visits)],
              ['Agregaron al carrito', String(promotion.carts)],
              ['Compras', String(promotion.purchases)],
              ['Ingresos', `$${promotion.revenueMxn}`],
            ].map(([metric, value]) => (
              <div
                key={metric}
                className="flex-1 basis-30 rounded-lg border border-border p-3"
              >
                <div className="text-xs text-muted-foreground">{metric}</div>
                <div className="text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
          <div className="text-13 leading-normal text-chart-3">
            Se generan solos con la URL. Cada canal lleva sus etiquetas para que
            cada compra se atribuya al anuncio correcto. Pixeles y eventos se
            configuran en Marketing.
          </div>
          {/* Compras por anuncio (no está en la maqueta; el texto de Marketing dice que la
              campaña y el creativo "se muestran en Promociones"). Solo si hay compras. */}
          {promotion.origins.length > 0 && (
            <div className="flex flex-col">
              <div className={cardTitle}>COMPRAS POR ORIGEN</div>
              <div className="mt-2 flex gap-3 border-t border-accent py-2 text-xs text-muted-foreground">
                <div className="flex-3">Origen</div>
                <div className="flex-2">Campaña</div>
                <div className="flex-2">Creativo</div>
                <div className="w-16 flex-none text-right">Compras</div>
                <div className="w-20 flex-none text-right">Ingresos</div>
              </div>
              {promotion.origins.map((o) => {
                const untagged =
                  !o.source && !o.medium && !o.campaign && !o.creative
                return (
                  <div
                    key={`${o.source}|${o.medium}|${o.campaign}|${o.creative}`}
                    className="flex gap-3 border-t border-accent py-2 text-13"
                  >
                    <div className="min-w-0 flex-3 font-medium break-words">
                      {untagged
                        ? 'Sin etiquetas (enlace directo)'
                        : [o.source, o.medium].filter(Boolean).join(' · ')}
                    </div>
                    <div className="min-w-0 flex-2 break-words text-chart-3">
                      {o.campaign || '—'}
                    </div>
                    <div className="min-w-0 flex-2 break-words text-chart-3">
                      {o.creative || '—'}
                    </div>
                    <div className="w-16 flex-none text-right">
                      {o.purchases}
                    </div>
                    <div className="w-20 flex-none text-right">
                      ${o.revenueMxn}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {channelLinks(promotion.baseUrl, promotion.slug).map((l) => (
            <div
              key={l.channel}
              className="flex flex-wrap items-center gap-2.5 border-t border-accent py-2.5"
            >
              <div className="w-35 flex-none font-medium">{l.channel}</div>
              <div className="min-w-0 flex-1 basis-75 font-mono text-xs break-all text-chart-3">
                {l.url}
              </div>
              <button
                type="button"
                onClick={() => copy(l.url)}
                className="flex-none cursor-pointer rounded-md border border-border bg-card px-2.5 py-1 text-13 font-medium text-foreground"
              >
                {copied === l.url ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2.5 border-t border-accent py-2.5">
            <div className="w-35 flex-none font-medium">Enlace de prueba</div>
            <div className="min-w-0 flex-1 basis-75 font-mono text-xs break-all text-chart-3">
              {`${testUrl}  · aplica los precios sin importar la fecha; solo con sesión de admin`}
            </div>
            <button
              type="button"
              onClick={() => copy(testUrl)}
              className="flex-none cursor-pointer rounded-md border border-border bg-card px-2.5 py-1 text-13 font-medium text-foreground"
            >
              {copied === testUrl ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="submit" disabled={saving} className={primaryButton}>
            Guardar
          </button>
          <a
            href={`/${promotion.slug}`}
            target="_blank"
            rel="noreferrer"
            className={secondaryButton}
          >
            Ver landing
          </a>
          <button
            type="button"
            onClick={togglePause}
            className={secondaryButton}
          >
            {promotion.paused ? 'Reanudar promoción' : 'Pausar promoción'}
          </button>
          {message && (
            <span className="text-13 text-muted-foreground">{message}</span>
          )}
        </div>
      </form>
    </>
  )
}
