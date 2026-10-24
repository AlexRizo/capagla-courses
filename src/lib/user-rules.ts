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
