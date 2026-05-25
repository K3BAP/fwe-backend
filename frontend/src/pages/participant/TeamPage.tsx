import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useCreateTeam, useJoinTeam, useMe, useTeams } from '../../api/participant'
import { ApiError } from '../../api/client'
import { Badge, Button, Card, ErrorText, Input, Label, Skeleton } from '../../components/ui'
import { Item, Stagger } from '../../components/motion'
import { spring } from '../../lib/motion'

export default function TeamPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: teams, isLoading } = useTeams(me?.rallye.id)
  const createTeam = useCreateTeam()
  const joinTeam = useJoinTeam()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  if (!me) return <Skeleton className="h-40 w-full" />

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
        <h1 className="text-xl font-bold text-fg">Team wählen</h1>
        <p className="text-muted">Tritt einem Team bei{canCreate ? ' oder gründe ein neues' : ''}.</p>
      </div>

      <ErrorText>{error}</ErrorText>

      {canCreate && (
        <Card>
          <Label>Neues Team gründen</Label>
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Teamname" maxLength={100} />
            <Button
              loading={createTeam.isPending}
              disabled={!newName.trim()}
              onClick={() => run(() => createTeam.mutateAsync(newName.trim()))}
            >
              Gründen
            </Button>
          </div>
        </Card>
      )}

      {isLoading && <Skeleton className="h-16 w-full" />}
      {teams?.length === 0 && <p className="text-muted">Noch keine Teams vorhanden.</p>}
      <Stagger className="space-y-3">
        <AnimatePresence initial={false}>
          {teams?.map((team) => {
            const full = maxSize !== null && (team.member_count ?? 0) >= maxSize
            return (
              <Item key={team.id}>
                <motion.div layout exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
                  <Card className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-fg">{team.name}</p>
                      <p className="text-sm text-muted">
                        {team.member_count ?? 0}
                        {maxSize !== null ? ` / ${maxSize}` : ''} Mitglieder
                      </p>
                    </div>
                    {full ? (
                      <Badge tone="red">Voll</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        loading={joinTeam.isPending}
                        onClick={() => run(() => joinTeam.mutateAsync(team.id))}
                      >
                        Beitreten
                      </Button>
                    )}
                  </Card>
                </motion.div>
              </Item>
            )
          })}
        </AnimatePresence>
      </Stagger>
    </div>
  )
}
