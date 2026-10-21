import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Pruebas de las reglas de dinero y acceso. Las que tocan la base usan SIEMPRE `capagla_test`
// (se crea con `docker compose exec db createdb -U capagla capagla_test` y se migra con
// `DATABASE_URL=postgresql://… pnpm prisma migrate deploy`); `src/test/setup.ts` se niega a
// correr contra otra. El usuario, la contraseña y el puerto salen de `POSTGRES_*` del `.env`
// (el puerto cambia de una máquina a otra); sin `.env` se usan los valores de desarrollo.
const env = loadEnv('test', process.cwd(), '')
const testDatabaseUrl = `postgresql://${env.POSTGRES_USER || 'capagla'}:${encodeURIComponent(env.POSTGRES_PASSWORD || 'postgres')}@localhost:${env.POSTGRES_PORT || '4321'}/capagla_test`

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      // Sin proveedor de correo: los enlaces solo salen en la consola.
      BREVO_API_KEY: '',
      MAIL_FROM_EMAIL: '',
      // Sin asistente de IA aunque la terminal tenga la clave: las pruebas nunca hablan con Claude.
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_WORKSPACE_ID: '',
      // Meta y TikTok apuntan a un servidor falso local (lo levanta `purchase-marketing.test.ts`):
      // las pruebas nunca hablan con las plataformas reales.
      META_API_URL: 'http://127.0.0.1:47631',
      TIKTOK_API_URL: 'http://127.0.0.1:47631',
    },
  },
})
