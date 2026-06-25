import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Flugtreffen } from './Flugtreffen'
import { Home } from './Home'
import { Placeholder } from './Placeholder'
import { Styleguide } from './Styleguide'

// In Prod läuft die App unter /public/ (vite base) → basename ableiten.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Home /> },
        { path: 'flugtreffen', element: <Flugtreffen /> },
        { path: 'gruppen', element: <Placeholder title="Gruppen" /> },
        { path: 'chat', element: <Placeholder title="Chat" /> },
        { path: 'styleguide', element: <Styleguide /> },
        { path: '*', element: <Placeholder title="Seite nicht gefunden (404)" /> },
      ],
    },
  ],
  { basename: basename || undefined },
)
