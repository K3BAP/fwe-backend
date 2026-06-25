import { cn } from '@/lib/cn'

/** Drei Brand-Verläufe, deterministisch je Name gewählt. */
const GRADIENTS = [
  'linear-gradient(150deg,#5BB8F5,#0F6FBE)',
  'linear-gradient(150deg,#FF8062,#F1572F)',
  'linear-gradient(150deg,#66B0B6,#0A4F57)',
]

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function pick(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

export type AvatarProps = {
  name: string
  src?: string | null
  size?: number
  /** Coral-Ring zur Ersteller-Hervorhebung (Treffen-Chat). */
  highlight?: boolean
  className?: string
}

/** Runder Avatar mit Bild oder Initialen-Verlauf (Design-System §07). */
export function Avatar({ name, src, size = 40, highlight, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white',
        highlight && 'ring-2 ring-coral-500 ring-offset-2 ring-offset-base-100',
        className,
      )}
      style={{ width: size, height: size, background: src ? undefined : pick(name), fontSize: size * 0.34 }}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials(name)}
    </span>
  )
}
