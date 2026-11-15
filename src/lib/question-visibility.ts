import type { Prisma, QuestionStatus } from '@prisma/client'

// Las preguntas de una lección (H28, 2026-11-15; antes, desde el 2026-10-31, también eran públicas
// las que solo contestó el asistente): las demás alumnas con acceso ven solo las que **respondió la
// chef**, con el primer nombre de quien preguntó, como dice el aviso de privacidad. Lo que espera a
// la chef y lo que solo contestó el asistente lo ve únicamente quien lo hizo. Las ocultas no las ve
// nadie. La vista previa (clase gratis) solo muestra lo que respondió la chef.
export function visibleQuestionsWhere(
  itemId: string,
  userId: string,
  preview: boolean,
): Prisma.LessonQuestionWhereInput {
  return {
    itemId,
    OR: [
      { status: 'ANSWERED' },
      ...(preview
        ? []
        : [
            { status: 'PENDING' as const, userId },
            { status: 'ASSISTANT' as const, userId },
          ]),
    ],
  }
}

// Qué preguntas van en "Preguntas de esta lección". Las propias que solo contestó el asistente
// van aparte, en su historial (con el voto y "Preguntarle a la chef").
export const inPublicList = (
  q: { status: QuestionStatus; userId: string },
  userId: string,
) => q.status !== 'ASSISTANT' || q.userId !== userId
