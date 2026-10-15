import { createFileRoute } from '@tanstack/react-router'

import { CourseLanding } from '#/components/course-landing'
import { getCourseLanding } from '#/lib/course-landing'

// Landing de venta de un curso por enlace simple: siempre al precio normal.
export const Route = createFileRoute('/cursos/$slug')({
  loader: ({ params }) => getCourseLanding({ data: { slug: params.slug } }),
  component: CursoPage,
})

function CursoPage() {
  return <CourseLanding page={Route.useLoaderData()} />
}
