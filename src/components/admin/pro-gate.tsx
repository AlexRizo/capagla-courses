import { useAdmin } from '#/components/admin/admin-layout'

// Las secciones del modo pro solo se muestran con el interruptor encendido.
export function ProGate({ children }: { children: React.ReactNode }) {
  const { pro } = useAdmin()
  if (pro) return children

  return (
    <div className="p-6">
      <div className="flex max-w-130 flex-col gap-1.5 rounded-lg border border-border bg-muted p-5">
        <div className="text-base font-semibold">
          Esta sección es del modo pro
        </div>
        <div className="leading-normal text-muted-foreground">
          Actívalo con el interruptor de arriba a la derecha para ver y editar
          esta sección.
        </div>
      </div>
    </div>
  )
}
