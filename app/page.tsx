'use client'

import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/AppShell'
import { LoginPage } from '@/components/auth/LoginPage'
import { RefereePortal } from '@/components/auth/RefereePortal'
import { VolunteerPortal } from '@/components/auth/VolunteerPortal'
import { ProgramDashboard } from '@/components/programs/ProgramDashboard'

export default function Home() {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-cond text-4xl font-black text-white mb-2 tracking-widest">LEAGUEOPS</div>
          <div className="font-cond text-sm text-muted tracking-widest">LOADING...</div>
          <div className="mt-4 flex gap-1 justify-center">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-navy animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  // Role-based routing
  if (userRole?.role === 'referee')        return <RefereePortal />
  if (userRole?.role === 'volunteer')      return <VolunteerPortal />
  if (userRole?.role === 'program_leader') return <ProgramDashboard />

  // Admin, League Admin, or authenticated without role → full app
  return <AppShell />
}
