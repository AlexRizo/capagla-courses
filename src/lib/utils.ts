import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge no conoce los tamaños propios de `@theme` (styles.css): sin esto confunde
// `text-13` con un color y lo borra si en la misma lista hay `text-<color>`.
// Mantener al día con `--text-*` y `--radius-*` de styles.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        '10',
        '11',
        '13',
        '15',
        '17',
        '19',
        '21',
        '22',
        '26',
        '28',
        '30',
        '32',
        '34',
        '36',
        '40',
        '46',
        '52',
      ],
      radius: ['10', '12', '14', '16', '18', '20'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
