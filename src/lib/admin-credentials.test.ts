import { describe, expect, it } from 'vitest'

import { adminCredentials } from '../../prisma/admin-credentials'

const local = 'postgresql://capagla:x@localhost:4324/capagla'
const remote = 'postgresql://postgres:x@postgres.railway.internal:5432/railway'

describe('adminCredentials', () => {
  it('con la base local usa las de desarrollo', () => {
    expect(adminCredentials({ DATABASE_URL: local })).toEqual({
      email: 'dev@alowee.com',
      name: 'Admin',
      password: 'Passwd123+',
      local: true,
    })
    for (const host of ['127.0.0.1', '[::1]']) {
      expect(
        adminCredentials({ DATABASE_URL: `postgresql://u:p@${host}:5432/db` })
          .local,
      ).toBe(true)
    }
  })

  it('en local se pueden definir las propias', () => {
    const c = adminCredentials({
      DATABASE_URL: local,
      ADMIN_EMAIL: ' yo@capagla.com ',
      ADMIN_PASSWORD: 'otra-clave',
    })
    expect(c).toMatchObject({ email: 'yo@capagla.com', password: 'otra-clave' })
  })

  it('con otra base exige correo y contraseña de al menos 12 caracteres', () => {
    expect(() => adminCredentials({ DATABASE_URL: remote })).toThrow(
      /ADMIN_EMAIL/,
    )
    expect(() =>
      adminCredentials({ DATABASE_URL: remote, ADMIN_EMAIL: 'a@b.com' }),
    ).toThrow(/ADMIN_PASSWORD/)
    expect(() =>
      adminCredentials({
        DATABASE_URL: remote,
        ADMIN_EMAIL: 'a@b.com',
        ADMIN_PASSWORD: 'corta-11-ch',
      }),
    ).toThrow(/12/)
    expect(() =>
      adminCredentials({
        DATABASE_URL: remote,
        ADMIN_PASSWORD: 'una-clave-larga-1',
      }),
    ).toThrow(/ADMIN_EMAIL/)
  })

  it('con otra base y las variables bien definidas las usa, nunca las de desarrollo', () => {
    const c = adminCredentials({
      DATABASE_URL: remote,
      ADMIN_EMAIL: 'chef@capagla.com',
      ADMIN_PASSWORD: 'una-clave-larga-1',
    })
    expect(c).toEqual({
      email: 'chef@capagla.com',
      name: 'Admin',
      password: 'una-clave-larga-1',
      local: false,
    })
  })

  it('una URL que solo menciona localhost en la contraseña no cuenta como local', () => {
    expect(() =>
      adminCredentials({
        DATABASE_URL: 'postgresql://u:pw@localhost.evil.com:5432/db',
      }),
    ).toThrow()
    expect(() =>
      adminCredentials({
        DATABASE_URL: 'postgresql://u:@host.com/db?x=@localhost:',
      }),
    ).toThrow()
  })

  it('sin DATABASE_URL se trata como no local', () => {
    expect(() => adminCredentials({})).toThrow()
  })
})
