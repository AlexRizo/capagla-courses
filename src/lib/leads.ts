import type { Prisma } from '@prisma/client'

import { prisma } from '#/db'

// Registro de la clase gratis (H22): aviso de privacidad obligatorio (`consentAt`) y novedades
// opcionales (`newsletterAt`). La primera atribución y la primera fecha de novedades no se pisan;
// no marcar novedades después no quita lo que ya había aceptado.
export async function saveLead(input: {
  email: string
  userId: string
  newsletter: boolean
  attribution?: Prisma.InputJsonValue
  marketingConsent?: boolean
}) {
  const lead = await prisma.lead.findUnique({ where: { email: input.email } })
  if (!lead) {
    return prisma.lead.create({
      data: {
        email: input.email,
        userId: input.userId,
        consentAt: new Date(),
        newsletterAt: input.newsletter ? new Date() : null,
        attribution: input.attribution,
        marketingConsent: input.marketingConsent,
      },
    })
  }
  if (input.newsletter && !lead.newsletterAt) {
    return prisma.lead.update({
      where: { id: lead.id },
      data: { newsletterAt: new Date() },
    })
  }
  return lead
}
