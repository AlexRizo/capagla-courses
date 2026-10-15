import { Prisma } from '@prisma/client'
import type { CourseItem } from '@prisma/client'
import type { JSONContent } from '@tiptap/react'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { normalizeParts, parseDuration } from '#/lib/duration'
import { requireAdmin } from '#/lib/guards'
import { resolveMove } from '#/lib/course-tree'
import { parseRichText } from '#/lib/rich-text'

// Listado de cursos del panel: curso, videos, precio, alumnas y estado.
export const getAdminCourses = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => {
    const [courses, videos] = await Promise.all([
      prisma.product.findMany({
        where: { kind: 'COURSE' },
        include: { _count: { select: { enrollments: true } } },
        orderBy: [{ status: 'desc' }, { name: 'asc' }],
      }),
      prisma.courseItem.groupBy({
        by: ['productId'],
        where: { kind: 'LESSON', lessonType: 'VIDEO' },
        _count: true,
      }),
    ])
    const videosByCourse = new Map(videos.map((v) => [v.productId, v._count]))

    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      videos: videosByCourse.get(c.id) ?? 0,
      priceMxn: c.priceMxn,
      students: c._count.enrollments,
      published: c.status === 'PUBLISHED',
    }))
  })

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

const minutes = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

// Árbol del curso aplanado en orden de lectura, con la sangría (`level`) y los
// textos de la maqueta: tipo ("Bloque", "Video"...) y a la derecha cantidad o duración.
function flatten(items: CourseItem[]) {
  const byParent = new Map<string | null, CourseItem[]>()
  for (const i of items) {
    byParent.set(i.parentId, [...(byParent.get(i.parentId) ?? []), i])
  }
  const kids = (id: string) => byParent.get(id) ?? []

  const rows: {
    id: string
    level: number
    kind: 'BLOCK' | 'CHAPTER' | 'LESSON'
    title: string
    isFree: boolean
    published: boolean
    recipe: JSONContent | null
    lessonType: 'VIDEO' | 'TEXT' | null
    videoUrl: string | null
    durationSec: number | null
    body: JSONContent | null
    notes: string | null
    videoParts: string | null
    type: string
    meta: string
  }[] = []

  function visit(parentId: string | null, level: number) {
    for (const i of byParent.get(parentId) ?? []) {
      const lessons = kids(i.id).filter((k) => k.kind === 'LESSON').length
      const chapters = kids(i.id).filter((k) => k.kind === 'CHAPTER').length
      let meta = ''
      if (i.kind === 'BLOCK') {
        meta = [
          chapters ? plural(chapters, 'capítulo', 'capítulos') : '',
          lessons ? plural(lessons, 'lección', 'lecciones') : '',
        ]
          .filter(Boolean)
          .join(' · ')
        if (i.isFree) meta += meta ? ' · Gratis' : 'Gratis'
      } else if (i.kind === 'CHAPTER') {
        meta = plural(lessons, 'lección', 'lecciones')
      } else {
        meta =
          i.lessonType === 'VIDEO' && i.durationSec
            ? minutes(i.durationSec)
            : '—'
      }
      const type =
        i.kind === 'BLOCK'
          ? 'Bloque'
          : i.kind === 'CHAPTER'
            ? 'Capítulo'
            : i.lessonType === 'TEXT'
              ? 'Texto'
              : 'Video'
      rows.push({
        id: i.id,
        level,
        kind: i.kind,
        title: i.title,
        isFree: i.isFree,
        published: i.status === 'PUBLISHED',
        recipe: i.kind === 'CHAPTER' ? (i.recipe as JSONContent | null) : null,
        lessonType: i.lessonType,
        videoUrl: i.videoUrl,
        durationSec: i.durationSec,
        body: i.kind === 'LESSON' ? (i.body as JSONContent | null) : null,
        notes: i.notes,
        videoParts: i.videoParts,
        type,
        meta,
      })
      visit(i.id, level + 1)
    }
  }
  visit(null, 0)
  return rows
}

