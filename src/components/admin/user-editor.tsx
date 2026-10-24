import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  field,
  input,
  label,
  primaryButton,
} from '#/components/admin/form-styles'
import type { getAdminUser } from '#/lib/admin-users'
import {
  deleteUser,
  grantAccess,
  revokeAccess,
  sendAccessLink,
  setAccessExpiry,
  setUserSuspended,
  updateUser,
} from '#/lib/admin-users'
import { toLocalInput } from '#/lib/promotions'
import { cn } from '#/lib/utils'

type User = Awaited<ReturnType<typeof getAdminUser>>
type Result = { error: string } | { ok: true } | { id: string }

const card =
  'flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-xs'
const cardTitle = 'text-xs font-medium text-muted-foreground'
const pill =
  'rounded-full border border-border px-2 py-0.5 text-xs font-medium text-chart-4'
const secondaryButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium text-foreground disabled:cursor-default disabled:opacity-60'
const dangerButton =
  'inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3.5 font-medium text-destructive disabled:cursor-default disabled:opacity-60'

const longDate = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'long',
})
const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})
const orderStatus = { PAID: 'Pagada', REFUNDED: 'Reembolsada' } as Record<
  string,
  string
>

// Ejecuta una acción del servidor: si responde `{ error }` lo muestra, si no recarga la ficha.
function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)

  async function run(
    action: () => Promise<Result>,
    ok?: string,
    after?: (result: Result) => void | Promise<void>,
  ) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      if ('error' in result) {
        setMessage({ text: result.error, error: true })
        return
      }
      if (ok) setMessage({ text: ok, error: false })
      await after?.(result)
      await router.invalidate()
    } catch {
      setMessage({
        text: 'No se pudo completar. Inténtalo de nuevo.',
        error: true,
      })
    } finally {
      setBusy(false)
    }
  }
  return { busy, message, run }
}

function Message({
  message,
}: {
  message: { text: string; error: boolean } | null
}) {
  if (!message) return null
  return (
    <span
      className={cn(
        'text-13',
        message.error ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {message.text}
    </span>
  )
}

export function UserEditor({ user }: { user: User }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-6 py-3">
        <Link
          to="/admin/usuarios"
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-13 font-medium"
        >
          ‹ Todos los usuarios
        </Link>
      </div>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-2xl font-semibold tracking-landing-title-sm">
              {user.name}
            </h1>
            <span className={pill}>{user.admin ? 'Admin' : 'Alumna'}</span>
            {user.suspended && (
              <span className={cn(pill, 'border-destructive text-destructive')}>
                Suspendida
              </span>
            )}
            {user.self && <span className={pill}>Tú</span>}
          </div>
          <div className="text-muted-foreground">
            {user.email} · cuenta creada el {longDate.format(user.createdAt)}
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <DataCard user={user} />
            <AccountCard user={user} />
          </div>
          <div className="flex flex-col gap-6">
            <AccessCard user={user} />
            <OrdersCard user={user} />
          </div>
        </div>
      </div>
    </>
  )
}

function DataCard({ user }: { user: User }) {
  const { busy, message, run } = useAction()
  const [name, setName] = useState(user.name)
  const [admin, setAdmin] = useState(user.admin)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(
          () => updateUser({ data: { id: user.id, name, admin } }),
          'Guardado',
        )
      }}
      className={card}
    >
      <div className={cardTitle}>DATOS</div>
      <div className={field}>
        <label htmlFor="user-name" className={label}>
          Nombre
        </label>
        <input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          className={input}
        />
      </div>
      <div className={field}>
        <label htmlFor="user-email" className={label}>
          Correo
        </label>
        <input
          id="user-email"
          value={user.email}
          disabled
          className={cn(input, 'opacity-60')}
        />
        <span className="text-xs text-muted-foreground">
          No se cambia: sus compras y accesos están ligados a este correo.
        </span>
      </div>
      <div className={field}>
        <label htmlFor="user-role" className={label}>
          Rol
        </label>
        <select
          id="user-role"
          value={admin ? 'admin' : 'alumna'}
          onChange={(e) => setAdmin(e.target.value === 'admin')}
          disabled={user.self}
          className={cn(input, user.self && 'opacity-60')}
        >
          <option value="alumna">Alumna: entra a sus cursos</option>
          <option value="admin">Administrador: entra al panel</option>
        </select>
        {user.self ? (
          <span className="text-xs text-muted-foreground">
            No puedes cambiar tu propio rol.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Un administrador ve todos los cursos publicados sin necesidad de
            comprarlos.
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          Guardar
        </button>
        <Message message={message} />
      </div>
    </form>
  )
}

