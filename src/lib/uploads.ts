import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { getBunnyStorage } from '#/lib/bunny-storage'
import type { BunnyStorage } from '#/lib/bunny-storage'

// Subida de archivos. Con Bunny Storage configurado (`lib/bunny-storage.ts`) van allá; sin él,
// a disco local, SOLO para desarrollo (en producción `public/` es estático y no se puede
// escribir, así que `/api/uploads` responde 501 hasta configurar Bunny Storage).
//  - Portadas (`image`): `uploads/` en Bunny (URL pública por CDN) o `public/uploads/`.
//  - Recursos (`file`): `recursos/` en Bunny o `private-uploads/`, fuera de `public/`. Solo se
//    descargan por `/api/recursos/<archivo>`, que pide sesión y acceso al curso (ver esa ruta).
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const PRIVATE_DIR = path.join(process.cwd(), 'private-uploads')
const URL_PREFIX = '/uploads/'
const BUNNY_PUBLIC_DIR = 'uploads'
const BUNNY_PRIVATE_DIR = 'recursos'
export const PRIVATE_URL_PREFIX = '/api/recursos/'
const MB = 1024 * 1024

export const UPLOAD_KINDS = {
  // Portadas.
  image: { exts: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
  // Recursos de capítulos y lecciones (recetario PDF, plantillas).
  file: {
    exts: ['pdf', 'jpg', 'png', 'webp', 'docx', 'xlsx', 'pptx'],
    maxBytes: 25 * MB,
  },
} as const

export type UploadKind = keyof typeof UPLOAD_KINDS

const OFFICE = ['docx', 'xlsx', 'pptx']

const startsWith = (buf: Buffer, bytes: number[], at = 0) =>
  bytes.every((b, i) => buf[at + i] === b)

// El tipo se decide por el contenido (no por lo que diga el navegador). Nunca SVG ni HTML:
// se servirían desde el mismo origen del sitio.
function detectExt(buf: Buffer, fileName: string) {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpg'
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'webp'
  // Los archivos de Office son zip: se distinguen por la extensión del nombre.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = path.extname(fileName).slice(1).toLowerCase()
    if (OFFICE.includes(ext)) return ext
  }
  return null
}

export class UploadError extends Error {}

// ¿Se puede subir archivos? Con Bunny Storage siempre; con disco local, solo fuera de producción.
export const uploadsAvailable = (
  storage: BunnyStorage | null = getBunnyStorage(),
) => !!storage || process.env.NODE_ENV !== 'production'

// Guarda el archivo con un nombre aleatorio y devuelve su URL y el nombre original. La de una
// portada es pública (CDN o `/uploads/…`); la de un recurso es `/api/recursos/…`.
export async function storeUpload(
  file: File,
  kind: UploadKind,
  storage: BunnyStorage | null = getBunnyStorage(),
) {
  const { exts, maxBytes } = UPLOAD_KINDS[kind]
  if (file.size === 0) throw new UploadError('El archivo está vacío.')
  if (file.size > maxBytes) {
    throw new UploadError(`El archivo pesa más de ${maxBytes / MB} MB.`)
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = detectExt(buf, file.name)
  if (!ext || !(exts as readonly string[]).includes(ext)) {
    throw new UploadError(`Formato no permitido. Usa: ${exts.join(', ')}.`)
  }
  const stored = `${randomUUID()}.${ext}`
  const name = path.basename(file.name.replaceAll('\\', '/')).slice(0, 120)
  if (storage) {
    const key = `${kind === 'file' ? BUNNY_PRIVATE_DIR : BUNNY_PUBLIC_DIR}/${stored}`
    await storage.put(key, buf)
    const url =
      kind === 'file' ? PRIVATE_URL_PREFIX + stored : storage.publicUrl(key)
    return { url, name: name || stored }
  }
  const dir = kind === 'file' ? PRIVATE_DIR : UPLOAD_DIR
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, stored), buf)
  const prefix = kind === 'file' ? PRIVATE_URL_PREFIX : URL_PREFIX
  return { url: prefix + stored, name: name || stored }
}

// Borra un archivo subido por nosotros; ignora cualquier otra URL (p. ej. `/images/...`).
// Si falla el borrado en Bunny solo se registra: el archivo huérfano no debe impedir que la
// alumna o la chef sigan trabajando.
export async function removeUpload(
  url: string | null | undefined,
  storage: BunnyStorage | null = getBunnyStorage(),
) {
  if (!url) return
  const cdnPath = storage?.pathFromPublicUrl(url)
  if (cdnPath !== null && cdnPath !== undefined) {
    if (!/^uploads\/[0-9a-f-]+\.[a-z]+$/.test(cdnPath)) return
    await storage!.delete(cdnPath).catch(logFailure)
  } else if (/^\/uploads\/[0-9a-f-]+\.[a-z]+$/.test(url)) {
    await unlink(path.join(UPLOAD_DIR, url.slice(URL_PREFIX.length))).catch(
      () => {},
    )
  } else if (/^\/api\/recursos\/[0-9a-f-]+\.[a-z]+$/.test(url)) {
    const stored = url.slice(PRIVATE_URL_PREFIX.length)
    // También el disco local: quedan archivos de antes de configurar Bunny.
    await unlink(path.join(PRIVATE_DIR, stored)).catch(() => {})
    await storage?.delete(`${BUNNY_PRIVATE_DIR}/${stored}`).catch(logFailure)
  }
}

const logFailure = (error: unknown) =>
  console.error('[subida] No se pudo borrar el archivo de Bunny:', error)

// Lee un recurso privado por el nombre con el que se guardó (el final de su URL).
export async function readPrivateUpload(
  stored: string,
  storage: BunnyStorage | null = getBunnyStorage(),
) {
  if (!/^[0-9a-f-]+\.[a-z]+$/.test(stored)) return null
  if (storage) {
    const file = await storage.get(`${BUNNY_PRIVATE_DIR}/${stored}`)
    if (file) return file
  }
  return readFile(path.join(PRIVATE_DIR, stored)).catch(() => null)
}
