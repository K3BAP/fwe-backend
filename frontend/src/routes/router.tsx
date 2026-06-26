import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth, RequireGuest } from '@/components/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { Benachrichtigungen } from './Benachrichtigungen'
import { Chat } from './Chat'
import { Dashboard } from './Dashboard'
import { Einstellungen } from './Einstellungen'
import { GruppeChannels } from './GruppeChannels'
import { GruppeDetail } from './GruppeDetail'
import { GruppeEinstellungen } from './GruppeEinstellungen'
import { GruppeErstellen } from './GruppeErstellen'
import { Gruppen } from './Gruppen'
import { Landing } from './Landing'
import { FlugtreffenLazy, Lazy, MeetupDetailLazy, StyleguideLazy } from './lazy'
import { Login } from './Login'
import { MeetupBearbeiten } from './MeetupBearbeiten'
import { MeetupErstellen } from './MeetupErstellen'
import { Placeholder } from './Placeholder'
import { Profil } from './Profil'
import { ProfilBearbeiten } from './ProfilBearbeiten'
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
            { path: 'flugtreffen/:id/bearbeiten', element: <MeetupBearbeiten /> },
            { path: 'gruppen', element: <Gruppen /> },
            { path: 'gruppen/neu', element: <GruppeErstellen /> },
            { path: 'gruppen/:id', element: <GruppeDetail /> },
            { path: 'gruppen/:id/einstellungen', element: <GruppeEinstellungen /> },
            { path: 'gruppen/:id/channels', element: <GruppeChannels /> },
            { path: 'gruppen/:id/channels/:channelId', element: <GruppeChannels /> },
            { path: 'chat', element: <Chat /> },
            { path: 'chat/:id', element: <Chat /> },
            { path: 'profil/bearbeiten', element: <ProfilBearbeiten /> },
            { path: 'profil/:id', element: <Profil /> },
            { path: 'benachrichtigungen', element: <Benachrichtigungen /> },
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
