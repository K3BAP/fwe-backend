import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './store/session'
import { useAdminAuth } from './store/adminAuth'
import StartPage from './pages/StartPage'
import JoinPage from './pages/participant/JoinPage'
import RestorePage from './pages/participant/RestorePage'
import InstallScreen from './pages/participant/InstallScreen'
import ParticipantLayout from './pages/participant/ParticipantLayout'
import TeamPage from './pages/participant/TeamPage'
import TasksPage from './pages/participant/TasksPage'
import TaskDetailPage from './pages/participant/TaskDetailPage'
import LeaderboardPage from './pages/participant/LeaderboardPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import RallyeEditorPage from './pages/admin/RallyeEditorPage'
import EvaluationPage from './pages/admin/EvaluationPage'
import ScannerPage from './pages/admin/ScannerPage'
import ParticipantsPage from './pages/admin/ParticipantsPage'
import AdminLeaderboardPage from './pages/admin/LeaderboardPage'
import AdminsPage from './pages/admin/AdminsPage'

function RequireParticipant({ children }: { children: ReactNode }) {
  const token = useSession((s) => s.token)
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const token = useAdminAuth((s) => s.token)
  if (!token) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/r/:code" element={<JoinPage />} />
      <Route path="/s/:token" element={<RestorePage />} />

      {/* PWA-Installation: Vollbild-Schritt direkt nach dem Beitritt. */}
      <Route
        path="/install"
        element={
          <RequireParticipant>
            <InstallScreen />
          </RequireParticipant>
        }
      />

      {/* Teilnehmer-Bereich */}
      <Route
        path="/rallye"
        element={
          <RequireParticipant>
            <ParticipantLayout />
          </RequireParticipant>
        }
      >
        <Route index element={<TasksPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="task/:id" element={<TaskDetailPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>

      {/* Admin-Bereich */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="rallye/:id" element={<RallyeEditorPage />} />
        <Route path="rallye/:id/evaluate" element={<EvaluationPage />} />
        <Route path="rallye/:id/participants" element={<ParticipantsPage />} />
        <Route path="rallye/:id/leaderboard" element={<AdminLeaderboardPage />} />
        <Route path="scan" element={<ScannerPage />} />
        <Route path="admins" element={<AdminsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
