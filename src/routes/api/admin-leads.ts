import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '#/db'
import { LEAD_FILTERS, leadsWhere } from '#/lib/admin-sales'
import type { LeadFilter } from '#/lib/admin-sales'
import { readSession } from '#/lib/auth'
import { leadsCsv } from '#/lib/sales-rules'

// «Exportar CSV» de Leads (H34; solo admin): los leads del filtro y la búsqueda de la pantalla,
// listos para importarlos en Brevo (Contactos › Importar contactos).
export const Route = createFileRoute('/api/admin-leads')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readSession(request.headers)
        if (session?.user.role !== 'ADMIN') {
          return new Response('Not Found', { status: 404 })
        }
        const params = new URL(request.url).searchParams
        const raw = params.get('filtro') ?? 'todos'
        const filter: LeadFilter = (LEAD_FILTERS as readonly string[]).includes(
          raw,
        )
          ? (raw as LeadFilter)
          : 'todos'
        const q = (params.get('q') ?? '').slice(0, 100)
        const leads = await prisma.lead.findMany({
          where: leadsWhere(q, filter),
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: {
            email: true,
            createdAt: true,
            newsletterAt: true,
            attribution: true,
          },
        })
        const day = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Mexico_City',
        }).format(new Date())
        // BOM para que Excel lea bien los acentos.
        return new Response('﻿' + leadsCsv(leads), {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="leads-capagla-${filter}-${day}.csv"`,
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})
