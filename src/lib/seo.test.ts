import { describe, expect, it } from 'vitest'

import { seo, siteUrlFrom } from '#/lib/seo'

const get = (meta: ReturnType<typeof seo>, key: string) =>
  meta.find(
    (m) =>
      ('name' in m && m.name === key) ||
      ('property' in m && m.property === key),
  )
const content = (meta: ReturnType<typeof seo>, key: string) =>
  (get(meta, key) as { content: string } | undefined)?.content

describe('seo', () => {
  it('agrega el nombre del sitio una sola vez e imagen absoluta', () => {
    const meta = seo({
      title: 'Aprende a Costear',
      image: '/images/x.jpg',
      path: '/cursos/x',
      base: 'https://capagla.com',
    })
    expect(meta[0]).toEqual({ title: 'Aprende a Costear · Capagla' })
    expect(content(meta, 'og:image')).toBe('https://capagla.com/images/x.jpg')
    expect(content(meta, 'og:url')).toBe('https://capagla.com/cursos/x')
    expect(get(meta, 'robots')).toBeUndefined()
    const home = seo({ title: 'Capagla · Cursos', base: '' })
    expect(home[0]).toEqual({ title: 'Capagla · Cursos' })
  })

  it('las páginas privadas llevan noindex', () => {
    const meta = seo({ title: 'Pago', base: '', noindex: true })
    expect(content(meta, 'robots')).toBe('noindex')
  })

  it('la URL del sitio sale del loader raíz', () => {
    expect(
      siteUrlFrom([{ loaderData: { siteUrl: 'https://capagla.com/' } }]),
    ).toBe('https://capagla.com')
    expect(siteUrlFrom([])).toBe('')
  })
})
