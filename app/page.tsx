'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/components/AppShell'
import type { TabName } from '@/components/AppShell'
import { LoginPage } from '@/components/auth/LoginPage'
import { RefereePortal } from '@/components/auth/RefereePortal'
import { VolunteerPortal } from '@/components/auth/VolunteerPortal'
import { ProgramDashboard } from '@/components/programs/ProgramDashboard'
import { PendingApprovalScreen } from '@/components/programs/PendingApprovalScreen'
import { EventPicker } from '@/components/events/EventPicker'

export default function Home() {
  const { user, userRole, loading } = useAuth()
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [isNewEvent, setIsNewEvent] = useState(false)
  const [deepLinkTab, setDeepLinkTab] = useState<TabName | undefined>(undefined)

  // Read ?tab= query param for deep links (e.g. from notifications: ?tab=requests)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab') as TabName | null
      if (tab) setDeepLinkTab(tab)
    }
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#020810' }}>
        <div className="text-center">
          <div className="font-cond text-4xl font-black text-white mb-2 tracking-widest">
            LEAGUEOPS
          </div>
          <div className="font-cond text-sm tracking-widest" style={{ color: '#5a6e9a' }}>
            LOADING...
          </div>
          <div className="mt-4 flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-red animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (userRole?.role === 'referee') return <RefereePortal />
  if (userRole?.role === 'volunteer') return <VolunteerPortal />

  if (userRole?.role === 'program_leader') {
    if (!userRole.is_active) return <PendingApprovalScreen />
    return <ProgramDashboard />
  }

  // Admin / League Admin — need to pick an event first
  if (!user) return <PendingApprovalScreen />

  if (!selectedEventId) {
    return (
      <EventPicker
        onSelectEvent={(id, isNew) => {
          setSelectedEventId(id)
          setIsNewEvent(isNew ?? false)
        }}
      />
    )
  }

  // Full app with selected event
  return (
    <AppProvider eventId={selectedEventId}>
      <AppShell
        onChangeEvent={() => {
          setSelectedEventId(null)
          setIsNewEvent(false)
        }}
        initialTab={deepLinkTab ?? (isNewEvent ? 'settings' : 'dashboard')}
      />
    </AppProvider>
  )
}
