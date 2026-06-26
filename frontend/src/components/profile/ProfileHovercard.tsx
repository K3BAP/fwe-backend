import { useEffect, useLayoutEffect, useRef, useState, type Ref, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/api/profiles'
import { useOpenDm } from '@/api/chat'
import { Avatar, Button, ExperienceBadge, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'

/** Schwebekarte zu einem Profil: Avatar/Name/Level + „Profil ansehen" / „Direktchat". */
function ProfilePopover({
  userId,
  placement,
  onClose,
  ref,
}: {
  userId: number
  placement: 'top' | 'bottom'
  onClose: () => void
  ref?: Ref<HTMLDivElement>
}) {
  const { data, isLoading } = useProfile(userId)
  const openDm = useOpenDm()
  const navigate = useNavigate()

  return (
    <div
      ref={ref}
      className={cn(
        'absolute left-0 z-30 w-64 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-popover',
        placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
      )}
    >
      {isLoading || !data ? (
        <div className="grid h-24 place-items-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={data.display_name} src={data.avatar_path} size={48} />
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">{data.display_name}</div>
              {data.handle && <div className="truncate text-xs text-base-content/55">@{data.handle}</div>}
            </div>
          </div>
          {data.experience_level && (
            <div className="mt-3">
              <ExperienceBadge level={data.experience_level} />
            </div>
          )}
          {data.bio && <p className="mt-3 line-clamp-2 text-sm text-base-content/70">{data.bio}</p>}
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onClose()
                navigate(`/profil/${userId}`)
              }}
            >
              Profil
            </Button>
            {!data.is_self && (
              <Button
                size="sm"
                className="flex-1"
                disabled={openDm.isPending}
                onClick={() => openDm.mutate(userId, { onSuccess: (convId) => { onClose(); navigate(`/chat/${convId}`) } })}
              >
                Direktchat
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Trigger-Wrapper: Klick öffnet die Profil-Schwebekarte. Klappt nach oben, wenn unten kein Platz ist. */
export function ProfileHovercard({ userId, children, className }: { userId: number; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Klick außerhalb schließt.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Platzierung: unter dem Trigger, sonst darüber (auch nach dem Laden via ResizeObserver).
  useLayoutEffect(() => {
    if (!open) return
    const compute = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const height = popoverRef.current?.offsetHeight ?? 0
      if (!trigger) return
      const spaceBelow = window.innerHeight - trigger.bottom
      setPlacement(spaceBelow < height + 12 ? 'top' : 'bottom')
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (popoverRef.current) ro.observe(popoverRef.current)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div ref={triggerRef} role="button" tabIndex={0} onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {children}
      </div>
      {open && <ProfilePopover ref={popoverRef} userId={userId} placement={placement} onClose={() => setOpen(false)} />}
    </div>
  )
}
