// Los IDs de los píxeles acaban en la dirección de un script del navegador: solo se aceptan con
// la forma de cada plataforma (lo demás se trata como si no estuviera guardado).
const SHAPE = {
  meta: /^\d{5,20}$/,
  tiktok: /^[A-Z0-9]{8,30}$/i,
  ga4: /^G-[A-Z0-9]{4,20}$/i,
}

export function validTrackingId(
  kind: keyof typeof SHAPE,
  id: string | null | undefined,
) {
  const trimmed = id?.trim()
  return trimmed && SHAPE[kind].test(trimmed) ? trimmed : null
}
