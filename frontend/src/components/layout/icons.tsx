import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => <Base {...p}><path d="M3 11l9-8 9 8M5 9v11h14V9" /></Base>
export const WingIcon = (p: IconProps) => (
  <Base {...p}><path d="M3 15 C 8 8, 16 8, 21 15 C 16 12, 8 12, 3 15 Z" /><path d="M8 13l3 5M16 13l-3 5" /></Base>
)
export const GroupIcon = (p: IconProps) => (
  <Base {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 2.9-5.2 6.5-5.2s6.5 1.7 6.5 5.2" /><circle cx="18" cy="9" r="2.6" /><path d="M17 14.2c2.6.3 4.5 1.9 4.5 4.8" /></Base>
)
export const ChatIcon = (p: IconProps) => <Base {...p}><path d="M21 11.5a8.5 8 0 0 1-11.8 7.4L3 21l2.1-6.2A8.5 8 0 1 1 21 11.5z" /></Base>
export const SearchIcon = (p: IconProps) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></Base>
export const BellIcon = (p: IconProps) => (
  <Base {...p}><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Base>
)
export const SunIcon = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></Base>
)
export const MoonIcon = (p: IconProps) => <Base {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></Base>
