'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { Cloud, X as XIcon } from 'lucide-react'
import { TopBar } from '@/components/TopBar'
import { StatusRow } from '@/components/StatusRow'
import { RightPanel } from '@/components/RightPanel'
import { DashboardTab } from '@/components/dashboard/DashboardTab'
import { ScheduleTab } from '@/components/schedule/ScheduleTab'
import { CheckInTab } from '@/components/checkin/CheckInTab'
import { RostersTab } from '@/components/rosters/RostersTab'
import { RefsTab } from '@/components/refs/RefsTab'
import { IncidentsTab } from '@/components/incidents/IncidentsTab'
import { WeatherTab } from '@/components/weather/WeatherTab'
import { ParkMapTab } from '@/components/parkmap/ParkMapTab'
import { FieldsTab } from '@/components/fields/FieldsTab'
import { EngineTab } from '@/components/engine/EngineTab'
import { CommandCenter } from '@/components/engine/CommandCenter'
import { RulesTab } from '@/components/rules/RulesTab'
import { ConflictsTab } from '@/components/conflicts/ConflictsTab'
import { UserManagement } from '@/components/auth/UserManagement'
import { ProgramApprovals } from '@/components/programs/ProgramApprovals'
import { LeagueSettingsTab } from '@/components/settings/LeagueSettingsTab'
import { EventSetupTab } from '@/components/settings/EventSetupTab'
import { QRCodesPanel } from '@/components/auth/QRCodesPanel'
import { ReportsTab } from '@/components/reports/ReportsTab'
import { PaymentsTab } from '@/components/payments/PaymentsTab'
import { ScheduleChangeRequestsTab } from '@/components/requests/ScheduleChangeRequestsTab'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export type TabName =
  | 'dashboard'
  | 'schedule'
  | 'requests'
  | 'checkin'
  | 'rosters'
  | 'qrcodes'
  | 'refs'
  | 'conflicts'
  | 'incidents'
  | 'weather'
  | 'parkmap'
  | 'fields'
  | 'engine'
  | 'command'
  | 'rules'
  | 'users'
  | 'programs'
  | 'payments'
  | 'settings'
  | 'reports'

export function AppShell({
  onChangeEvent,
  initialTab,
}: {
  onChangeEvent?: () => void
  initialTab?: TabName
}) {
  const [activeTab, setActiveTab] = useState<TabName>(initialTab ?? 'dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isLg, setIsLg] = useState(false) // default false; corrected on mount

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    setIsLg(mql.matches)
    const handler = (e: MediaQueryListEvent) => {
      setIsLg(e.matches)
      if (e.matches) setDrawerOpen(false) // close drawer when resizing to desktop
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const { state, eventId } = useApp()
  const { userRole, signOut, isAdmin } = useAuth()

  const pendingRequestCount = (state.scheduleChangeRequests ?? []).filter(
    (r) => r.status === 'pending'
  ).length

  const ALL_TABS: { id: TabName; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'requests', label: 'Requests', adminOnly: true },
    { id: 'checkin', label: 'Check-In & QR' },
    { id: 'rosters', label: 'Rosters' },
    { id: 'refs', label: 'Refs & Vols' },
    { id: 'conflicts', label: 'Conflicts' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'weather', label: 'Weather' },
    { id: 'parkmap', label: 'Park Map' },
    { id: 'fields', label: 'Fields', adminOnly: true },
    { id: 'command', label: '⚡ Command' },
    { id: 'engine', label: 'Sched Engine' },
    { id: 'rules', label: 'Rules', adminOnly: true },
    { id: 'users', label: 'Users', adminOnly: true },
    { id: 'programs', label: 'Programs', adminOnly: true },
    { id: 'payments', label: 'Payments', adminOnly: true },
    { id: 'settings', label: 'Settings', adminOnly: true },
    { id: 'reports', label: 'Reports' },
    { id: 'qrcodes', label: 'QR Codes', adminOnly: true },
  ]

  // Build visible tab list based on role permissions
  const rolePerms: Record<string, string[]> = state.event?.role_permissions ?? {}
  const TABS = ALL_TABS.filter((t) => {
    if (t.adminOnly) return isAdmin
    if (isAdmin) return true
    const role = userRole?.role
    if (!role || role === 'league_admin') return true // league_admin sees all non-admin tabs
    const allowed = rolePerms[role]
    if (!allowed || allowed.length === 0) return true // no config = show all
    return allowed.includes(t.id)
  })

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-cond text-4xl font-black text-white mb-2 tracking-widest">
            LEAGUEOPS
          </div>
          <div className="font-cond text-sm text-muted tracking-widest">
            LOADING TOURNAMENT DATA...
          </div>
          <div className="mt-4 flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-navy animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userRole={userRole}
        onSignOut={signOut}
        isAdmin={isAdmin}
        onChangeEvent={onChangeEvent}
        pendingRequestCount={pendingRequestCount}
        rightSlot={<NotificationBell />}
      />
      {state.lightningActive && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 text-white font-cond font-black text-[12px] tracking-widest lightning-flash flex-shrink-0"
          style={{ background: '#7a0000', borderBottom: '1px solid #ff3333' }}
        >
          ⚡ LIGHTNING DELAY ACTIVE — ALL FIELDS SUSPENDED ·{' '}
          {Math.floor(state.lightningSecondsLeft / 60)}:
          {(state.lightningSecondsLeft % 60).toString().padStart(2, '0')} REMAINING
        </div>
      )}
      <StatusRow />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto min-w-0 tab-content">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'schedule' && <ScheduleTab />}
          {activeTab === 'requests' && <ScheduleChangeRequestsTab />}
          {activeTab === 'checkin' && <CheckInTab />}
          {activeTab === 'rosters' && <RostersTab />}
          {activeTab === 'qrcodes' && <QRCodesPanel />}
          {activeTab === 'refs' && <RefsTab />}
          {activeTab === 'conflicts' && <ConflictsTab />}
          {activeTab === 'incidents' && <IncidentsTab />}
          {activeTab === 'weather' && <WeatherTab />}
          {activeTab === 'parkmap' && <ParkMapTab />}
          {activeTab === 'fields' && <FieldsTab />}
          {activeTab === 'command' && <CommandCenter />}
          {activeTab === 'engine' && <EngineTab />}
          {activeTab === 'rules' && <RulesTab />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'programs' && <ProgramApprovals />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'settings' && <EventSetupTab eventId={eventId} />}
          {activeTab === 'reports' && <ReportsTab />}
        </main>
        {isLg && <RightPanel onNavigate={setActiveTab} />}
      </div>

      {/* Mobile FAB for RightPanel - only below lg, only when drawer is closed */}
      {!isLg && !drawerOpen && (
        <button
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-navy flex items-center justify-center shadow-xl border border-border"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open weather and alerts panel"
        >
          <Cloud size={22} className={state.lightningActive ? 'text-yellow-400' : 'text-white'} />
          {state.lightningActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red animate-pulse" />
          )}
        </button>
      )}

      {/* Bottom drawer - only below lg, only when drawer is open */}
      {!isLg && drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-surface-card border-t border-border"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Close button */}
            <div className="flex justify-end px-4">
              <button onClick={() => setDrawerOpen(false)} className="text-muted hover:text-white">
                <XIcon size={16} />
              </button>
            </div>
            <RightPanel
              onNavigate={(tab) => {
                setActiveTab(tab)
                setDrawerOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
