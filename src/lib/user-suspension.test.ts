import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { withLinkPurpose } from '#/lib/mailer'
import { resetDb } from '#/test/db'

beforeEach(resetDb)

async function newUser(email: string, role: 'ADMIN' | 'STUDENT' = 'STUDENT') {
  const ctx = await auth.$context
  return ctx.internalAdapter.createUser(
    { email, name: 'Prueba', emailVerified: false, role },
    { method: 'admin' },
  )
}

describe('crear usuario desde el panel', () => {
  it('guarda el rol que se pidió (administrador o alumna)', async () => {
    const admin = await newUser('admin@test.com', 'ADMIN')
    const student = await newUser('alumna@test.com')
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role,
    ).toBe('ADMIN')
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).role,
    ).toBe('STUDENT')
  })
})

// Una cuenta suspendida no abre sesión por ningún camino: todos pasan por crear la sesión.
describe('cuenta suspendida', () => {
  it('una cuenta activa abre sesión', async () => {
    const user = await newUser('activa@test.com')
    const ctx = await auth.$context
    const session = await ctx.internalAdapter.createSession(user.id)
    expect(session.userId).toBe(user.id)
  })

  it('una suspendida no puede abrir sesión', async () => {
    const user = await newUser('suspendida@test.com')
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date() },
    })
    const ctx = await auth.$context
    await expect(ctx.internalAdapter.createSession(user.id)).rejects.toThrow(
      /suspendida/,
    )
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })

  it('el enlace de acceso de una suspendida no abre sesión', async () => {
    const user = await newUser('enlace@test.com')
    let url = ''
    await withLinkPurpose({ kind: 'capture', onLink: (u) => (url = u) }, () =>
      auth.api.signInMagicLink({
        body: { email: user.email, callbackURL: '/mis-cursos' },
        headers: new Headers(),
      }),
    )
    const token = new URL(url).searchParams.get('token')!
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date() },
    })
    await expect(
      auth.api.magicLinkVerify({
        query: { token },
        headers: new Headers(),
        asResponse: false,
      }),
    ).rejects.toThrow()
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })

  it('al reactivarla vuelve a poder entrar', async () => {
    const user = await newUser('vuelve@test.com')
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date() },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: null },
    })
    const ctx = await auth.$context
    expect((await ctx.internalAdapter.createSession(user.id)).userId).toBe(
      user.id,
    )
  })
})
