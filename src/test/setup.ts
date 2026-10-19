import { beforeEach, vi } from 'vitest'

if (!process.env.DATABASE_URL?.endsWith('/capagla_test')) {
  throw new Error('Las pruebas solo pueden correr contra la base capagla_test.')
}

// Los correos y avisos de las compras salen en la consola; en las pruebas no hace falta verlos.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
