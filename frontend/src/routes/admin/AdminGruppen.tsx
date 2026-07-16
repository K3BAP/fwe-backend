import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminGroups, useAdminInvalidate, useRestoreGroup } from '@/api/admin'
import { useDeleteGroup } from '@/api/groups'
import type { AdminGroupRow } from '@/api/schemas'
import { AdminGroupTable } from '@/components/admin/AdminGroupTable'
import { AdminSearchField } from '@/components/admin/AdminSearchField'
import { useAdminListState } from '@/components/admin/useAdminListState'
import { Button, EmptyState, FilterPill, Modal, Pager, Skeleton, type MenuItemDef } from '@/components/ui'

const DEFAULT_SORT = 'created_at_desc'

/**
 * Gruppen-Verwaltung — die einzige Liste, die **alle** Gruppen zeigt: private, nicht gelistete und
 * soft-gelöschte. Löschen läuft über den öffentlichen Hook (`$isAdmin`-Override), Wiederherstellen
 * über den Admin-Endpunkt (dafür gab es bisher kein Gegenstück).
 */
export function AdminGruppen() {
  const { page, sort, get, patch, goToPage, offset, limit } = useAdminListState(DEFAULT_SORT)
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<AdminGroupRow | null>(null)

  const { data, isLoading, isError } = useAdminGroups({
    q: get('q') || undefined,
    visibility: get('visibility') || undefined,
    status: get('status') || undefined,
    sort,
    limit,
    offset,
  })
  const groups = data?.items ?? []
  const total = data?.total ?? 0

  const invalidateAdmin = useAdminInvalidate()
  const restore = useRestoreGroup()
  const remove = useDeleteGroup()

  function actionsFor(group: AdminGroupRow): MenuItemDef[] {
    if (group.deleted_at) {
      return [{ label: 'Wiederherstellen', onSelect: () => restore.mutate(group.id) }]
    }
    return [
      { label: 'Öffnen', onSelect: () => navigate(`/gruppen/${group.id}`) },
      { label: 'Einstellungen', onSelect: () => navigate(`/gruppen/${group.id}/einstellungen`) },
      { label: 'Löschen', danger: true, onSelect: () => setConfirm(group) },
    ]
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchField label="Gruppen suchen" placeholder="Name oder Slug suchen" value={get('q')} onChange={(q) => patch({ q })} />
        <FilterPill
          value={get('visibility')}
          active={get('visibility') !== ''}
          onChange={(e) => patch({ visibility: e.target.value })}
          aria-label="Sichtbarkeit filtern"
        >
          <option value="">Alle Sichtbarkeiten</option>
          <option value="public">Öffentlich</option>
          <option value="unlisted">Nicht gelistet</option>
          <option value="private">Privat</option>
        </FilterPill>
        <FilterPill value={get('status')} active={get('status') !== ''} onChange={(e) => patch({ status: e.target.value })} aria-label="Status filtern">
          <option value="">Alle</option>
          <option value="active">Aktiv</option>
          <option value="deleted">Gelöscht</option>
        </FilterPill>
        <span className="ml-auto text-sm text-base-content/60">{isLoading ? 'Lädt…' : `${total} Gruppen`}</span>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Gruppen konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}
      {isLoading && <Skeleton className="h-[420px]" />}
      {!isLoading && !isError && groups.length === 0 && (
        <EmptyState title="Keine Gruppen gefunden" description="Passe die Suche oder die Filter an." />
      )}
      {!isLoading && !isError && groups.length > 0 && (
        <>
          <AdminGroupTable groups={groups} sort={sort} onSort={(s) => patch({ sort: s })} actionsFor={actionsFor} />
          <Pager page={page} pageSize={limit} total={total} onPage={goToPage} />
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Gruppe löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              disabled={remove.isPending}
              onClick={() => {
                if (!confirm) return
                remove.mutate(confirm.id, {
                  onSuccess: () => {
                    invalidateAdmin()
                    setConfirm(null)
                  },
                })
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        {confirm && (
          <p className="text-sm text-base-content/70">
            „{confirm.name}“ wird ausgeblendet — Mitglieder, Feed und Channels bleiben erhalten. Du kannst die Gruppe hier jederzeit
            wiederherstellen.
          </p>
        )}
      </Modal>
    </section>
  )
}
