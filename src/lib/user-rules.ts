// Reglas del módulo de usuarios que no dependen de la base: quién puede hacerle qué a quién.
// Una administradora no puede quitarse a sí misma el acceso (rol, suspensión o borrado):
// así el panel nunca se queda sin una administradora activa.

export type UserAction = 'role' | 'suspend' | 'delete'

const SELF_MESSAGES: Record<UserAction, string> = {
  role: 'No puedes cambiar tu propio rol.',
  suspend: 'No puedes suspender tu propia cuenta.',
  delete: 'No puedes eliminar tu propia cuenta.',
}

// Mensaje de error si `actorId` no puede hacer `action` sobre `targetId`; null si puede.
export function forbiddenOnSelf(
  actorId: string,
  targetId: string,
  action: UserAction,
) {
  return actorId === targetId ? SELF_MESSAGES[action] : null
}

export type UserFilter = 'todos' | 'admin' | 'alumnas' | 'suspendidas'

// Condición de Prisma de cada filtro de la lista.
export function filterWhere(filter: UserFilter) {
  switch (filter) {
    case 'admin':
      return { role: 'ADMIN' as const }
    case 'alumnas':
      return { role: 'STUDENT' as const }
    case 'suspendidas':
      return { suspendedAt: { not: null } }
    default:
      return {}
  }
}

// Búsqueda por nombre o correo, sin distinguir mayúsculas; vacío = sin condición.
export function searchWhere(query: string) {
  const q = query.trim()
  if (!q) return {}
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
    ],
  }
}

// Acceso a mano desde el panel. Como en el checkout, nunca dos niveles de la herramienta:
// quien ya tiene uno (vigente o vencido) no puede recibir otro; para cambiar de nivel se
// quita el que tiene y se da el otro.
export const SECOND_TIER_MESSAGE =
  'Ya tiene otro nivel de la herramienta. Quítalo primero para dar este.'

type Kind = 'COURSE' | 'TOOL'

export function secondTierError(kind: Kind, ownedKinds: Kind[]) {
  return kind === 'TOOL' && ownedKinds.includes('TOOL')
    ? SECOND_TIER_MESSAGE
    : null
}

// Productos que se ofrecen en «Dar acceso a»: los que no tiene y, si ya tiene un nivel de la
// herramienta, ningún otro nivel.
export function grantableProducts<TProduct extends { id: string; kind: Kind }>(
  products: TProduct[],
  owned: { productId: string; kind: Kind }[],
) {
  const ownedIds = new Set(owned.map((o) => o.productId))
  const hasTool = owned.some((o) => o.kind === 'TOOL')
  return products.filter(
    (p) => !ownedIds.has(p.id) && !(hasTool && p.kind === 'TOOL'),
  )
}

// La herramienta incluye el curso Aprende a Costear (misma regla que la compra): al darla a
// mano, el curso queda con el vencimiento mayor entre el que ya tenía y el de la herramienta.
// Devuelve la fecha a guardar, o null si no hay que tocar el curso.
export function includedCourseExpiry(toolExpiresAt: Date, current?: Date) {
  if (current && current.getTime() >= toolExpiresAt.getTime()) return null
  return toolExpiresAt
}
