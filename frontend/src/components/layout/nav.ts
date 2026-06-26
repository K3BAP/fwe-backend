import { ChatIcon, GroupIcon, HomeIcon, WingIcon } from './icons'

export type NavItem = {
  to: string
  label: string
  icon: typeof HomeIcon
  end?: boolean
}

/** Hauptnavigation (Home · Flugtreffen · Gruppen · Chat). Der Chat-Badge wird live aus
 * `useChatUnread` injiziert (siehe TopBar/BottomNav), nicht hier hartkodiert. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/flugtreffen', label: 'Flugtreffen', icon: WingIcon },
  { to: '/gruppen', label: 'Gruppen', icon: GroupIcon },
  { to: '/chat', label: 'Chat', icon: ChatIcon },
]
