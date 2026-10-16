// Límite simple en memoria para los pasos que piden solo un correo ("Entrar", "Clase gratis"):
// que no sirvan para sondear cuentas ni para mandar correos en masa. La clave suele ser correo + IP.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

export function tooManyAttempts(key: string) {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}
