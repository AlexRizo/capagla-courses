import { createServerFn } from '@tanstack/react-start'

import { env } from '#/env'

// La URL pública del sitio, para las imágenes y enlaces absolutos de `lib/seo.ts`.
export const getSiteUrl = createServerFn().handler(() => env.BETTER_AUTH_URL)