// Editor de un curso: nombre y árbol de contenido.
export const getAdminCourse = createServerFn()
  .middleware([requireAdmin])
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const course = await prisma.product.findUnique({
      where: { slug: data.slug },
      include: {
        items: { orderBy: { position: 'asc' } },
      },
    })
    if (course?.kind !== 'COURSE') throw notFound()
    return {
      name: course.name,
      settings: {
        name: course.name,
        description: course.description ?? '',
        priceMxn: course.priceMxn,
        accessDays: course.accessDays,
        published: course.status === 'PUBLISHED',
      },
      items: flatten(course.items),
    }
  })

// "Ajustes del curso": título, descripción, precio normal, días de acceso y estado.
// La portada se agrega con la subida de archivos.
export const updateCourseSettings = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      slug: z.string(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(300),
      priceMxn: z.coerce.number().int().min(0).max(1_000_000),
      accessDays: z.coerce.number().int().min(1).max(3650),
      published: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { slug, published, description, ...rest } = data
    await prisma.product.update({
      where: { slug, kind: 'COURSE' },
      data: {
        ...rest,
        description: description || null,
        status: published ? 'PUBLISHED' : 'DRAFT',
      },
    })
  })

// Un bloque solo lleva nombre y si es gratis (visible sin comprar).
export const updateBlock = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1).max(120),
      isFree: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    await prisma.courseItem.update({ where: { id, kind: 'BLOCK' }, data: rest })
  })

// Un capítulo lleva nombre y la receta (texto enriquecido compartido por sus lecciones).
export const updateChapter = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1).max(120),
      recipe: z.unknown(),
    }),
  )
  .handler(async ({ data }) => {
    const recipe = parseRichText(data.recipe)
    await prisma.courseItem.update({
      where: { id: data.id, kind: 'CHAPTER' },
      data: { title: data.title, recipe: recipe ?? Prisma.DbNull },
    })
  })

// Lección: título, tipo, video (URL en texto, duración y partes) o texto enriquecido,
// y notas (de cualquier tipo).
// Del tipo que no se elige no se borra nada: se conserva por si se vuelve a él.
export const updateLesson = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1).max(120),
      lessonType: z.enum(['VIDEO', 'TEXT']),
      videoUrl: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === '' || /^https?:\/\//.test(v)),
      duration: z
        .string()
        .trim()
        .refine((v) => v === '' || parseDuration(v) !== null),
      body: z.unknown(),
      notes: z.string().trim().max(5000),
      videoParts: z.string().refine((v) => normalizeParts(v) !== null),
    }),
  )
  .handler(async ({ data }) => {
    const base = {
      title: data.title,
      lessonType: data.lessonType,
      notes: data.notes || null,
    }
    const content =
      data.lessonType === 'VIDEO'
        ? {
            videoUrl: data.videoUrl || null,
            durationSec: data.duration ? parseDuration(data.duration) : null,
            videoParts: normalizeParts(data.videoParts) || null,
          }
        : { body: parseRichText(data.body) ?? Prisma.DbNull }
    await prisma.courseItem.update({
      where: { id: data.id, kind: 'LESSON' },
      data: { ...base, ...content },
    })
  })

const NEW_TITLES = {
  BLOCK: 'Nuevo bloque',
  CHAPTER: 'Nuevo capítulo',
  LESSON: 'Nueva lección',
} as const

// Agrega un elemento al final del lugar que le corresponde según lo seleccionado
// (el cliente solo dice qué tipo y qué está seleccionado; el servidor decide el padre):
//  - bloque: al final del curso;
//  - capítulo: en el bloque del elemento seleccionado (o en el último bloque);
//  - lección: en el capítulo seleccionado, junto a la lección seleccionada, o en el
//    bloque seleccionado (o en el último bloque).
// Los elementos nuevos nacen publicados: lo público o borrador es el curso entero.
export const createCourseItem = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      slug: z.string(),
      kind: z.enum(['BLOCK', 'CHAPTER', 'LESSON']),
      selectedId: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const course = await prisma.product.findUnique({
      where: { slug: data.slug },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (course?.kind !== 'COURSE') throw notFound()

    const items = course.items
    const byId = new Map(items.map((i) => [i.id, i]))
    const selected = data.selectedId ? byId.get(data.selectedId) : undefined
    const blocks = items.filter((i) => i.kind === 'BLOCK')
    const blockOf = (item: CourseItem | undefined) => {
      let current = item
      while (current && current.kind !== 'BLOCK') {
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
      return current ?? blocks.at(-1)
    }

    let parentId: string | null = null
    if (data.kind === 'CHAPTER') {
      parentId = blockOf(selected)?.id ?? null
    } else if (data.kind === 'LESSON') {
      parentId =
        selected?.kind === 'CHAPTER'
          ? selected.id
          : selected?.kind === 'LESSON'
            ? selected.parentId
            : (blockOf(selected)?.id ?? null)
    }
    if (data.kind !== 'BLOCK' && !parentId) {
      return { error: 'Primero crea un bloque.' }
    }

    const siblings = items.filter((i) => i.parentId === parentId)
    const created = await prisma.courseItem.create({
      data: {
        productId: course.id,
        parentId,
        kind: data.kind,
        position: Math.max(-1, ...siblings.map((s) => s.position)) + 1,
        title: NEW_TITLES[data.kind],
        lessonType: data.kind === 'LESSON' ? 'VIDEO' : null,
      },
    })
    return { id: created.id }
  })

// Elimina un elemento y, en cascada, todo lo que cuelga de él.
export const deleteCourseItem = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await prisma.courseItem.delete({ where: { id: data.id } })
  })

