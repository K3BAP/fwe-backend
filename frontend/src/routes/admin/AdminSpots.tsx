import { useState } from 'react'
import { useAdminSpots, useDeleteSpot } from '@/api/admin'
import type { AdminSpot } from '@/api/schemas'
import { AdminSearchField } from '@/components/admin/AdminSearchField'
import { AdminSpotTable } from '@/components/admin/AdminSpotTable'
import { SpotFormModal } from '@/components/admin/SpotFormModal'
import { SPOT_TYPE_LABEL } from '@/components/admin/spotLabels'
import { useAdminListState } from '@/components/admin/useAdminListState'
import { Button, EmptyState, FilterPill, Modal, Pager, Skeleton, type MenuItemDef } from '@/components/ui'

const DEFAULT_SORT = 'name_asc'

/** Startplatz-Pflege (ADR-012/A4: „nur Admin/Seed pflegen die Liste"). */
export function AdminSpots() {
  const { page, sort, get, patch, goToPage, offset, limit } = useAdminListState(DEFAULT_SORT)
  const [editing, setEditing] = useState<AdminSpot | 'new' | null>(null)
  const [confirm, setConfirm] = useState<AdminSpot | null>(null)

  const { data, isLoading, isError } = useAdminSpots({
    q: get('q') || undefined,
    type: get('type') || undefined,
    sort,
    limit,
    offset,
  })
  const spots = data?.items ?? []
  const total = data?.total ?? 0

  const remove = useDeleteSpot()

  function actionsFor(spot: AdminSpot): MenuItemDef[] {
    return [
      { label: 'Bearbeiten', onSelect: () => setEditing(spot) },
      { label: 'Löschen', danger: true, onSelect: () => setConfirm(spot) },
    ]
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchField label="Startplätze suchen" placeholder="Name oder Region suchen" value={get('q')} onChange={(q) => patch({ q })} />
        <FilterPill value={get('type')} active={get('type') !== ''} onChange={(e) => patch({ type: e.target.value })} aria-label="Typ filtern">
          <option value="">Alle Typen</option>
          {Object.entries(SPOT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FilterPill>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-base-content/60">{isLoading ? 'Lädt…' : `${total} Startplätze`}</span>
          <Button size="sm" onClick={() => setEditing('new')}>
            Startplatz anlegen
          </Button>
        </div>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Startplätze konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}
      {isLoading && <Skeleton className="h-[420px]" />}
      {!isLoading && !isError && spots.length === 0 && (
        <EmptyState
          title="Keine Startplätze gefunden"
          description="Passe die Suche an oder lege einen neuen Startplatz an."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              Startplatz anlegen
            </Button>
          }
        />
      )}
      {!isLoading && !isError && spots.length > 0 && (
        <>
          <AdminSpotTable spots={spots} sort={sort} onSort={(s) => patch({ sort: s })} actionsFor={actionsFor} />
          <Pager page={page} pageSize={limit} total={total} onPage={goToPage} />
        </>
      )}

      {editing !== null && <SpotFormModal spot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Startplatz löschen?"
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
                remove.mutate(confirm.id, { onSuccess: () => setConfirm(null) })
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        {confirm && (
          <p className="text-sm text-base-content/70">
            {confirm.meetups_count > 0
              ? `${confirm.meetups_count} Flugtreffen verweisen auf „${confirm.name}“. Ihre Ortsangabe und Karte bleiben erhalten, nur die Verknüpfung entfällt.`
              : `„${confirm.name}“ wird aus der Auswahl im Treffen-Wizard entfernt.`}
          </p>
        )}
      </Modal>
    </section>
  )
}
