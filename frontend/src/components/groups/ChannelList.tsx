import { Link } from 'react-router-dom'
import type { GroupChannel } from '@/api/schemas'

/** Channel-Liste einer Gruppe. Klick öffnet den Chat (Slice 4) — vorerst Verweis auf /chat. */
export function ChannelList({ channels }: { channels: GroupChannel[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {channels.map((c) => (
        <Link
          key={c.id}
          to="/chat"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-base-200"
        >
          <span className="font-medium">
            <span className="text-base-content/40">#</span> {c.title}
          </span>
          {c.is_default && <span className="text-xs text-base-content/45">Standard</span>}
        </Link>
      ))}
    </div>
  )
}
