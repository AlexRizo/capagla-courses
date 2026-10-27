import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  createPlace,
  deletePlace,
  getPlaces,
  updatePlace,
} from '#/lib/tool-places'

export const Route = createFileRoute('/herramienta/lugares')({
  // Sin caché: tras guardar, la lista y el formulario muestran siempre lo último (con caché, por
  // un instante saldrían los datos de antes, y un formulario podría abrirse con valores viejos).
  gcTime: 0,
  staleTime: 0,
  loader: () => getPlaces(),
  component: Lugares,
})

type Place = Awaited<ReturnType<typeof getPlaces>>[number]

function Lugares() {
  const places = Route.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Place | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createPlace({ data: { name } })
      setName('')
      await router.invalidate()
    } catch {
      setError('No se pudo agregar el lugar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">
          Lugares de compra
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Tiendas y proveedores.
        </p>
      </div>

      <div className="flex max-w-220 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lugares de compra</CardTitle>
            <CardDescription>
              Dónde compras tus cosas. Al crear un ingrediente eliges uno, y la
              lista de compra se separa sola por lugar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3 pl-4">Lugar</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {places.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4 font-medium">
                        {p.name}
                      </TableCell>
                      <TableCell>{p.note}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(p)}
                          aria-label={`Editar ${p.name}`}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {places.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="px-4 py-6 text-muted-foreground"
                      >
                        Aún no tienes lugares de compra.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <form onSubmit={add} className="flex flex-wrap items-end gap-3">
              <div className="flex w-65 max-w-full flex-col gap-1.5">
                <Label htmlFor="nuevo-lugar">Nuevo lugar</Label>
                <Input
                  id="nuevo-lugar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del lugar"
                  maxLength={60}
                />
              </div>
              <Button type="submit" disabled={busy || !name.trim()}>
                Agregar lugar
              </Button>
            </form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Alert>
          <Info />
          <AlertTitle>Ingredientes sin lugar</AlertTitle>
          <AlertDescription>
            Aparecen en la lista de compra como “Sin lugar asignado”. Desde ahí
            puedes arrastrarlos a donde los vayas a comprar ese día.
          </AlertDescription>
        </Alert>
      </div>

      {editing && (
        <EditPlace
          key={editing.id}
          place={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function EditPlace({ place, onClose }: { place: Place; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(place.name)
  const [note, setNote] = useState(place.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await router.invalidate()
      onClose()
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(() =>
                updatePlace({ data: { id: place.id, name, note } }),
              )
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Editar lugar</DialogTitle>
              <DialogDescription>
                Cambia su nombre o agrega una nota para acordarte.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lugar-nombre">Nombre</Label>
              <Input
                id="lugar-nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lugar-nota">Nota</Label>
              <Input
                id="lugar-nota"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
                placeholder="Opcional"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar lugar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy || !name.trim()}>
                  Guardar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{place.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {place.ingredients > 0
                ? `Sus ${place.ingredients} ingredientes no se borran: quedan sin lugar asignado.`
                : 'No tiene ingredientes asignados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(() => deletePlace({ data: { id: place.id } }))
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
