import { defineConfig } from 'vitest/config'

// Pruebas de las reglas de dinero y acceso. Las que tocan la base usan SIEMPRE `capagla_test`
// (se crea con `docker compose exec db createdb -U capagla capagla_test` y se migra con
// `DATABASE_URL=… pnpm prisma migrate deploy`); `src/test/setup.ts` se niega a correr contra otra.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgresql://capagla:postgres@localhost:4321/capagla_test',
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      // Sin proveedor de correo: los enlaces solo salen en la consola.
      BREVO_API_KEY: '',
      MAIL_FROM_EMAIL: '',
    },
  },
})
