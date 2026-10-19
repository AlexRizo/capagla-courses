// Credenciales de la administradora que crea el seed (no hay registro: las cuentas nacen al
// comprar). Con la base en esta máquina (localhost) se usan las de desarrollo, salvo que se
// definan `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Con cualquier otra base (producción) esas dos
// variables son obligatorias y la contraseña debe tener al menos 12 caracteres: nunca se usa la
// de desarrollo fuera de esta máquina.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Local solo si el host de la URL (no cualquier texto dentro de ella) es de esta máquina; una URL
// que no se puede leer cuenta como no local.
function isLocalDatabase(databaseUrl: string | undefined) {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl ?? '').hostname)
  } catch {
    return false
  }
}
export const MIN_ADMIN_PASSWORD = 12

export function adminCredentials(env: {
  DATABASE_URL?: string
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD?: string
}) {
  const local = isLocalDatabase(env.DATABASE_URL)
  const email = env.ADMIN_EMAIL?.trim() || (local ? 'dev@alowee.com' : '')
  const password = env.ADMIN_PASSWORD || (local ? 'Passwd123+' : '')
  if (!local && (!email || password.length < MIN_ADMIN_PASSWORD)) {
    throw new Error(
      `Con una base que no es local, define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo ${MIN_ADMIN_PASSWORD} caracteres).`,
    )
  }
  return { email, name: 'Admin', password, local }
}
