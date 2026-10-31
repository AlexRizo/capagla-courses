// Niveles de la herramienta de costos (respuestas de la chef, 2026-10-27): qué módulos abre cada
// uno y cuántos elementos se pueden guardar. Solo reglas, sin base de datos: las usan el servidor,
// el menú y el panel.

export const TOOL_MODULES = [
  'PRODUCTION',
  'SHOPPING_LIST',
  'PURCHASES',
  'QUOTES',
] as const
export type ToolModuleKey = (typeof TOOL_MODULES)[number]

export const MODULE_LABEL: Record<ToolModuleKey, string> = {
  PRODUCTION: 'Producción',
  SHOPPING_LIST: 'Lista de compra',
  PURCHASES: 'Registro de compras',
  QUOTES: 'Cotizador',
}

export type ToolTierInfo = {
  // Nombre del producto (para mostrarlo).
  name: string
  rank: number
  itemLimit: number
  quoteDays: number
  modules: ToolModuleKey[]
}

// Un producto de herramienta sin nivel (o la administradora) lo tiene todo.
export const FULL_TIER: ToolTierInfo = {
  name: 'Completo',
  rank: 2,
  itemLimit: 1000,
  quoteDays: 90,
  modules: [...TOOL_MODULES],
}

export const ADMIN_TIER: ToolTierInfo = {
  ...FULL_TIER,
  name: 'Administradora',
  rank: 99,
  itemLimit: 1_000_000,
}

export const hasModule = (tier: ToolTierInfo, module: ToolModuleKey) =>
  tier.modules.includes(module)

// De las inscripciones vigentes de la alumna, cuenta el nivel más alto.
export function bestTier(tiers: ToolTierInfo[]) {
  return tiers.reduce<ToolTierInfo | null>(
    (best, t) => (!best || t.rank > best.rank ? t : best),
    null,
  )
}

export const atLimit = (used: number, tier: ToolTierInfo) =>
  used >= tier.itemLimit

export const limitMessage = (tier: ToolTierInfo) =>
  `Llegaste al límite de ${tier.itemLimit} elementos de tu nivel. Borra o archiva algo, o cambia de nivel para guardar más.`

// Un nivel más alto debe costar más que el de abajo: la mejora cobra la diferencia y Stripe no
// cobra $0. `tiers` trae todos los niveles con el precio ya cambiado; devuelve el motivo o null.
export function priceOrderError(
  tiers: { name: string; rank: number; priceMxn: number }[],
) {
  const sorted = [...tiers].sort((a, b) => a.rank - b.rank)
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1]
    const higher = sorted[i]
    if (higher.rank > lower.rank && higher.priceMxn <= lower.priceMxn) {
      return `${higher.name} debe costar más que ${lower.name} ($${lower.priceMxn}): la mejora cobra la diferencia y no puede ser $0.`
    }
  }
  return null
}
