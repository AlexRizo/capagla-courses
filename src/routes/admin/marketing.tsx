import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  input,
  label,
  primaryButton,
} from '#/components/admin/form-styles'
import { ProGate } from '#/components/admin/pro-gate'
import {
  getMarketingSettings,
  saveMarketingSettings,
} from '#/lib/admin-marketing'
import type { MarketingFields } from '#/lib/admin-marketing'

export const Route = createFileRoute('/admin/marketing')({
  loader: () => getMarketingSettings(),
  component: Marketing,
})

const card =
  'flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-xs'
const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'
const columns = 'flex items-center gap-3 px-5'
const code = 'font-mono text-13 text-chart-3'

type Platform = {
  title: string
  // Campos de la tarjeta; el primero y el segundo son los que dan por conectada la plataforma.
  fields: {
    name: keyof MarketingFields
    label: string
    placeholder: string
    secret?: boolean
  }[]
  required: (keyof MarketingFields)[]
}

const platforms: Platform[] = [
  {
    title: 'Meta (Facebook e Instagram)',
    fields: [
      {
        name: 'metaPixelId',
        label: 'ID del píxel',
        placeholder: '[ID del píxel]',
      },
      {
        name: 'metaToken',
        label: 'Token de la API de conversiones',
        placeholder: '[token]',
        secret: true,
      },
      {
        name: 'metaTestCode',
        label: 'Código de prueba de eventos',
        placeholder: '[TEST…]',
      },
    ],
    required: ['metaPixelId', 'metaToken'],
  },
  {
    title: 'TikTok',
    fields: [
      {
        name: 'tiktokPixelId',
        label: 'ID del píxel',
        placeholder: '[ID del píxel]',
      },
      {
        name: 'tiktokToken',
        label: 'Token de la API de eventos',
        placeholder: '[token]',
        secret: true,
      },
      {
        name: 'tiktokTestCode',
        label: 'Código de prueba de eventos',
        placeholder: '[TEST…]',
      },
    ],
    required: ['tiktokPixelId', 'tiktokToken'],
  },
  {
    title: 'Google Analytics 4',
    fields: [
      {
        name: 'ga4MeasurementId',
        label: 'ID de medición',
        placeholder: '[G-XXXXXXX]',
      },
    ],
    required: ['ga4MeasurementId'],
  },
]

const events = [
  ['Visita a la landing o al sitio', 'PageView', 'PageView', 'Navegador'],
  ['Ve el curso o la promoción', 'ViewContent', 'ViewContent', 'Navegador'],
  [
    'Se registra en la clase gratis',
    'Lead',
    'SubmitForm',
    'Navegador y servidor',
  ],
  ['Agrega al carrito', 'AddToCart', 'AddToCart', 'Navegador y servidor'],
  [
    'Inicia el pago',
    'InitiateCheckout',
    'InitiateCheckout',
    'Navegador y servidor',
  ],
  [
    'Compra confirmada',
    'Purchase',
    'CompletePayment',
    'Servidor (Stripe) y página de gracias',
  ],
]

function Marketing() {
  const saved = Route.useLoaderData()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = Object.fromEntries(
      Object.keys(saved).map((name) => [name, String(form.get(name) ?? '')]),
    ) as MarketingFields
    setSaving(true)
    setMessage(null)
    try {
      await saveMarketingSettings({ data })
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar. Revisa los datos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProGate>
      <div className="flex max-w-240 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
              Marketing
            </h1>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Modo pro
            </span>
          </div>
          <div className="leading-normal text-muted-foreground">
            Aquí se conectan los píxeles y se ve qué eventos se envían a cada
            plataforma. Se configura una sola vez; las promociones solo agregan
            sus etiquetas de seguimiento.
          </div>
        </div>

        <form onSubmit={save} className="flex flex-col gap-6">
          {platforms.map((platform) => (
            <div key={platform.title} className={card}>
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{platform.title}</div>
                <span className={pill}>
                  {platform.required.every((name) => saved[name])
                    ? 'Datos guardados'
                    : 'Sin conectar'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {platform.fields.map((f) => (
                  <div key={f.name} className="flex-[1_1_220px]">
                    <div className={field}>
                      <label htmlFor={f.name} className={label}>
                        {f.label}
                      </label>
                      <input
                        id={f.name}
                        name={f.name}
                        type={f.secret ? 'password' : 'text'}
                        autoComplete="off"
                        maxLength={500}
                        defaultValue={saved[f.name]}
                        placeholder={f.placeholder}
                        className={input}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className={primaryButton}>
              Guardar
            </button>
            {message && (
              <span className="text-13 text-muted-foreground">{message}</span>
            )}
          </div>
        </form>

        <div className="rounded-lg border border-border bg-card shadow-xs">
          <div className="px-5 pt-5 pb-3">
            <div className="text-base font-semibold">Eventos que se envían</div>
            <div className="mt-0.5 leading-normal text-muted-foreground">
              Cada evento sale del navegador con un identificador y, cuando se
              puede, también del servidor con el mismo identificador, para que
              la plataforma no lo cuente dos veces. La compra siempre se
              confirma desde el servidor con el aviso de Stripe.
            </div>
          </div>
          <div
            className={`${columns} border-t border-border bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
          >
            <div className="flex-3">Cuando la persona…</div>
            <div className="flex-2">Meta</div>
            <div className="flex-2">TikTok</div>
            <div className="flex-3">Se envía desde</div>
          </div>
          {events.map(([when, meta, tiktok, from]) => (
            <div
              key={when}
              className={`${columns} border-t border-border py-3`}
            >
              <div className="flex-3 font-medium">{when}</div>
              <div className={`flex-2 ${code}`}>{meta}</div>
              <div className={`flex-2 ${code}`}>{tiktok}</div>
              <div className="flex-3 text-chart-3">{from}</div>
            </div>
          ))}
        </div>

        <div className={card}>
          <div className="text-base font-semibold">Atribución</div>
          <div className="leading-relaxed text-chart-3">
            • Al entrar con etiquetas (utm_source, utm_medium, utm_campaign,
            utm_content), el clic de Meta (fbclid) o el de TikTok (ttclid), se
            guardan en la visita y viajan hasta la compra.
            <br />• La compra guarda en Stripe la promoción, la campaña y el
            creativo que la originó, y se muestra en Promociones.
            <br />• Los eventos del servidor llevan el correo y el teléfono de
            la alumna cifrados, para que las plataformas relacionen la compra
            con el anuncio aunque el navegador bloquee cookies.
            <br />• Si el registro de la clase gratis llega por un anuncio, el
            lead guarda esa misma atribución.
          </div>
          <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-13 leading-normal text-chart-3">
            Aviso de cookies: los píxeles del navegador se cargan solo si la
            persona los acepta. Los eventos del servidor se envían con lo que la
            persona aceptó al comprar.
          </div>
        </div>
      </div>
    </ProGate>
  )
}
