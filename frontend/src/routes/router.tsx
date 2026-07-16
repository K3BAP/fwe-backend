import { createBrowserRouter } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireGuest } from '@/components/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { GuestLayout } from '@/components/layout/GuestLayout'
import { Chat } from './Chat'
import { Dashboard } from './Dashboard'
import { Einstellungen } from './Einstellungen'
import { GruppeChannels } from './GruppeChannels'
import { GruppeDetail } from './GruppeDetail'
import { GruppeEinstellungen } from './GruppeEinstellungen'
import { GruppeErstellen } from './GruppeErstellen'
import { Gruppen } from './Gruppen'
import { Landing } from './Landing'
import {
  AdminBenutzerLazy,
  AdminFlugtreffenLazy,
  AdminGruppenLazy,
  AdminLayoutLazy,
  AdminOverviewLazy,
  AdminSpotsLazy,
  FlugtreffenLazy,
  Lazy,
  MeetupDetailLazy,
  StyleguideLazy,
} from './lazy'
import { Login } from './Login'
import { MeetupErstellen } from './MeetupErstellen'
import { NotFound } from './NotFound'
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
        {
          element: <GuestLayout />,
          children: [
            { path: '/landing', element: <Landing /> },
            { path: '/login', element: <Login /> },
            { path: '/register', element: <Register /> },
          ],
        },
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
            { path: 'einstellungen', element: <Einstellungen /> },
            { path: 'styleguide', element: <Lazy><StyleguideLazy /></Lazy> },
            // Admin-Bereich (ADR-019). Der Guard ist reine UX — durchgesetzt wird der Zugriff
            // serverseitig vom `admin`-Filter.
            {
              path: 'admin',
              element: <RequireAdmin />,
              children: [
                {
                  element: <Lazy><AdminLayoutLazy /></Lazy>,
                  children: [
                    { index: true, element: <Lazy><AdminOverviewLazy /></Lazy> },
                    { path: 'benutzer', element: <Lazy><AdminBenutzerLazy /></Lazy> },
                    { path: 'flugtreffen', element: <Lazy><AdminFlugtreffenLazy /></Lazy> },
                    { path: 'gruppen', element: <Lazy><AdminGruppenLazy /></Lazy> },
                    { path: 'spots', element: <Lazy><AdminSpotsLazy /></Lazy> },
                  ],
                },
              ],
            },
            { path: '*', element: <NotFound /> },
          ],
        },
      ],
    },
  ],
  { basename: basename || undefined },
)
