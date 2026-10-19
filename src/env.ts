import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url().startsWith('postgres'),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    // Bunny Stream (videos del curso). Sin ellas los videos de Bunny no se reproducen.
    BUNNY_LIBRARY_ID: z.string().optional(),
    BUNNY_API_KEY: z.string().optional(),
    BUNNY_CDN_HOSTNAME: z.string().optional(),
    BUNNY_TOKEN_KEY: z.string().optional(),
    // Stripe (cobros). La clave publicable se entrega al navegador desde el servidor.
    // El secreto del webhook sale de `stripe listen` (desarrollo) o del panel (producción).
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISH_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Brevo (correo). Sin la clave o sin remitente, los correos solo salen en la consola.
    // El remitente debe ser de un dominio verificado en Brevo.
    BREVO_API_KEY: z.string().optional(),
    MAIL_FROM_EMAIL: z.string().email().optional(),
    MAIL_FROM_NAME: z.string().optional(),
    // Solo pruebas: otra dirección en lugar de graph.facebook.com para la API de conversiones.
    META_API_URL: z.string().url().optional(),
    TIKTOK_API_URL: z.string().url().optional(),
    // Buzón de soporte: recibe los reportes y es la dirección de respuesta de los correos.
    SUPPORT_EMAIL: z.string().email().optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...import.meta.env,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
