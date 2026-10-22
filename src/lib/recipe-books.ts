import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Recetario PDF de cada curso: `assets/recetarios/<slug del curso>.pdf`. Va en el repositorio
// (fuera de `public/`, que es estático y abierto) para que llegue al servidor en cada despliegue;
// solo se descarga por `/api/recetarios/<slug>`, que pide sesión y acceso vigente al curso.
// La maqueta no trae dónde subirlo desde el panel: se reemplaza cambiando el archivo.
const DIR = path.join(process.cwd(), 'assets', 'recetarios')

export const RECIPE_BOOK_URL_PREFIX = '/api/recetarios/'

// El slug llega de la URL: solo letras minúsculas, números y guiones (nada de rutas).
const fileFor = (slug: string) =>
  /^[a-z0-9-]+$/.test(slug) ? path.join(DIR, `${slug}.pdf`) : null

export async function hasRecipeBook(slug: string) {
  const file = fileFor(slug)
  if (!file) return false
  return stat(file).then(
    (s) => s.isFile(),
    () => false,
  )
}

export async function readRecipeBook(slug: string) {
  const file = fileFor(slug)
  if (!file) return null
  return readFile(file).catch(() => null)
}
