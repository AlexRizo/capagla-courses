import { Switch } from '#/components/admin/switch'

// Interruptor "gratis (visible sin comprar)" de bloques y capítulos.
export function FreeToggle({
  on,
  onChange,
  title,
  description,
}: {
  on: boolean
  onChange: (on: boolean) => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground"
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs leading-140 text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch on={on} />
    </button>
  )
}
