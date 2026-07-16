import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminInvalidate, useAdminMeetups } from '@/api/admin'
import { useCancelMeetup, useDeleteMeetup } from '@/api/meetups'
import type { AdminMeetupRow } from '@/api/schemas'
import { AdminMeetupTable } from '@/components/admin/AdminMeetupTable'
import { AdminSearchField } from '@/components/admin/AdminSearchField'
import { useAdminListState } from '@/components/admin/useAdminListState'
import { Button, EmptyState, FilterPill, Modal, Pager, Skeleton, type MenuItemDef } from '@/components/ui'

const DEFAULT_SORT = 'starts_at_asc'

type Confirm = { kind: 'cancel' | 'delete'; meetup: AdminMeetupRow } | null

/**
 * Treffen-Verwaltung.
 *
 * Schreibt bewusst über die **öffentlichen** Hooks (`useCancelMeetup`/`useDeleteMeetup`): die Routen
 * akzeptieren Admins längst über den `$isAdmin`-BOLA-Override, ein zweiter Endpunkt wäre Duplikat.
 * Deren `onSuccess` kennt die Admin-Keys aber nicht — deshalb `useAdminInvalidate()` je Aufruf dazu.
 */
export function AdminFlugtreffen() {
  const { page, sort, get, patch, goToPage, offset, limit } = useAdminListState(DEFAULT_SORT)
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<Confirm>(null)

  const { data, isLoading, isError } = useAdminMeetups({
    q: get('q') || undefined,
    status: get('status') || undefined,
    sort,
    limit,
    offset,
  })
  const meetups = data?.items ?? []
  const total = data?.total ?? 0

  const invalidateAdmin = useAdminInvalidate()
  const cancel = useCancelMeetup()
  const remove = useDeleteMeetup()
  const pending = cancel.isPending || remove.isPending

  function actionsFor(meetup: AdminMeetupRow): MenuItemDef[] {
    const items: MenuItemDef[] = [
      { label: 'Bearbeiten', onSelect: () => navigate(`/flugtreffen/${meetup.id}/bearbeiten`) },
    ]
    if (meetup.status !== 'cancelled') {
      items.push({ label: 'Absagen', onSelect: () => setConfirm({ kind: 'cancel', meetup }) })
    }
    items.push({ label: 'Löschen', danger: true, onSelect: () => setConfirm({ kind: 'delete', meetup }) })
    return items
  }

  function runConfirmed() {
    if (!confirm) return
    const done = {
      onSuccess: () => {
        invalidateAdmin()
        setConfirm(null)
      },
    }
    if (confirm.kind === 'cancel') cancel.mutate(confirm.meetup.id, done)
    if (confirm.kind === 'delete') remove.mutate(confirm.meetup.id, done)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchField
          label="Flugtreffen suchen"
          placeholder="Titel, Ort oder Region suchen"
          value={get('q')}
          onChange={(q) => patch({ q })}
        />
        <FilterPill value={get('status')} active={get('status') !== ''} onChange={(e) => patch({ status: e.target.value })} aria-label="Status filtern">
          <option value="">Alle</option>
          <option value="open">Offen</option>
          <option value="cancelled">Abgesagt</option>
        </FilterPill>
        <span className="ml-auto text-sm text-base-content/60">{isLoading ? 'Lädt…' : `${total} Treffen`}</span>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Flugtreffen konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}
      {isLoading && <Skeleton className="h-[420px]" />}
      {!isLoading && !isError && meetups.length === 0 && (
        <EmptyState title="Keine Treffen gefunden" description="Passe die Suche oder den Status-Filter an." />
      )}
      {!isLoading && !isError && meetups.length > 0 && (
        <>
          <AdminMeetupTable meetups={meetups} sort={sort} onSort={(s) => patch({ sort: s })} actionsFor={actionsFor} />
          <Pager page={page} pageSize={limit} total={total} onPage={goToPage} />
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'cancel' ? 'Treffen absagen?' : 'Treffen löschen?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="accent" onClick={runConfirmed} disabled={pending}>
              {confirm?.kind === 'cancel' ? 'Absagen' : 'Löschen'}
            </Button>
          </>
        }
      >
        {confirm?.kind === 'cancel' && (
          <p className="text-sm text-base-content/70">
            „{confirm.meetup.title}“ wird als abgesagt markiert. Alle Teilnehmenden werden benachrichtigt; das Treffen bleibt sichtbar.
          </p>
        )}
        {confirm?.kind === 'delete' && (
          <p className="text-sm text-base-content/70">
            „{confirm.meetup.title}“ wird endgültig gelöscht — samt Teilnahmen. Das lässt sich nicht rückgängig machen.
          </p>
        )}
      </Modal>
    </section>
  )
}
