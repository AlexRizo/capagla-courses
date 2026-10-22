import { readFile } from 'node:fs/promises'
import path from 'node:path'

// PDF de cada receta: `assets/recetas/<nombre>.pdf`. Va en el repositorio (fuera de `public/`,
// que es estático y abierto) y se descarga por `/api/recetas/<nombre>`, que comprueba el acceso a
// la lección que lo trae como recurso. Se reemplaza cambiando el archivo.
const DIR = path.join(process.cwd(), 'assets', 'recetas')

export const RECIPE_URL_PREFIX = '/api/recetas/'

// El nombre llega de la URL: solo letras minúsculas, números y guiones (nada de rutas).
export async function readRecipePdf(name: string) {
  if (!/^[a-z0-9-]+$/.test(name)) return null
  return readFile(path.join(DIR, `${name}.pdf`)).catch(() => null)
}
