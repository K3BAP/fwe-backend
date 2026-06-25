import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { PublicUserCard } from '@/api/schemas'
import { Avatar } from './Avatar'

export type UserCardProps = {
  user: PublicUserCard
  /** Zusatzzeile statt @handle (z.B. Rolle, „vor 2 Std."). */
  subtitle?: ReactNode
  trailing?: ReactNode
  /** Coral-Ring auf dem Avatar (Ersteller-Hervorhebung). */
  highlight?: boolean
  onClick?: () => void
  size?: number
  className?: string
}

/** Nutzerzeile: Avatar + Name + @handle/Untertitel + optionaler Trailing-Slot (Listen, Mitglieder, DMs). */
export function UserCard({ user, subtitle, trailing, highlight, onClick, size = 40, className }: UserCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 text-left',
        onClick && 'rounded-2xl p-1.5 transition hover:bg-base-200',
        className,
      )}
    >
      <Avatar name={user.display_name} src={user.avatar_path} size={size} highlight={highlight} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight">{user.display_name}</span>
        <span className="block truncate text-[13px] text-base-content/55">
          {subtitle ?? (user.handle ? `@${user.handle}` : null)}
        </span>
      </span>
      {trailing}
    </Tag>
  )
}
