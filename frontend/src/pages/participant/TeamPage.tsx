import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTeam, useJoinTeam, useMe, useTeams } from '../../api/participant'
import { ApiError } from '../../api/client'
import { Badge, Button, Card, ErrorText, Input, Label, Spinner } from '../../components/ui'

export default function TeamPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: teams, isLoading } = useTeams(me?.rallye.id)
  const createTeam = useCreateTeam()
  const joinTeam = useJoinTeam()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  if (!me) return <Spinner />

  const canCreate = me.rallye.preset_team_count === null
  const maxSize = me.rallye.max_team_size

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      navigate('/rallye', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Team wählen</h1>
        <p className="text-slate-600">Tritt einem Team bei{canCreate ? ' oder gründe ein neues' : ''}.</p>
      </div>

      <ErrorText>{error}</ErrorText>

      {canCreate && (
        <Card>
          <Label>Neues Team gründen</Label>
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Teamname" maxLength={100} />
            <Button
              disabled={!newName.trim() || createTeam.isPending}
              onClick={() => run(() => createTeam.mutateAsync(newName.trim()))}
            >
              Gründen
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && <Spinner />}
        {teams?.length === 0 && <p className="text-slate-500">Noch keine Teams vorhanden.</p>}
        {teams?.map((team) => {
          const full = maxSize !== null && (team.member_count ?? 0) >= maxSize
          return (
            <Card key={team.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{team.name}</p>
                <p className="text-sm text-slate-500">
                  {team.member_count ?? 0}
                  {maxSize !== null ? ` / ${maxSize}` : ''} Mitglieder
                </p>
              </div>
              {full ? (
                <Badge tone="red">Voll</Badge>
              ) : (
                <Button
                  variant="secondary"
                  disabled={joinTeam.isPending}
                  onClick={() => run(() => joinTeam.mutateAsync(team.id))}
                >
                  Beitreten
                </Button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
