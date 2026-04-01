'use client'

import { useAuth } from '@/lib/auth'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/components/shell/AppShell'
import { CoachShell } from '@/components/coach/CoachShell'
import { PublicPortal } from '@/components/public/PublicPortal'
import LoginPage from '@/app/login/page'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
        <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
          Loading
        </span>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, userRole, loading, isAdmin, isAthleticDirector, isCoach } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <LoginPage />

  // Admin or Athletic Director: full AD portal
  if (isAdmin || isAthleticDirector) {
    const schoolId = userRole?.school_id ?? 1
    return (
      <AppProvider schoolId={schoolId}>
        <AppShell />
      </AppProvider>
    )
  }

  // Coach: coach portal (CoachShell manages its own AppProvider)
  if (isCoach) {
    return <CoachShell />
  }

  // Parent / athlete / public: read-only portal
  return <PublicPortal schoolId={userRole?.school_id ?? 1} />
}
