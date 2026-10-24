import { createHash } from 'node:crypto'

import { env } from '#/env'

// Bunny Stream: solo para el servidor. Los videos están en una biblioteca; la reproducción
// va por HLS con un token de directorio, así que sin token (o desde un dominio no permitido
// en la biblioteca) Bunny responde 403.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isBunnyId = (value: string) => GUID.test(value)

// El token vale este tiempo: lo que dura una lección abierta, con margen para pausas.
const TOKEN_TTL_SECONDS = 6 * 60 * 60

const sha256Url = (text: string) =>
  createHash('sha256')
    .update(text)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

// URL de la lista HLS con el token en la ruta (`bcdn_token=…&expires=…&token_path=…/<video>/…`):
// las rutas relativas de las calidades y los segmentos heredan el token, así que sirve igual
// con hls.js que con el HLS nativo de Safari.
export function signedPlaybackUrl(videoId: string) {
  const host = env.BUNNY_CDN_HOSTNAME
  const key = env.BUNNY_TOKEN_KEY
  if (!host || !key || !isBunnyId(videoId)) return null
  const dir = `/${videoId}/`
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const token = sha256Url(`${key}${dir}${expires}token_path=${dir}`)
  return `https://${host}/bcdn_token=${token}&expires=${expires}&token_path=${encodeURIComponent(dir)}/${videoId}/playlist.m3u8`
}

export type BunnyVideo = {
  id: string
  title: string
  durationSec: number
  // "terminado": ya se puede reproducir (los demás estados son subida o procesamiento).
  ready: boolean
}

type ApiVideo = { guid: string; title: string; length: number; status: number }

const toVideo = (v: ApiVideo): BunnyVideo => ({
  id: v.guid,
  title: v.title,
  durationSec: Math.round(v.length),
  ready: v.status === 4,
})

async function api(
  path: string,
  init?: { method: 'POST' | 'DELETE'; body?: object },
) {
  const library = env.BUNNY_LIBRARY_ID
  const key = env.BUNNY_API_KEY
  if (!library || !key) throw new Error('Bunny no está configurado.')
  const response = await fetch(
    `https://video.bunnycdn.com/library/${library}${path}`,
    {
      method: init?.method ?? 'GET',
      headers: {
        AccessKey: key,
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    },
  )
  if (!response.ok) throw new Error(`Bunny respondió ${response.status}.`)
  return response
}

// Todos los videos de la biblioteca, ordenados por nombre.
export async function listBunnyVideos() {
  const videos: BunnyVideo[] = []
  for (let page = 1; ; page++) {
    const response = await api(
      `/videos?page=${page}&itemsPerPage=100&orderBy=title`,
    )
    const body = (await response.json()) as {
      items: ApiVideo[]
      totalItems: number
    }
    videos.push(...body.items.map(toVideo))
    if (videos.length >= body.totalItems || body.items.length === 0) break
  }
  return videos
}

export async function getBunnyVideo(id: string) {
  if (!isBunnyId(id)) return null
  const response = await api(`/videos/${id}`)
  return toVideo((await response.json()) as ApiVideo)
}

// --- Subida desde el panel (TUS, directo del navegador a Bunny) ---
// El servidor crea el video vacío y entrega una firma de un solo uso para ese video; la clave
// de la API nunca sale del servidor. Bunny valida `sha256(biblioteca + clave + vencimiento + video)`.

export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3
const UPLOAD_TTL_SECONDS = 6 * 60 * 60

export const uploadSignature = (
  library: string,
  key: string,
  expire: number,
  videoId: string,
) =>
  createHash('sha256')
    .update(`${library}${key}${expire}${videoId}`)
    .digest('hex')

// Nombre del video en Bunny: el del archivo sin extensión.
export const titleFromFilename = (name: string) =>
  name
    .replace(/\.[^./\\]+$/, '')
    .trim()
    .slice(0, 200) || 'Video'

export async function createBunnyUpload(title: string) {
  const library = env.BUNNY_LIBRARY_ID
  const key = env.BUNNY_API_KEY
  if (!library || !key) throw new Error('Bunny no está configurado.')
  const response = await api('/videos', { method: 'POST', body: { title } })
  const { guid } = (await response.json()) as { guid: string }
  const expire = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS
  return {
    videoId: guid,
    title,
    libraryId: library,
    expire,
    signature: uploadSignature(library, key, expire, guid),
  }
}

// Borra un video al que nunca llegó el archivo (subida cancelada o fallida). Nunca toca uno
// que ya recibió el archivo.
export async function deleteEmptyBunnyVideo(id: string) {
  if (!isBunnyId(id)) return false
  const response = await api(`/videos/${id}`)
  const { status } = (await response.json()) as ApiVideo
  // 0 creado y vacío, 6 subida fallida.
  if (status !== 0 && status !== 6) return false
  await api(`/videos/${id}`, { method: 'DELETE' })
  return true
}
