import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Subida de archivos a disco local, SOLO para desarrollo: `public/uploads/`.
// En producción `public/` es estático (se copia al compilar), así que no se puede escribir;
// ahí se reemplaza por UploadThing. Ver "Pendientes / dudas" (ARCHIVOS) en la bitácora.
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const URL_PREFIX = '/uploads/'
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

// Guarda el archivo con un nombre aleatorio y devuelve su URL pública y el nombre original.
export async function storeUpload(file: File, kind: UploadKind) {
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
  await mkdir(UPLOAD_DIR, { recursive: true })
  const stored = `${randomUUID()}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, stored), buf)
  const name = path.basename(file.name.replaceAll('\\', '/')).slice(0, 120)
  return { url: URL_PREFIX + stored, name: name || stored }
}

// Borra un archivo subido por nosotros; ignora cualquier otra URL (p. ej. `/images/...`).
export async function removeUpload(url: string | null | undefined) {
  if (!url || !/^\/uploads\/[0-9a-f-]+\.[a-z]+$/.test(url)) return
  await unlink(path.join(UPLOAD_DIR, url.slice(URL_PREFIX.length))).catch(
    () => {},
  )
}
