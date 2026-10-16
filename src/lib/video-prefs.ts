// Lo que la alumna deja ajustado en el reproductor (velocidad, volumen y silencio) se recuerda
// en este navegador para todas las lecciones. Solo para el cliente: sin almacenamiento
// (modo privado, bloqueado) todo sigue funcionando y los ajustes valen para esa visita.

export const VIDEO_RATES = [1, 1.5, 2, 3]

export type VideoPrefs = { rate: number; volume: number; muted: boolean }

const KEY = 'capagla-video-prefs'

// `null` si no hay nada guardado (no se toca el video) o lo guardado no sirve.
export function readVideoPrefs(): VideoPrefs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const { rate, volume, muted } = data as Record<string, unknown>
    return {
      rate: typeof rate === 'number' && VIDEO_RATES.includes(rate) ? rate : 1,
      volume:
        typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 1,
      muted: muted === true,
    }
  } catch {
    return null
  }
}

export function saveVideoPrefs(change: Partial<VideoPrefs>) {
  try {
    const next = {
      rate: 1,
      volume: 1,
      muted: false,
      ...readVideoPrefs(),
      ...change,
    }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sin almacenamiento: los ajustes valen solo para esta visita.
  }
}
