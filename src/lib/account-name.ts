// Las cuentas de la clase gratis nacen sin nombre real: se usa el inicio del correo.
// Mientras lo conserven, pueden escribir su nombre la primera vez que compran.
export const placeholderName = (email: string) => email.split('@')[0]

export const hasPlaceholderName = (user: { email: string; name: string }) =>
  user.name === placeholderName(user.email)
