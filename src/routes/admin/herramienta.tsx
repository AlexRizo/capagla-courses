import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  input,
  label,
  note,
  primaryButton,
} from '#/components/admin/form-styles'
import { BunnyVideoField } from '#/components/admin/bunny-video-field'
import { ProGate } from '#/components/admin/pro-gate'
import { getAdminTool, saveToolPageVideo, saveToolTier } from '#/lib/admin-tool'
import { TOOL_RENEWAL_DISCOUNT_PCT } from '#/lib/catalog'
import { getAdminToolHelp, saveToolHelpVideo } from '#/lib/tool-help-server'
import type { HelpKey } from '#/lib/tool-help'
import { MODULE_LABEL, TOOL_MODULES } from '#/lib/tool-tiers'
import type { ToolModuleKey } from '#/lib/tool-tiers'

export const Route = createFileRoute('/admin/herramienta')({
  loader: async () => ({
    ...(await getAdminTool()),
    help: await getAdminToolHelp(),
  }),
  component: Herramienta,
})

const card =
  'flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs'

type Tier = Awaited<ReturnType<typeof getAdminTool>>['tiers'][number]

function TierCard({ tier }: { tier: Tier }) {
  const router = useRouter()
  const [modules, setModules] = useState<ToolModuleKey[]>(tier.modules)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const num = (name: string) => Number(String(form.get(name) ?? '').trim())
    const compare = String(form.get('compareAtMxn') ?? '').trim()
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveToolTier({
        data: {
          productId: tier.productId,
          priceMxn: num('priceMxn'),
          compareAtMxn: compare === '' ? null : Number(compare),
          itemLimit: num('itemLimit'),
          quoteDays: num('quoteDays'),
          modules,
        },
      })
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar. Revisa los números.')
    } finally {
      setSaving(false)
    }
  }

  const number = (
    name: string,
    text: string,
    value: number | null,
    suffix?: string,
  ) => (
    <div className={`${field} flex-[1_1_160px]`}>
      <label htmlFor={`${tier.productId}-${name}`} className={label}>
        {text}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${tier.productId}-${name}`}
          name={name}
          inputMode="numeric"
          defaultValue={value ?? ''}
          className={input}
        />
        {suffix && (
          <span className="text-13 text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )

  return (
    <form onSubmit={save} className={card}>
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{tier.name}</div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4">
          {tier.status === 'PUBLISHED' ? 'A la venta' : 'Borrador'}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {number('priceMxn', 'Precio al año (con IVA)', tier.priceMxn, 'MXN')}
        {number(
          'compareAtMxn',
          'Precio de lista (tachado)',
          tier.compareAtMxn,
          'MXN',
        )}
        {number('itemLimit', 'Límite de elementos', tier.itemLimit)}
        {number(
          'quoteDays',
          'Duración de cotizaciones',
          tier.quoteDays,
          'días',
        )}
      </div>
      <div className={field}>
        <div className={label}>Además de costos y precios, abre</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TOOL_MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2 text-13">
              <input
                type="checkbox"
                checked={modules.includes(m)}
                onChange={(e) =>
                  setModules((list) =>
                    e.target.checked
                      ? [...list, m]
                      : list.filter((x) => x !== m),
                  )
                }
              />
              {MODULE_LABEL[m]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={primaryButton}>
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
      </div>
    </form>
  )
}

// Video de /herramienta-de-costos (H15): lo abre el recuadro del inicio; sin video no se muestra.
function PageVideo({ videoId }: { videoId: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(videoId)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveToolPageVideo({ data: { videoId: value ?? '' } })
      if (result.error) return setMessage(result.error)
      await router.invalidate()
      setMessage('Guardado')
    } catch {
      setMessage('No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={card}>
      <div className="text-base font-semibold">Página de la herramienta</div>
      <BunnyVideoField
        label="Video de la página (/herramienta-de-costos)"
        value={value}
        onChange={setValue}
      />
      <div className={note}>
        Sale en el recuadro del inicio de la página. Sin video, el recuadro no
        se muestra. Una promoción de la herramienta con su propio video usa el
        suyo.
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className={primaryButton}
        >
          Guardar
        </button>
        {message && (
          <span className="text-13 text-muted-foreground">{message}</span>
        )}
      </div>
    </div>
  )
}

// Videos de ayuda de la herramienta (tema 11): uno por sección. Se guarda al elegirlo; mientras
// una sección no tenga video, su «?» no aparece. A00 es la bienvenida (se abre sola la 1.ª vez).
function HelpVideoRow({
  helpKey,
  title,
  videoId,
}: {
  helpKey: HelpKey
  title: string
  videoId: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(videoId)
  const [message, setMessage] = useState<string | null>(null)

  async function change(next: string | null) {
    setValue(next)
    setMessage(null)
    try {
      const result = await saveToolHelpVideo({
        data: { key: helpKey, videoId: next ?? '' },
      })
      if (result.error) {
        setValue(videoId)
        return setMessage(result.error)
      }
      await router.invalidate()
      setMessage(next ? 'Guardado' : 'Quitado')
    } catch {
      setValue(videoId)
      setMessage('No se pudo guardar.')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <BunnyVideoField
        label={`${helpKey} · ${title}`}
        value={value}
        onChange={(next) => void change(next)}
      />
      {message && (
        <span className="text-13 text-muted-foreground">{message}</span>
      )}
    </div>
  )
}

function HelpVideos({
  help,
}: {
  help: Awaited<ReturnType<typeof getAdminToolHelp>>
}) {
  return (
    <div className={card}>
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold">Videos de ayuda</div>
        <div className={note}>
          Uno por sección: la alumna lo abre con el «?» junto al título. Se
          guarda al elegirlo. Mientras una sección no tenga video, su «?» no
          aparece. A00 es la bienvenida: se abre sola la primera vez que entra a
          la herramienta. A08 a A11 solo los ve el nivel Completo.
        </div>
      </div>
      {help.map((h) => (
        <HelpVideoRow
          key={h.key}
          helpKey={h.key}
          title={h.title}
          videoId={h.videoId}
        />
      ))}
    </div>
  )
}

function Herramienta() {
  const { tiers, usage, pageVideoId, help } = Route.useLoaderData()
  return (
    <ProGate>
      <div className="flex max-w-240 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
              Herramienta de costos
            </h1>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Modo pro
            </span>
          </div>
          <div className="leading-normal text-muted-foreground">
            Los niveles en que se vende la herramienta: cuánto cuesta cada uno,
            cuántos elementos se pueden guardar y qué módulos abre. Un elemento
            es un ingrediente, una premezcla, una receta, un producto o una
            cotización; las producciones y las listas de compra no cuentan. Los
            cambios aplican de inmediato a quien ya lo tiene.
          </div>
        </div>

        {tiers.map((t) => (
          <TierCard key={t.productId} tier={t} />
        ))}

        <div className={note}>
          Los precios incluyen IVA y la renovación tiene{' '}
          {TOOL_RENEWAL_DISCOUNT_PCT}% de descuento. El precio de lista solo se
          muestra tachado; se cobra el precio.
        </div>

        <PageVideo videoId={pageVideoId} />

        <HelpVideos help={help} />

        <div className="rounded-lg border border-border bg-card shadow-xs">
          <div className="px-5 pt-5 pb-3">
            <div className="text-base font-semibold">Uso por alumna</div>
            <div className="mt-0.5 leading-normal text-muted-foreground">
              Alumnas con la herramienta vigente y cuántos elementos llevan
              guardados.
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-border bg-muted px-5 py-2.5 text-xs font-medium text-muted-foreground">
            <div className="flex-3">Alumna</div>
            <div className="flex-2">Nivel</div>
            <div className="flex-2 text-right">Elementos</div>
            <div className="flex-2 text-right">Vence</div>
          </div>
          {usage.length === 0 && (
            <div className="border-t border-border px-5 py-4 text-muted-foreground">
              Aún nadie tiene la herramienta.
            </div>
          )}
          {usage.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 border-t border-border px-5 py-3"
            >
              <div className="flex-3">
                <div className="font-medium">{u.name}</div>
                <div className="text-13 text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex-2">{u.tier}</div>
              <div className="flex-2 text-right tabular-nums">
                {u.used} de {u.itemLimit}
              </div>
              <div className="flex-2 text-right tabular-nums">
                {new Date(u.expiresAt).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProGate>
  )
}
