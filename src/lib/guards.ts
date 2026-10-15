import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'

// Para las server functions del panel: `.middleware([requireAdmin])`.
// El `beforeLoad` de /admin solo protege la pantalla; esto protege los datos.
export const requireAdmin = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (session?.user.role !== 'ADMIN') {
      throw new Response('Not Found', { status: 404 })
    }
    return next({ context: { session } })
  },
)
