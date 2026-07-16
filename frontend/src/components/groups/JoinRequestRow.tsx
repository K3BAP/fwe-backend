import { Avatar, Button, Card } from '@/components/ui'
import type { JoinRequest } from '@/api/schemas'
import { formatRelativeTime } from '@/lib/format'

/** Eine Beitrittsanfrage im Admin-Bereich, mit Genehmigen/Ablehnen. */
export function JoinRequestRow({
  request,
  onApprove,
  onReject,
  pending,
}: {
  request: JoinRequest
  onApprove: () => void
  onReject: () => void
  pending: boolean
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Avatar name={request.user.display_name} src={request.user.avatar_path} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-tight">
          {request.user.display_name}
          {request.user.handle && <span className="ml-1.5 text-sm font-normal text-base-content/45">@{request.user.handle}</span>}
        </div>
        <div className="text-xs text-base-content/50">{formatRelativeTime(request.created_at)}</div>
        {request.message && <p className="mt-1 text-sm italic text-base-content/70">„{request.message}"</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={pending} onClick={onApprove}>
          Genehmigen
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onReject}>
          Ablehnen
        </Button>
      </div>
    </Card>
  )
}
