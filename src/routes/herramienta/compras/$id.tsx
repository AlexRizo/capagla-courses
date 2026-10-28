import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { requireToolPage } from '#/lib/tool-access'
import { changeLabel, formatDay, priceChange } from '#/lib/cost-purchases'
import { UNITS, formatPrice, formatQuantity } from '#/lib/costs'
import { getPurchase } from '#/lib/tool-purchases'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/herramienta/compras/$id')({
  beforeLoad: () => requireToolPage('PURCHASES'),
  gcTime: 0,
  staleTime: 0,
  loader: ({ params }) => getPurchase({ data: { id: params.id } }),
  component: Compra,
})

const TONE = {
  UP: 'text-warning',
  DOWN: 'text-success',
  SAME: 'text-muted-foreground',
  NEW: 'text-muted-foreground',
} as const

// Una compra ya registrada, solo para consultarla: sus precios ya se aplicaron.
function Compra() {
  const purchase = Route.useLoaderData()
  const total = purchase.items.reduce((sum, i) => sum + i.price, 0)
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            Compra del {formatDay(purchase.date)}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {purchase.placeName ?? 'Sin tienda'} ·{' '}
            {purchase.items.length === 1
              ? '1 ingrediente'
              : `${purchase.items.length} ingredientes`}{' '}
            · Total pagado {formatPrice(total)}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/herramienta/compras">‹ Todas las compras</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-160 tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Ingrediente</TableHead>
                <TableHead className="text-right">Precio anterior</TableHead>
                <TableHead className="text-right">Pagaste</TableHead>
                <TableHead className="pr-4">Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((i) => {
                const change = priceChange(i.previousPrice, i.price)
                return (
                  <TableRow key={i.id}>
                    <TableCell className="py-3 pl-4">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-sm text-muted-foreground">
                        por {formatQuantity(i.quantity)} {UNITS[i.unit].label}
                        {i.packGrams
                          ? ` · pesaron ${formatQuantity(i.packGrams)} g`
                          : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(i.previousPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(i.price)}
                    </TableCell>
                    <TableCell
                      className={cn('pr-4 font-medium', TONE[change.kind])}
                    >
                      {changeLabel(change)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
