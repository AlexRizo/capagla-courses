import { createServer } from 'node:http'
import type { Server } from 'node:http'

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { BunnyStorageError, createBunnyStorage } from '#/lib/bunny-storage'
import {
  readPrivateUpload,
  removeUpload,
  storeUpload,
  uploadsAvailable,
} from '#/lib/uploads'

// Bunny Storage contra un servidor falso que imita su API (PUT, GET y DELETE con `AccessKey`):
// aquí se comprueba dónde queda cada archivo, qué URL recibe y que la clave no se filtra.
// Nunca habla con Bunny real.
const KEY = 'clave-de-prueba-secreta'
const files = new Map<string, Buffer>()
const calls: { method: string; path: string; key: unknown }[] = []
let failWith: number | null = null

let server: Server
let origin = ''
beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0])
      calls.push({ method: req.method ?? '', path, key: req.headers.accesskey })
      if (req.headers.accesskey !== KEY) {
        res.statusCode = 401
        return res.end()
      }
      if (failWith) {
        res.statusCode = failWith
        return res.end()
      }
      if (req.method === 'PUT') {
        files.set(path, Buffer.concat(chunks))
        res.statusCode = 201
        return res.end('{}')
      }
      const file = files.get(path)
      if (!file) {
        res.statusCode = 404
        return res.end()
      }
      if (req.method === 'DELETE') files.delete(path)
      res.statusCode = 200
      res.end(req.method === 'GET' ? file : '{}')
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const a = server.address()
  origin = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`
})
afterAll(() => new Promise((r) => server.close(r)))
beforeEach(() => {
  files.clear()
  calls.length = 0
  failWith = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const CDN = 'https://capagla-uploads.b-cdn.net'
const storage = () =>
  createBunnyStorage({
    zone: 'capagla-storage',
    key: KEY,
    host: origin,
    cdnUrl: CDN,
  })

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 4, 5, 6])
const upload = (bytes: Uint8Array, name: string) =>
  new File([bytes as BlobPart], name)

describe('Bunny Storage: dirección de la zona', () => {
  it('acepta el host con o sin esquema y con o sin el nombre de la zona', async () => {
    const hosts = [
      origin,
      `${origin}/capagla-storage`,
      `${origin}/capagla-storage/`,
      origin.replace('http://', ''),
    ]
    for (const host of hosts) {
      calls.length = 0
      const s = createBunnyStorage({
        zone: 'capagla-storage',
        key: KEY,
        host: host.startsWith('127') ? `http://${host}` : host,
        cdnUrl: CDN,
      })
      await s.put('uploads/a.png', png)
      expect(calls).toEqual([
        { method: 'PUT', path: '/capagla-storage/uploads/a.png', key: KEY },
      ])
    }
  })

  it('la URL pública usa la Pull Zone, con o sin diagonal final', () => {
    const s = createBunnyStorage({
      zone: 'z',
      key: KEY,
      cdnUrl: `${CDN}/`,
    })
    expect(s.publicUrl('uploads/a.png')).toBe(`${CDN}/uploads/a.png`)
    expect(s.pathFromPublicUrl(`${CDN}/uploads/a.png`)).toBe('uploads/a.png')
    expect(s.pathFromPublicUrl('https://otro.com/uploads/a.png')).toBeNull()
  })
})

