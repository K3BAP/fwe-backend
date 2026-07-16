import { useState } from 'react'
import { useAdminUsers, useRestoreUser, useSetUserActive, useSetUserAdmin, useSoftDeleteUser } from '@/api/admin'
import type { AdminUserRow } from '@/api/schemas'
import { AdminSearchField } from '@/components/admin/AdminSearchField'
import { AdminUserTable } from '@/components/admin/AdminUserTable'
import { useAdminListState } from '@/components/admin/useAdminListState'
import { Button, EmptyState, FilterPill, Modal, Pager, Skeleton, type MenuItemDef } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

const DEFAULT_SORT = 'created_at_desc'

/** Welche Bestätigung offen ist — eine Variante statt vier Booleans. */
type Confirm =
  | { kind: 'delete'; user: AdminUserRow }
  | { kind: 'deactivate'; user: AdminUserRow }
  | { kind: 'demote'; user: AdminUserRow }
  | null

/** Benutzerverwaltung: alle Konten, standardmäßig inkl. gelöschter. */
export function AdminBenutzer() {
  const { page, sort, get, patch, goToPage, offset, limit } = useAdminListState(DEFAULT_SORT)
  const myId = useAuthStore((s) => s.user?.id)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const { data, isLoading, isError } = useAdminUsers({
    q: get('q') || undefined,
    status: get('status') || undefined,
    sort,
    limit,
    offset,
  })
  const users = data?.items ?? []
  const total = data?.total ?? 0

  const setAdmin = useSetUserAdmin()
  const setActive = useSetUserActive()
  const softDelete = useSoftDeleteUser()
  const restore = useRestoreUser()
  const pending = setAdmin.isPending || setActive.isPending || softDelete.isPending || restore.isPending

  /**
   * Zeilen-Aktionen. Am eigenen Konto sind Degradieren/Sperren/Löschen ausgeblendet — der Service
   * lehnt sie mit 409 ab, das UI soll gar nicht erst dorthin führen.
   */
  function actionsFor(user: AdminUserRow): MenuItemDef[] {
    const isSelf = user.id === myId
    const items: MenuItemDef[] = []

    if (user.deleted_at) {
      items.push({ label: 'Wiederherstellen', onSelect: () => restore.mutate(user.id) })
      return items
    }

    if (user.is_admin) {
      if (!isSelf) items.push({ label: 'Admin-Rechte entziehen', onSelect: () => setConfirm({ kind: 'demote', user }) })
    } else {
      items.push({ label: 'Zum Admin machen', onSelect: () => setAdmin.mutate({ id: user.id, isAdmin: true }) })
    }

    if (user.active) {
      if (!isSelf) items.push({ label: 'Deaktivieren', onSelect: () => setConfirm({ kind: 'deactivate', user }) })
    } else {
      items.push({ label: 'Reaktivieren', onSelect: () => setActive.mutate({ id: user.id, active: true }) })
    }

    if (!isSelf) items.push({ label: 'Löschen', danger: true, onSelect: () => setConfirm({ kind: 'delete', user }) })

    return items
  }

  function runConfirmed() {
    if (!confirm) return
    const id = confirm.user.id
    const done = { onSuccess: () => setConfirm(null) }
    if (confirm.kind === 'delete') softDelete.mutate(id, done)
    if (confirm.kind === 'deactivate') setActive.mutate({ id, active: false }, done)
    if (confirm.kind === 'demote') setAdmin.mutate({ id, isAdmin: false }, done)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchField
          label="Benutzer suchen"
          placeholder="Name, Benutzername oder E-Mail suchen"
          value={get('q')}
          onChange={(q) => patch({ q })}
        />
        <FilterPill value={get('status')} active={get('status') !== ''} onChange={(e) => patch({ status: e.target.value })} aria-label="Status filtern">
          <option value="">Alle</option>
          <option value="active">Aktiv</option>
          <option value="suspended">Gesperrt</option>
          <option value="deleted">Gelöscht</option>
          <option value="admins">Admins</option>
        </FilterPill>
        <span className="ml-auto text-sm text-base-content/60">{isLoading ? 'Lädt…' : `${total} Benutzer`}</span>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Benutzer konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}
      {isLoading && <Skeleton className="h-[420px]" />}
      {!isLoading && !isError && users.length === 0 && (
        <EmptyState title="Keine Benutzer gefunden" description="Passe die Suche oder den Status-Filter an." />
      )}
      {!isLoading && !isError && users.length > 0 && (
        <>
          <AdminUserTable users={users} sort={sort} onSort={(s) => patch({ sort: s })} actionsFor={actionsFor} />
          <Pager page={page} pageSize={limit} total={total} onPage={goToPage} />
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'delete' ? 'Benutzer löschen?' : confirm?.kind === 'deactivate' ? 'Benutzer deaktivieren?' : 'Admin-Rechte entziehen?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="accent" onClick={runConfirmed} disabled={pending}>
              {confirm?.kind === 'delete' ? 'Löschen' : confirm?.kind === 'deactivate' ? 'Deaktivieren' : 'Entziehen'}
            </Button>
          </>
        }
      >
        {confirm?.kind === 'delete' && (
          <p className="text-sm text-base-content/70">
            „{confirm.user.display_name}“ wird deaktiviert und aus der Plattform ausgeblendet. Das Konto bleibt erhalten und lässt sich
            jederzeit wiederherstellen. Bereits erstellte Treffen, Gruppen und Nachrichten bleiben bestehen.
          </p>
        )}
        {confirm?.kind === 'deactivate' && (
          <p className="text-sm text-base-content/70">
            „{confirm.user.display_name}“ kann sich nicht mehr anmelden und wird sofort abgemeldet. Inhalte bleiben sichtbar.
          </p>
        )}
        {confirm?.kind === 'demote' && (
          <p className="text-sm text-base-content/70">„{confirm.user.display_name}“ verliert alle Plattform-Rechte.</p>
        )}
      </Modal>
    </section>
  )
}
