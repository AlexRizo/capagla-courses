import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { prisma } from '#/db'
import { requireAdmin } from '#/lib/guards'

const value = z.string().trim().max(500)

const fields = z.object({
  metaPixelId: value,
  metaToken: value,
  metaTestCode: value,
  tiktokPixelId: value,
  tiktokToken: value,
  tiktokTestCode: value,
  ga4MeasurementId: value,
})

export type MarketingFields = z.infer<typeof fields>

// Datos de conexión de las plataformas (vacíos si nunca se han guardado).
export const getMarketingSettings = createServerFn()
  .middleware([requireAdmin])
  .handler(async (): Promise<MarketingFields> => {
    const row = await prisma.marketingSettings.findUnique({
      where: { id: 'main' },
    })
    return {
      metaPixelId: row?.metaPixelId ?? '',
      metaToken: row?.metaToken ?? '',
      metaTestCode: row?.metaTestCode ?? '',
      tiktokPixelId: row?.tiktokPixelId ?? '',
      tiktokToken: row?.tiktokToken ?? '',
      tiktokTestCode: row?.tiktokTestCode ?? '',
      ga4MeasurementId: row?.ga4MeasurementId ?? '',
    }
  })

export const saveMarketingSettings = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(fields)
  .handler(async ({ data }) => {
    await prisma.marketingSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...data },
      update: data,
    })
  })
