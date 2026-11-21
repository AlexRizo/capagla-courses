// Roles de las cuentas. SUPERADMIN y ADMIN entran al panel; STUDENT no. Este archivo no toca la
// base: lo usan el servidor y el navegador.

export const ROLES = ['SUPERADMIN', 'ADMIN', 'STUDENT'] as const
export type Role = (typeof ROLES)[number]

// ¿Entra al panel y ve todo como administradora? (super o administrador).
export const isPanelRole = (role: string | null | undefined) =>
  role === 'ADMIN' || role === 'SUPERADMIN'

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  STUDENT: 'Alumna',
}

// Opciones del selector de rol (crear usuario y ficha).
export const ROLE_OPTION: Record<Role, string> = {
  STUDENT: 'Alumna: entra a sus cursos',
  ADMIN: 'Administrador: entra al panel',
  SUPERADMIN: 'Superadministrador: entra al panel y crea administradores',
}

// Roles que `actor` puede dar al crear o editar una cuenta: el superadministrador, cualquiera;
// el administrador, solo alumna.
export const assignableRoles = (actor: string): Role[] =>
  actor === 'SUPERADMIN' ? [...ROLES].reverse() : ['STUDENT']

// ¿`actor` puede cambiar datos, rol, suspender, borrar o mandar el enlace a una cuenta con rol
// `target`? El superadministrador, a cualquiera; el administrador, solo a alumnas.
export const canManage = (actor: string, target: string) =>
  actor === 'SUPERADMIN' || (actor === 'ADMIN' && target === 'STUDENT')

export const STAFF_ONLY_MESSAGE =
  'Solo un superadministrador puede cambiar cuentas de administrador.'
