import { useQuery } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { groupsTable } from '@/mocks/groups'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { groupListSchema, type GroupListItem } from './schemas'

/**
 * Gruppen-Naht (ADR-016): in M1 aus dem Mock-Store, ab M4 (Gruppen verkabeln) auf `apiFetch`.
 * Slice 3 ergänzt Detail-/Feed-/Mitglieder-Hooks.
 */
async function fetchGroups(): Promise<GroupListItem[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.list(), { emptyValue: [] })
  return apiFetch('/groups', groupListSchema)
}

export function useGroups() {
  return useQuery({ queryKey: qk.groups.list(), queryFn: fetchGroups })
}
