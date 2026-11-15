import type { ToolModuleKey } from '#/lib/tool-tiers'

// Ayuda de la herramienta (tema 11; prototipo, página «Ayuda (herramienta)»): un video corto por
// sección, con Gladis. Los videos los sube Cheko a Bunny y se asignan en el panel (Herramienta ›
// Videos de ayuda); mientras un video no exista, su «?» no aparece.

export type HelpKey =
  | 'A00'
  | 'A01'
  | 'A02'
  | 'A03'
  | 'A04'
  | 'A05'
  | 'A06'
  | 'A07'
  | 'A08'
  | 'A09'
  | 'A10'
  | 'A11'

export type HelpTopic = {
  key: HelpKey
  title: string
  desc: string
  // Sección de la herramienta (listado y detalle comparten el video). A00 no tiene.
  path?: string
  // Solo para el nivel que abre ese módulo (en la página de Ayuda lleva «Completo»).
  module?: ToolModuleKey
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    key: 'A00',
    title: 'Bienvenida y recorrido',
    desc: 'Un recorrido por el menú y por dónde empezar.',
  },
  {
    key: 'A01',
    title: 'Ajustes de costos',
    desc: 'Tu tiempo, tus gastos fijos y el múltiplo para tu precio.',
    path: '/herramienta/ajustes',
  },
  {
    key: 'A02',
    title: 'Ingredientes y empaques',
    desc: 'Da de alta lo que compras y cuánto te cuesta.',
    path: '/herramienta/ingredientes',
  },
  {
    key: 'A03',
    title: 'Recetas',
    desc: 'Arma una receta y mira su costo de producción.',
    path: '/herramienta/recetas',
  },
  {
    key: 'A04',
    title: 'Premezclas',
    desc: 'Prepárala una vez y úsala en varias recetas.',
    path: '/herramienta/premezclas',
  },
  {
    key: 'A05',
    title: 'Productos, precio y semáforo',
    desc: 'Ponle precio a lo que vendes y lee el semáforo.',
    path: '/herramienta/productos',
  },
  {
    key: 'A06',
    title: 'Etiquetas',
    desc: 'Ordena y filtra tus recetas.',
    path: '/herramienta/etiquetas',
  },
  {
    key: 'A07',
    title: 'Lugares de compra',
    desc: 'Anota dónde compras cada ingrediente.',
    path: '/herramienta/lugares',
  },
  {
    key: 'A08',
    title: 'Producción',
    desc: 'Planea cuánto vas a hacer.',
    path: '/herramienta/producciones',
    module: 'PRODUCTION',
  },
  {
    key: 'A09',
    title: 'Lista de compra',
    desc: 'Tu lista por tienda, también en el celular.',
    path: '/herramienta/lista',
    module: 'SHOPPING_LIST',
  },
  {
    key: 'A10',
    title: 'Registro de compras',
    desc: 'Guarda lo que compraste y cuánto pagaste.',
    path: '/herramienta/compras',
    module: 'PURCHASES',
  },
  {
    key: 'A11',
    title: 'Cotizador',
    desc: 'Arma una cotización para un pedido.',
    path: '/herramienta/cotizador',
    module: 'QUOTES',
  },
]

export const HELP_KEYS = HELP_TOPICS.map((t) => t.key)

export const helpTopic = (key: HelpKey) =>
  HELP_TOPICS.find((t) => t.key === key)!

// El video de la sección en la que está la alumna (listado o detalle), o null.
export function helpKeyForPath(pathname: string): HelpKey | null {
  const topic = HELP_TOPICS.find(
    (t) => t.path && (pathname === t.path || pathname.startsWith(`${t.path}/`)),
  )
  return topic?.key ?? null
}

// «1:05».
export function helpDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
