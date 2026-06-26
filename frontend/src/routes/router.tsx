import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth, RequireGuest } from '@/components/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from './Dashboard'
import { Einstellungen } from './Einstellungen'
import { Landing } from './Landing'
import { FlugtreffenLazy, Lazy, MeetupDetailLazy, StyleguideLazy } from './lazy'
import { Login } from './Login'
import { MeetupErstellen } from './MeetupErstellen'
import { Placeholder } from './Placeholder'
import { Register } from './Register'

// In Prod läuft die App unter /public/ (vite base) → basename ableiten.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(
  [
    {
      element: <RequireGuest />,
      children: [
        { path: '/landing', element: <Landing /> },
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
      ],
    },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Dashboard /> },
            { path: 'flugtreffen', element: <Lazy><FlugtreffenLazy /></Lazy> },
            { path: 'flugtreffen/neu', element: <MeetupErstellen /> },
            { path: 'flugtreffen/:id', element: <Lazy><MeetupDetailLazy /></Lazy> },
            { path: 'gruppen', element: <Placeholder title="Gruppen" /> },
            { path: 'chat', element: <Placeholder title="Chat" /> },
            { path: 'einstellungen', element: <Einstellungen /> },
            { path: 'styleguide', element: <Lazy><StyleguideLazy /></Lazy> },
            { path: '*', element: <Placeholder title="Seite nicht gefunden (404)" /> },
          ],
        },
      ],
    },
  ],
  { basename: basename || undefined },
)