function AccessCard({ user }: { user: User }) {
  const { busy, message, run } = useAction()
  const [productId, setProductId] = useState(user.available[0]?.id ?? '')
  const [days, setDays] = useState(user.available[0]?.accessDays ?? 365)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  return (
    <div className={card}>
      <div className={cardTitle}>ACCESO A CURSOS Y PRODUCTOS</div>
      {user.enrollments.length === 0 && (
        <div className="text-muted-foreground">No tiene accesos.</div>
      )}
      {user.enrollments.map((e) => (
        <AccessRow
          key={e.productId}
          userId={user.id}
          enrollment={e}
          busy={busy}
          run={run}
          confirming={confirmRevoke === e.productId}
          onConfirm={setConfirmRevoke}
        />
      ))}

      {user.available.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(
              () => grantAccess({ data: { userId: user.id, productId, days } }),
              'Acceso otorgado',
            )
          }}
          className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
        >
          <div className={cn(field, 'min-w-48 flex-1')}>
            <label htmlFor="grant-product" className={label}>
              Dar acceso a
            </label>
            <select
              id="grant-product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const next = user.available.find((p) => p.id === e.target.value)
                if (next) setDays(next.accessDays)
              }}
              className={input}
            >
              {user.available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className={cn(field, 'w-28')}>
            <label htmlFor="grant-days" className={label}>
              Días
            </label>
            <input
              id="grant-days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={input}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !productId}
            className={primaryButton}
          >
            Dar acceso
          </button>
        </form>
      )}
      <Message message={message} />
    </div>
  )
}

function AccessRow({
  userId,
  enrollment: e,
  busy,
  run,
  confirming,
  onConfirm,
}: {
  userId: string
  enrollment: User['enrollments'][number]
  busy: boolean
  run: ReturnType<typeof useAction>['run']
  confirming: boolean
  onConfirm: (id: string | null) => void
}) {
  const current = toLocalInput(e.expiresAt).slice(0, 10)
  const [date, setDate] = useState(current)

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{e.name}</span>
        <span
          className={cn(
            pill,
            !e.active && 'border-destructive text-destructive',
          )}
        >
          {e.active ? 'Vigente' : 'Vencido'} · {longDate.format(e.expiresAt)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          aria-label={`Vencimiento de ${e.name}`}
          className={cn(input, 'w-44')}
        />
        <button
          type="button"
          disabled={busy || !date || date === current}
          onClick={() =>
            void run(
              () =>
                setAccessExpiry({
                  data: { userId, productId: e.productId, date },
                }),
              'Vencimiento guardado',
            )
          }
          className={secondaryButton}
        >
          Cambiar vencimiento
        </button>
        {confirming ? (
          <>
            <span className="text-13 text-muted-foreground">
              Pierde el acceso; su avance se conserva.
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    revokeAccess({ data: { userId, productId: e.productId } }),
                  undefined,
                  () => onConfirm(null),
                )
              }
              className="h-9 cursor-pointer rounded-md border-none bg-destructive px-3.5 font-admin font-medium text-white disabled:opacity-60"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(null)}
              className={secondaryButton}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onConfirm(e.productId)}
            className={dangerButton}
          >
            Quitar acceso
          </button>
        )}
      </div>
    </div>
  )
}

