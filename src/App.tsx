import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useNav } from './contexts/NavContext'
import { useAuth } from './contexts/AuthContext'
import { isConfigured } from './services/supabase'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/AuthPage'
import { TodayPage } from './pages/TodayPage'
import { ProfilePage } from './pages/ProfilePage'
import { FitnessPage } from './pages/FitnessPage'
import { ProgressPage } from './pages/ProgressPage'
import { CoachPage } from './pages/CoachPage'
import { SleepPage } from './pages/SleepPage'
import { HealthPage } from './pages/HealthPage'
import { MembershipPage } from './pages/MembershipPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ChatPage, MessagesPage } from './pages/MessagesPage'
import { TeamPage } from './pages/TeamPage'
import { ClientPage } from './pages/ClientPage'
import { AdminPage } from './pages/AdminPage'
import { BodyDetailsPage } from './pages/BodyDetailsPage'
import { MusclesPage } from './features/workout/MusclesPage'
import { WorkoutBuilder } from './features/workout/WorkoutBuilder'
import { WorkoutDayFlow } from './features/workout/WorkoutDayFlow'
import { RecoveryPage } from './features/workout/RecoveryPage'
import { AssetDiagnostics } from './features/diagnostics/AssetDiagnostics'
import { useNativeSync } from './hooks/useNativeSync'
import { usePendingWorkouts } from './hooks/usePendingWorkouts'
import { Skeleton } from './components/ui/Skeleton'
import { Button } from './components/ui/Button'

function Notice({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-ink">
      <div role="alert" className="grid max-w-sm gap-3 rounded-card border border-line bg-card p-6 text-center shadow-card">
        <AlertTriangle className="mx-auto text-warn" />
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-sm text-ink2">{text}</p>
        {action}
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading, profileError, signOut } = useAuth()
  const nav = useNav()
  const { tab, detail } = nav
  const staff = profile?.role !== 'member'
  const admin = profile?.role === 'owner' || profile?.role === 'admin'
  useNativeSync(profile ?? null)
  usePendingWorkouts(profile ?? null)

  if (!isConfigured) return <Notice title="App not configured" text="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment, then redeploy." />
  if (loading) return <div className="min-h-screen bg-bg p-6"><Skeleton className="mx-auto mt-10 h-72 max-w-md" /></div>
  if (!session) return <AuthPage />
  if (!profile) return <Notice title="Profile not found" text={profileError ?? 'Your account has no profile yet.'} action={<Button variant="soft" onClick={() => void signOut()}>Sign out</Button>} />

  function detailView() {
    switch (detail?.id) {
      case 'sleep': return <SleepPage />
      case 'health': return <HealthPage />
      case 'notifications': return <NotificationsPage />
      case 'messages': return <MessagesPage />
      case 'chat': return <ChatPage />
      case 'membership': return <MembershipPage />
      case 'bodydetails': return <BodyDetailsPage />
      case 'muscles': return <MusclesPage />
      case 'workoutday': return <WorkoutDayFlow />
      case 'recovery': return <RecoveryPage />
      case 'assets3d': return <AssetDiagnostics />
      case 'builder': return staff ? <WorkoutBuilder /> : null
      case 'team': return staff ? <TeamPage /> : null
      case 'client': return staff ? <ClientPage /> : null
      case 'admin': return admin ? <AdminPage /> : null
      default: return null
    }
  }

  return (
    <AppShell tab={tab} onChange={nav.go}>
      {detail ? detailView() : (
        <>
          {tab === 'today' && <TodayPage />}
          {tab === 'fitness' && <FitnessPage />}
          {tab === 'coach' && <CoachPage />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'profile' && <ProfilePage />}
        </>
      )}
    </AppShell>
  )
}
