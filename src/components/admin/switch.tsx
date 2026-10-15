import { cn } from '#/lib/utils'

export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-block h-5 w-9 flex-none rounded-full',
        on ? 'bg-primary' : 'bg-ring',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white',
          on ? 'right-0.5' : 'left-0.5',
        )}
      />
    </span>
  )
}
