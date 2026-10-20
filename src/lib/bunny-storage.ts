import { env } from '#/env'

// Bunny Storage (archivos subidos desde el panel: portadas y recursos). No es Bunny Stream
// (videos, `lib/bunny.ts`): tiene otra clave, la contraseña de la zona de almacenamiento.
//  - Portadas: `uploads/<archivo>`, públicas por la Pull Zone conectada (`BUNNY_STORAGE_CDN_URL`).
//  - Recursos: `recursos/<archivo>`, que solo lee el servidor con la clave y entrega
//    `/api/recursos/<archivo>` después de comprobar la sesión y el acceso al curso.
const TIMEOUT_MS = 30_000

export type BunnyStorageConfig = {
  zone: string
  key: string
  // Con o sin `https://` y con o sin el nombre de la zona al final.
  host?: string
  cdnUrl: string
}

export class BunnyStorageError extends Error {}

export function createBunnyStorage({
  zone,
  key,
  host,
  cdnUrl,
}: BunnyStorageConfig) {
  const raw = (host || 'storage.bunnycdn.com').trim().replace(/\/+$/, '')
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  const base = withScheme.endsWith(`/${zone}`)
    ? withScheme
    : `${withScheme}/${zone}`
  const cdn = cdnUrl.trim().replace(/\/+$/, '')

  async function call(method: string, path: string, body?: Uint8Array) {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: {
        AccessKey: key,
        ...(body ? { 'content-type': 'application/octet-stream' } : {}),
      },
      // `Uint8Array` es un cuerpo válido de `fetch`; los tipos de TS aún no lo reconocen.
      body: body as BodyInit | undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res
  }

  return {
    // URL pública (por CDN) de un archivo de la zona.
    publicUrl: (path: string) => `${cdn}/${path}`,
    // Ruta dentro de la zona de una URL pública nuestra, o null si es de otro lado.
    pathFromPublicUrl: (url: string) =>
      url.startsWith(`${cdn}/`) ? url.slice(cdn.length + 1) : null,

    async put(path: string, data: Uint8Array) {
      const res = await call('PUT', path, data)
      // Nunca se registra el cuerpo ni la clave: solo el estado.
      if (!res.ok)
        throw new BunnyStorageError(`PUT ${path}: HTTP ${res.status}`)
    },

    // El contenido del archivo, o null si no existe.
    async get(path: string) {
      const res = await call('GET', path)
      if (res.status === 404) return null
      if (!res.ok)
        throw new BunnyStorageError(`GET ${path}: HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    },

    // Borrar un archivo que no existe no es un error.
    async delete(path: string) {
      const res = await call('DELETE', path)
      if (!res.ok && res.status !== 404) {
        throw new BunnyStorageError(`DELETE ${path}: HTTP ${res.status}`)
      }
    },
  }
}

export type BunnyStorage = ReturnType<typeof createBunnyStorage>

// El almacenamiento de las variables de entorno; null si falta alguna de las tres
// obligatorias (entonces se usa el disco local en desarrollo).
export function getBunnyStorage(): BunnyStorage | null {
  const zone = env.BUNNY_STORAGE_ZONE
  const key = env.BUNNY_STORAGE_KEY
  const cdnUrl = env.BUNNY_STORAGE_CDN_URL
  if (!zone || !key || !cdnUrl) return null
  return createBunnyStorage({
    zone,
    key,
    host: env.BUNNY_STORAGE_HOST,
    cdnUrl,
  })
}
