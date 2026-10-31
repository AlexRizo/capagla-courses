import type { Prisma, QuestionStatus } from '@prisma/client'

// Las preguntas de una lección son públicas (decisión del cliente, 2026-10-31): las ven todas las
// alumnas con acceso, con la pregunta, el primer nombre de quien preguntó y la respuesta (de la
// chef y/o del asistente). Lo que aún no tiene respuesta (esperando a la chef) y lo que el
// asistente no pudo contestar solo lo ve quien lo hizo. Las ocultas no las ve nadie. La vista
// previa (clase gratis) solo muestra lo que respondió la chef.
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
            // La respuesta del asistente a la pregunta de otra alumna.
            { status: 'ASSISTANT' as const, assistantAnswer: { not: null } },
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
