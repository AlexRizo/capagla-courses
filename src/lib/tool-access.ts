import { redirect } from '@tanstack/react-router'
import {
  createMiddleware,
  createServerFn,
  createServerOnlyFn,
} from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { prisma } from '#/db'
import { readSession } from '#/lib/auth'
import {
  ADMIN_TIER,
  FULL_TIER,
  TOOL_MODULES,
  bestTier,
  hasModule,
} from '#/lib/tool-tiers'
import type { ToolModuleKey, ToolTierInfo } from '#/lib/tool-tiers'

// Acceso a la herramienta de costos: una administradora siempre; una alumna solo con la
// inscripción vigente a un producto de tipo herramienta (la que da su compra). Cada producto tiene
// su nivel (`ToolTier`): módulos abiertos, límite de elementos y plazo de las cotizaciones; con
// varias inscripciones vigentes cuenta el nivel más alto.
// `createServerOnlyFn` evita que el código del servidor llegue al navegador.
export const loadTier = createServerOnlyFn(
  async (
    userId: string,
    role: string | null | undefined,
  ): Promise<ToolTierInfo | null> => {
    if (role === 'ADMIN') return ADMIN_TIER
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        product: { kind: 'TOOL' },
      },
      include: { product: { include: { tier: true } } },
    })
    return bestTier(
      enrollments.map(({ product }) =>
        product.tier
          ? {
              name: product.name,
              rank: product.tier.rank,
              itemLimit: product.tier.itemLimit,
              quoteDays: product.tier.quoteDays,
              modules: product.tier.modules,
            }
          : { ...FULL_TIER, name: product.name },
      ),
    )
  },
)

// Para las server functions de la herramienta: `.middleware([requireTool])`. Entrega el id de la
// dueña de los datos en `context.userId` y su nivel en `context.tier`; todo lo que se lee o
// escribe se limita a ese id.
export const requireTool = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await readSession(getRequestHeaders())
    const tier = session
      ? await loadTier(session.user.id, session.user.role)
      : null
    if (!session || !tier) throw new Response('Not Found', { status: 404 })
    return next({ context: { userId: session.user.id, tier } })
  },
)

// Igual, pero además exige que el nivel abra ese módulo (Producción, Lista de compra, Registro de
// compras o Cotizador).
export const requireModule = (module: ToolModuleKey) =>
  createMiddleware({ type: 'function' })
    .middleware([requireTool])
    .server(({ next, context }) => {
      if (!hasModule(context.tier, module)) {
        throw new Response('Not Found', { status: 404 })
      }
      return next()
    })

// Guarda de las páginas de la herramienta: sin sesión va a Entrar, sin acceso a Mis cursos y, si
// su nivel no abre el módulo de la página, a Productos.
export const getToolContext = createServerFn()
  .validator(z.object({ module: z.enum(TOOL_MODULES).optional() }).optional())
  .handler(async ({ data }) => {
    const session = await readSession(getRequestHeaders())
    if (!session) return { status: 'login' as const }
    const tier = await loadTier(session.user.id, session.user.role)
    if (!tier) return { status: 'denied' as const }
    if (data?.module && !hasModule(tier, data.module)) {
      return { status: 'locked' as const }
    }
    return { status: 'ok' as const, name: session.user.name, tier }
  })

export async function requireToolPage(module?: ToolModuleKey) {
  const context = await getToolContext({ data: { module } })
  if (context.status === 'login') throw redirect({ to: '/entrar' })
  if (context.status === 'denied') throw redirect({ to: '/mis-cursos' })
  if (context.status === 'locked') {
    throw redirect({ to: '/herramienta/productos' })
  }
  return { userName: context.name, tier: context.tier }
}
