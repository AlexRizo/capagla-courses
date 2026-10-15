import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { ProGate } from '#/components/admin/pro-gate'
import { createCourse, getAdminCourses } from '#/lib/admin-courses'

export const Route = createFileRoute('/admin/cursos/')({
  loader: () => getAdminCourses(),
  component: Cursos,
})

const columns = 'flex items-center gap-3 px-5'
const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'

function Cursos() {
  const courses = Route.useLoaderData()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  async function create() {
    setCreating(true)
    try {
      const { slug } = await createCourse()
      await navigate({ to: '/admin/cursos/$slug', params: { slug } })
    } finally {
      setCreating(false)
    }
  }

  return (
    <ProGate>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
                Cursos
              </h1>
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Modo pro
              </span>
            </div>
            <div className="text-muted-foreground">
              El catálogo de cursos. El precio normal de cada uno se fija al
              crearlo o editarlo.
            </div>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="inline-flex h-9 cursor-pointer items-center rounded-md border-none bg-primary px-3.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            + Crear curso
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-xs">
          <div
            className={`${columns} rounded-t-lg bg-muted py-2.5 text-xs font-medium text-muted-foreground`}
          >
            <div className="flex-4">Curso</div>
            <div className="flex-2">Contenido</div>
            <div className="flex-2">Precio normal</div>
            <div className="flex-2">Alumnas</div>
            <div className="flex-1">Estado</div>
          </div>
          {courses.map((c) => (
            <Link
              key={c.id}
              to="/admin/cursos/$slug"
              params={{ slug: c.slug }}
              className={`${columns} border-t border-border py-3.5`}
            >
              <div className="flex-4 font-medium">{c.name}</div>
              <div className="flex-2 text-chart-3">{c.videos} videos</div>
              <div className="flex-2 font-medium">${c.priceMxn}</div>
              <div className="flex-2 text-chart-3">{c.students}</div>
              <div className="flex-1">
                <span className={pill}>
                  {c.published ? 'Publicado' : 'Borrador'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ProGate>
  )
}
