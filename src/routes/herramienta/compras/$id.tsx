import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
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
import { deletePurchase, getPurchase } from '#/lib/tool-purchases'
import { cn } from '#/lib/utils'
import { HelpButton } from '#/components/tool/tool-help'

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

// Una compra ya registrada: sus precios ya se aplicaron. Se puede corregir o borrar (H42).
function Compra() {
  const purchase = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = purchase.items.reduce((sum, i) => sum + i.price, 0)
  const reverts = purchase.items.filter((i) => i.revertTo !== null)

  async function remove() {
    setError(null)
    try {
      const result = await deletePurchase({ data: { id: purchase.id } })
      if (result.error) return setError(result.error)
      await router.invalidate()
      await navigate({ to: '/herramienta/compras' })
    } catch {
      setError('No se pudo borrar. Inténtalo de nuevo.')
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            Compra del {formatDay(purchase.date)}
            <HelpButton />
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {purchase.placeName ?? 'Sin tienda'} ·{' '}
            {purchase.items.length === 1
              ? '1 ingrediente'
              : `${purchase.items.length} ingredientes`}{' '}
            · Total pagado {formatPrice(total)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/herramienta/compras">‹ Todas las compras</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              to="/herramienta/compras/$id/editar"
              params={{ id: purchase.id }}
            >
              Corregir
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setConfirm(true)}>
            Borrar compra
          </Button>
        </div>
      </div>
      {error && <p className="m-0 text-sm text-destructive">{error}</p>}
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
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Borrar la compra del {formatDay(purchase.date)}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {reverts.length === 0 ? (
                  <p className="m-0">
                    Se quita de tu historial. Los precios de tus ingredientes no
                    cambian: ya no vienen de esta compra.
                  </p>
                ) : (
                  <>
                    <p className="m-0">
                      Se quita de tu historial y estos precios vuelven a lo que
                      costaban antes:
                    </p>
                    <ul className="m-0 flex flex-col gap-1 pl-5">
                      {reverts.map((i) => (
                        <li key={i.id}>
                          {i.name}: {formatPrice(i.price)} →{' '}
                          {formatPrice(i.revertTo!)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              Borrar compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
