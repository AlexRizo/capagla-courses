import { redirect } from '@tanstack/react-router'
import {
  createMiddleware,
  createServerFn,
  createServerOnlyFn,
} from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'

// Acceso a la herramienta de costos: una administradora siempre; una alumna solo con la
// inscripción vigente al producto de tipo herramienta (la que da su compra).
// `createServerOnlyFn` evita que el código del servidor llegue al navegador.
const hasToolAccess = createServerOnlyFn(
  async (userId: string, role: string | null | undefined) => {
    if (role === 'ADMIN') return true
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        product: { kind: 'TOOL' },
      },
      select: { id: true },
    })
    return !!enrollment
  },
)

// Para las server functions de la herramienta: `.middleware([requireTool])`. Entrega el id de la
// dueña de los datos en `context.userId`; todo lo que se lee o escribe se limita a ese id.
export const requireTool = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await readSession(getRequestHeaders())
    if (
      !session ||
      !(await hasToolAccess(session.user.id, session.user.role))
    ) {
      throw new Response('Not Found', { status: 404 })
    }
    return next({ context: { userId: session.user.id } })
  },
)

// Guarda de las páginas de la herramienta: sin sesión va a Entrar y sin acceso a Mis cursos.
export const getToolContext = createServerFn().handler(async () => {
  const session = await readSession(getRequestHeaders())
  if (!session) return { status: 'login' as const }
  if (!(await hasToolAccess(session.user.id, session.user.role))) {
    return { status: 'denied' as const }
  }
  return { status: 'ok' as const, name: session.user.name }
})

export async function requireToolPage() {
  const context = await getToolContext()
  if (context.status === 'login') throw redirect({ to: '/entrar' })
  if (context.status === 'denied') throw redirect({ to: '/mis-cursos' })
  return { userName: context.name }
}
