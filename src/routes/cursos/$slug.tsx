import { createFileRoute } from '@tanstack/react-router'

import { CourseLanding } from '#/components/course-landing'
import { getCourseLanding } from '#/lib/course-landing'
import { seo, siteUrlFrom } from '#/lib/seo'

// Landing de venta de un curso por enlace simple: siempre al precio normal.
export const Route = createFileRoute('/cursos/$slug')({
  loader: ({ params }) => getCourseLanding({ data: { slug: params.slug } }),
  head: ({ loaderData, matches, params }) => ({
    meta: seo({
      title: loaderData?.title ?? 'Curso',
      description: loaderData?.intro,
      image: loaderData?.heroImage,
      path: `/cursos/${params.slug}`,
      base: siteUrlFrom(matches),
    }),
  }),
  component: CursoPage,
})

function CursoPage() {
  return <CourseLanding page={Route.useLoaderData()} />
}
