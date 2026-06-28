import { Avatar } from '@/components/ui'
import { WingIcon } from '@/components/layout/icons'
import { brandGradient, initials } from '@/lib/gradient'

type Peer = { display_name: string; avatar_path: string | null } | null

/**
 * Avatar/Icon je Konversationstyp: DM-Partner-Avatar, Treffen-Wing (Sky), Channel-Initiale (Verlauf).
 * Von der Konversationsliste **und** dem Thread-Header genutzt (entkoppelt vom konkreten DTO-Typ).
 */
export function ConversationAvatar({
  type,
  peer,
  title,
  size = 44,
}: {
  type: string
  peer?: Peer
  title: string
  size?: number
}) {
  if (peer) return <Avatar name={peer.display_name} src={peer.avatar_path} size={size} />

  if (type === 'meetup') {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-sky-500 text-white" style={{ width: size, height: size }}>
        <WingIcon size={Math.round(size * 0.5)} />
      </span>
    )
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: brandGradient(title), fontSize: size * 0.32 }}
    >
      {initials(title)}
    </span>
  )
}
