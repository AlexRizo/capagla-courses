import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { cn } from '#/lib/utils'

export type PickerItem = { id: string; label: string; hint?: string }

// Elegir un elemento de una lista larga con búsqueda (ingredientes, premezclas).
export function Picker({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar…',
  invalid,
  className,
  'aria-label': ariaLabel,
}: {
  items: PickerItem[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  searchPlaceholder?: string
  invalid?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const current = items.find((i) => i.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          className={cn(
            'w-full justify-between font-normal',
            !current && 'text-muted-foreground',
            invalid && 'border-destructive',
            className,
          )}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.id}`}
                  onSelect={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4',
                      item.id === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
