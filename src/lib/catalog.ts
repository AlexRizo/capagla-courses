// Preguntas de pago, iguales en /navidad, /cursos/postres-navidad y /herramienta-de-costos (H17).
// Los métodos son los que de verdad muestra el checkout: tarjeta (Elements) y, si el aparato los
// tiene, Apple Pay o Google Pay (Express Checkout; Link, PayPal y Amazon Pay apagados).
export const PAYMENT_FAQ = [
  {
    q: '¿Qué métodos de pago hay?',
    a: 'Tarjeta de crédito o débito, y Apple Pay o Google Pay si tu celular o navegador los tiene. El pago lo procesa Stripe de forma segura.',
  },
  {
    q: '¿Puedo pagar desde otro país?',
    a: 'Sí. Se cobra en pesos mexicanos; si tu tarjeta es de otro país, tu banco hace la conversión.',
  },
]

// Curso que vende el checkout cuando se entra por un enlace simple (sin promoción).
export const COURSE_SLUG = 'postres-navidad'

export const mxn = (amount: number) => `$${amount} MXN`

// Descuento de la renovación del acceso sobre el precio normal (decisión del cliente 2026-10-17).
export const RENEWAL_DISCOUNT_PCT = 85

// Descuento de la renovación de la herramienta de costos sobre su precio normal (maqueta última:
// «con descuento sobre el precio original»; 15% provisional, usuario 2026-11-11).
export const TOOL_RENEWAL_DISCOUNT_PCT = 15