function OrdersCard({ user }: { user: User }) {
  return (
    <div className={card}>
      <div className={cardTitle}>COMPRAS Y ACTIVIDAD</div>
      <div className="text-13 text-muted-foreground">
        {user.lessonsSeen} lecciones vistas · {user.questions} preguntas
      </div>
      {user.orders.length === 0 && (
        <div className="text-muted-foreground">Sin compras.</div>
      )}
      {user.orders.map((o) => (
        <div
          key={o.id}
          className="flex items-start justify-between gap-3 border-t border-border pt-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{o.items.join(' + ')}</span>
            <span className="text-13 text-chart-3">
              {longDate.format(o.createdAt)}
            </span>
          </div>
          <div className="flex flex-none flex-col items-end gap-1">
            <span className="font-medium">{money.format(o.amountMxn)}</span>
            <span className={pill}>{orderStatus[o.status] ?? o.status}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AccountCard({ user }: { user: User }) {
  const navigate = useNavigate()
  const { busy, message, run } = useAction()
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')

  return (
    <div className={card}>
      <div className={cardTitle}>CUENTA</div>
      <div className="text-13 text-muted-foreground">
        {user.hasPassword
          ? 'Tiene contraseña; también puede entrar con un enlace.'
          : 'Entra con un enlace por correo (no tiene contraseña).'}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || user.suspended}
          onClick={() =>
            void run(
              () => sendAccessLink({ data: { id: user.id } }),
              'Enlace enviado',
            )
          }
          className={secondaryButton}
        >
          Enviar enlace de acceso
        </button>

        {user.suspended ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  setUserSuspended({ data: { id: user.id, suspended: false } }),
                'Cuenta reactivada',
              )
            }
            className={secondaryButton}
          >
            Reactivar cuenta
          </button>
        ) : (
          !confirmSuspend && (
            <button
              type="button"
              disabled={busy || user.self}
              onClick={() => setConfirmSuspend(true)}
              className={dangerButton}
            >
              Suspender cuenta
            </button>
          )
        )}
      </div>

      {confirmSuspend && !user.suspended && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-muted-foreground">
            Se cierran sus sesiones y no podrá entrar. No se borra nada.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  setUserSuspended({ data: { id: user.id, suspended: true } }),
                'Cuenta suspendida',
                () => setConfirmSuspend(false),
              )
            }
            className="h-9 cursor-pointer rounded-md border-none bg-destructive px-3.5 font-admin font-medium text-white disabled:opacity-60"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirmSuspend(false)}
            className={secondaryButton}
          >
            Cancelar
          </button>
        </div>
      )}
      {user.self && (
        <span className="text-xs text-muted-foreground">
          Es tu cuenta: no puedes suspenderla ni eliminarla.
        </span>
      )}
      <Message message={message} />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {!confirmDelete ? (
          <button
            type="button"
            disabled={user.self}
            onClick={() => setConfirmDelete(true)}
            className={cn(dangerButton, 'self-start')}
          >
            Eliminar cuenta
          </button>
        ) : (
          <>
            <span className="text-13 text-muted-foreground">
              Se borran su cuenta, accesos, progreso, momentos y preguntas. Sus
              compras se conservan sin usuario. No se puede deshacer. Escribe{' '}
              <b className="text-foreground">{user.email}</b> para confirmar.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label="Correo para confirmar"
                className={cn(input, 'max-w-72')}
              />
              <button
                type="button"
                disabled={busy || typed.trim().toLowerCase() !== user.email}
                onClick={() =>
                  void run(
                    () =>
                      deleteUser({
                        data: { id: user.id, confirmEmail: typed },
                      }),
                    undefined,
                    () => navigate({ to: '/admin/usuarios' }),
                  )
                }
                className="h-9 cursor-pointer rounded-md border-none bg-destructive px-3.5 font-admin font-medium text-white disabled:opacity-60"
              >
                Eliminar definitivamente
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false)
                  setTyped('')
                }}
                className={secondaryButton}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
