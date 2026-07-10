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
export const ClockIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Base>
export const CalendarIcon = (p: IconProps) => (
  <Base {...p}><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></Base>
)
export const MapPinIcon = (p: IconProps) => (
  <Base {...p}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></Base>
)
export const PlusIcon = (p: IconProps) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
export const CheckIcon = (p: IconProps) => <Base {...p}><path d="M20 6 9 17l-5-5" /></Base>
export const ChevronRightIcon = (p: IconProps) => <Base {...p}><path d="m9 6 6 6-6 6" /></Base>
export const SendIcon = (p: IconProps) => <Base {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></Base>
export const MoreIcon = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></Base>
)
export const UsersIcon = GroupIcon

// --- Wetter (ADR-017) ---
export const WindIcon = (p: IconProps) => (
  <Base {...p}><path d="M3 8h10a3 3 0 1 0-3-3M3 16h13a3 3 0 1 1-3 3M3 12h17" /></Base>
)
export const GustIcon = (p: IconProps) => (
  <Base {...p}><path d="M3 7h8a2.5 2.5 0 1 0-2.5-2.5M3 12h12.5a2.5 2.5 0 1 1-2.5 2.5" /><path d="M17 7.5h1.5M20.5 12h1M17 17h2" /></Base>
)
export const CloudIcon = (p: IconProps) => (
  <Base {...p}><path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 18z" /></Base>
)
export const CloudRainIcon = (p: IconProps) => (
  <Base {...p}><path d="M7 15a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 15z" /><path d="M8 18.5v2M12 18v2.5M16 18.5v2" /></Base>
)
export const SnowIcon = (p: IconProps) => (
  <Base {...p}><path d="M7 15a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 15z" /><path d="M8 19h.01M12 18.5h.01M16 19h.01M10 21h.01M14 21h.01" /></Base>
)
export const FogIcon = (p: IconProps) => (
  <Base {...p}><path d="M7 14a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 14z" /><path d="M4 17.5h16M7 20.5h12" /></Base>
)
export const ThunderIcon = (p: IconProps) => (
  <Base {...p}><path d="M7 14a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 14z" /><path d="m13 13-3 4.5h3L10 22" /></Base>
)
export const ThermometerIcon = (p: IconProps) => (
  <Base {...p}><path d="M14 14.8V4.5a2.5 2.5 0 0 0-5 0v10.3a4.5 4.5 0 1 0 5 0z" /><path d="M11.5 17.5v-6" /></Base>
)
/** Pfeil nach oben — für die Windrichtung um `wind_direction_deg` gedreht. */
export const ArrowUpIcon = (p: IconProps) => <Base {...p}><path d="M12 20V4M6 10l6-6 6 6" /></Base>
