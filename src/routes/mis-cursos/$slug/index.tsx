import { createFileRoute, redirect } from '@tanstack/react-router'

import { getResumeLesson } from '#/lib/player'

// /mis-cursos/<curso>: lleva a donde se quedó la alumna (la primera lección sin ver).
export const Route = createFileRoute('/mis-cursos/$slug/')({
  beforeLoad: async ({ params }) => {
    const { lessonId } = await getResumeLesson({ data: { slug: params.slug } })
    if (!lessonId) throw redirect({ to: '/mis-cursos' })
    throw redirect({
      to: '/mis-cursos/$slug/$lessonId',
      params: { slug: params.slug, lessonId },
    })
  },
})
