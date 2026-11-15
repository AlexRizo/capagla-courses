// Título, descripción e imagen para compartir de cada página (H20). Las landings se comparten por
// WhatsApp y redes: sin `og:*` la vista previa sale vacía. Las imágenes van con URL absoluta.

export const SITE_NAME = 'Capagla'
export const DEFAULT_DESCRIPTION =
  'Cursos de repostería en línea con la chef Gladis: postres para vender, cómo costearlos y la herramienta de costos.'
export const DEFAULT_IMAGE = '/images/gladis-postres.jpg'

type Match = { loaderData?: unknown }

// La URL pública del sitio (la entrega el loader raíz; `matches[0]` es la raíz).
export function siteUrlFrom(matches: readonly Match[]) {
  const root = matches[0]?.loaderData as { siteUrl?: string } | undefined
  return (root?.siteUrl ?? '').replace(/\/$/, '')
}

const absolute = (base: string, path: string) =>
  /^https?:\/\//.test(path) ? path : `${base}${path}`

// «Postres para vender en Navidad · Capagla». Una página privada lleva `noindex`.
export function seo(input: {
  title: string
  description?: string
  image?: string | null
  path?: string
  base: string
  noindex?: boolean
}) {
  const title = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} · ${SITE_NAME}`
  const description = (input.description ?? DEFAULT_DESCRIPTION)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
  const image = absolute(input.base, input.image || DEFAULT_IMAGE)
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'es_MX' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    ...(input.path
      ? [{ property: 'og:url', content: absolute(input.base, input.path) }]
      : []),
    { name: 'twitter:card', content: 'summary_large_image' },
    ...(input.noindex ? [{ name: 'robots', content: 'noindex' }] : []),
  ]
}
