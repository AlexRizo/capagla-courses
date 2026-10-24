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
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
import { createTag, getTags, removeTag } from '#/lib/tool-recipes'

export const Route = createFileRoute('/herramienta/etiquetas')({
  gcTime: 0,
  staleTime: 0,
  loader: () => getTags(),
  component: Etiquetas,
})

type Tag = Awaited<ReturnType<typeof getTags>>[number]

function Etiquetas() {
  const tags = Route.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Tag | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createTag({ data: { name } })
      setName('')
      await router.invalidate()
    } catch {
      setError('No se pudo agregar la etiqueta. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(tag: Tag) {
    setBusy(true)
    try {
      await removeTag({ data: { id: tag.id } })
      await router.invalidate()
    } catch {
      setError('No se pudo quitar la etiqueta. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <>
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Etiquetas</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Etiquetas para clasificar y filtrar tus recetas.
        </p>
      </div>

      <div className="flex max-w-220 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Etiquetas de receta</CardTitle>
            <CardDescription>
              Sirven solo para filtrar tus recetas: Pastel, Cupcake, Galleta… Al
              crear una receta escribes la etiqueta y te sugerimos las que ya
              tienes. El rendimiento no depende de ella: siempre se mide en
              piezas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Etiqueta</TableHead>
                    <TableHead className="w-32 text-right">Recetas</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-4">
                        <Badge variant="secondary">{t.name}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.recipes}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          aria-label={`Quitar ${t.name}`}
                          onClick={() => setRemoving(t)}
                        >
                          Quitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tags.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="px-4 py-6 text-muted-foreground"
                      >
                        Aún no tienes etiquetas. Se crean solas al escribirlas
                        en una receta, o agrégalas aquí.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <form onSubmit={add} className="flex flex-wrap items-end gap-3">
              <div className="flex w-75 max-w-full flex-col gap-1.5">
                <Label htmlFor="nueva-etiqueta">Nueva etiqueta de receta</Label>
                <Input
                  id="nueva-etiqueta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de la etiqueta"
                  maxLength={40}
                />
              </div>
              <Button type="submit" disabled={busy || !name.trim()}>
                Agregar etiqueta
              </Button>
            </form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Alert>
          <Info />
          <AlertTitle>Lo que está en uso no se borra</AlertTitle>
          <AlertDescription>
            Si una etiqueta ya la usan recetas, se archiva para que nada se
            rompa.
          </AlertDescription>
        </Alert>
      </div>

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && removing.recipes > 0
                ? `La usan ${removing.recipes} recetas: se archiva y ellas la conservan, pero ya no se sugiere.`
                : 'No la usa ninguna receta: se borra.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && void remove(removing)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