// "+ Crear curso": curso vacío en borrador, con precio 0 y 365 días de acceso, que se
// termina de llenar en el editor. Devuelve el slug para abrirlo.
export const createCourse = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .handler(async () => {
    const base = 'curso-nuevo'
    const taken = new Set(
      (
        await prisma.product.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((p) => p.slug),
    )
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`

    await prisma.product.create({
      data: { slug, name: 'Curso nuevo', kind: 'COURSE', priceMxn: 0 },
    })
    return { slug }
  })

// Arrastrar para ordenar: mueve `id` sobre `overId` (reglas en `resolveMove`).
// El servidor decide el destino, lo valida y renumera los hermanos.
export const moveCourseItem = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({ id: z.string(), overId: z.string(), after: z.boolean() }),
  )
  .handler(async ({ data }) => {
    const item = await prisma.courseItem.findUnique({ where: { id: data.id } })
    if (!item) throw notFound()
    const items = await prisma.courseItem.findMany({
      where: { productId: item.productId },
      orderBy: { position: 'asc' },
    })

    const placement = resolveMove(items, data.id, data.overId, data.after)
    if (!placement) return

    const siblings = items.filter(
      (i) => i.parentId === placement.parentId && i.id !== item.id,
    )
    let index = 0
    if (placement.mode !== 'first') {
      const at = siblings.findIndex((s) => s.id === placement.anchorId)
      index = placement.mode === 'before' ? at : at + 1
    }
    const order = [...siblings.slice(0, index), item, ...siblings.slice(index)]

    await prisma.$transaction(
      order.map((o, position) =>
        prisma.courseItem.update({
          where: { id: o.id },
          data:
            o.id === item.id
              ? { position, parentId: placement.parentId }
              : { position },
        }),
      ),
    )
  })

// Convertir capítulo ↔ lección. Solo cambia el tipo; lo que ya se escribió se conserva.
//  - capítulo → lección: únicamente si no tiene lecciones dentro;
//  - lección → capítulo: únicamente si está directamente en un bloque (no dentro de un capítulo).
export const convertCourseItem = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string(), to: z.enum(['CHAPTER', 'LESSON']) }))
  .handler(async ({ data }) => {
    const item = await prisma.courseItem.findUnique({
      where: { id: data.id },
      include: { parent: true, _count: { select: { children: true } } },
    })
    if (!item) throw notFound()

    if (data.to === 'LESSON') {
      if (item.kind !== 'CHAPTER') return { error: 'No es un capítulo.' }
      if (item._count.children > 0) {
        return { error: 'Primero mueve o elimina sus lecciones.' }
      }
      await prisma.courseItem.update({
        where: { id: item.id },
        data: { kind: 'LESSON', lessonType: item.lessonType ?? 'VIDEO' },
      })
    } else {
      if (item.kind !== 'LESSON') return { error: 'No es una lección.' }
      if (item.parent?.kind !== 'BLOCK') {
        return {
          error:
            'Solo una lección que está directo en un bloque puede ser capítulo.',
        }
      }
      await prisma.courseItem.update({
        where: { id: item.id },
        data: { kind: 'CHAPTER' },
      })
    }
    return { ok: true }
  })