describe('subir archivos a Bunny Storage', () => {
  it('la portada va a uploads/ y su URL es pública por el CDN', async () => {
    const saved = await storeUpload(
      upload(png, 'portada.png'),
      'image',
      storage(),
    )
    expect(saved.url).toMatch(new RegExp(`^${CDN}/uploads/[0-9a-f-]+\\.png$`))
    expect(saved.name).toBe('portada.png')
    const path = `/capagla-storage/${saved.url.slice(CDN.length + 1)}`
    expect(files.get(path)).toEqual(Buffer.from(png))
  })

  it('un recurso va a recursos/ y su URL NO es pública: es la de la ruta con sesión', async () => {
    const saved = await storeUpload(
      upload(pdf, 'recetario.pdf'),
      'file',
      storage(),
    )
    expect(saved.url).toMatch(/^\/api\/recursos\/[0-9a-f-]+\.pdf$/)
    expect(saved.url).not.toContain(CDN)
    const stored = saved.url.slice('/api/recursos/'.length)
    expect(files.get(`/capagla-storage/recursos/${stored}`)).toEqual(
      Buffer.from(pdf),
    )
    expect(saved.name).toBe('recetario.pdf')
  })

  it('las reglas de formato y tamaño siguen igual y no tocan Bunny', async () => {
    await expect(
      storeUpload(
        upload(new Uint8Array([1, 2, 3]), 'a.svg'),
        'image',
        storage(),
      ),
    ).rejects.toThrow('Formato no permitido')
    // Un PDF no es portada.
    await expect(
      storeUpload(upload(pdf, 'a.pdf'), 'image', storage()),
    ).rejects.toThrow('Formato no permitido')
    expect(calls).toEqual([])
  })

  it('si Bunny falla, la subida falla y el error no lleva la clave', async () => {
    failWith = 500
    const error = await storeUpload(
      upload(png, 'portada.png'),
      'image',
      storage(),
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BunnyStorageError)
    expect(String(error)).toContain('HTTP 500')
    expect(String(error)).not.toContain(KEY)
  })

  it('con una clave equivocada Bunny responde 401 y no se guarda nada', async () => {
    const wrong = createBunnyStorage({
      zone: 'capagla-storage',
      key: 'otra',
      host: origin,
      cdnUrl: CDN,
    })
    await expect(
      storeUpload(upload(png, 'portada.png'), 'image', wrong),
    ).rejects.toThrow('HTTP 401')
    expect(files.size).toBe(0)
  })
})

describe('leer y borrar en Bunny Storage', () => {
  it('lee un recurso privado desde recursos/', async () => {
    const saved = await storeUpload(upload(pdf, 'a.pdf'), 'file', storage())
    const stored = saved.url.slice('/api/recursos/'.length)
    expect(await readPrivateUpload(stored, storage())).toEqual(Buffer.from(pdf))
  })

  it('un recurso que no existe da null; un nombre raro ni siquiera se pide', async () => {
    expect(
      await readPrivateUpload(
        '00000000-0000-0000-0000-000000000000.pdf',
        storage(),
      ),
    ).toBeNull()
    calls.length = 0
    expect(await readPrivateUpload('../../etc/passwd', storage())).toBeNull()
    expect(calls).toEqual([])
  })

  it('un recurso solo se lee de recursos/, no de uploads/ (las portadas no se sirven por ahí)', async () => {
    const saved = await storeUpload(upload(png, 'p.png'), 'image', storage())
    const stored = saved.url.split('/').pop()!
    expect(await readPrivateUpload(stored, storage())).toBeNull()
  })

  it('borra la portada y el recurso, y se olvida de lo que no es nuestro', async () => {
    const cover = await storeUpload(upload(png, 'p.png'), 'image', storage())
    const resource = await storeUpload(upload(pdf, 'a.pdf'), 'file', storage())
    expect(files.size).toBe(2)

    await removeUpload('/images/postres-navidad.jpg', storage())
    await removeUpload('https://otro.com/uploads/a.png', storage())
    await removeUpload(`${CDN}/uploads/../recursos/x.pdf`, storage())
    await removeUpload(null, storage())
    expect(files.size).toBe(2)
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([])

    await removeUpload(cover.url, storage())
    await removeUpload(resource.url, storage())
    expect(files.size).toBe(0)
  })

  it('si el borrado falla en Bunny no rompe: solo se registra, sin la clave', async () => {
    const cover = await storeUpload(upload(png, 'p.png'), 'image', storage())
    failWith = 500
    await expect(removeUpload(cover.url, storage())).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      KEY,
    )
  })
})

describe('uploadsAvailable', () => {
  it('con Bunny siempre; sin Bunny, solo fuera de producción', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(uploadsAvailable(storage())).toBe(true)
    expect(uploadsAvailable(null)).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    expect(uploadsAvailable(null)).toBe(true)
    vi.unstubAllEnvs()
  })
})
