'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
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

export type TabName =
  | 'dashboard' | 'schedule' | 'checkin' | 'rosters' | 'qrcodes'
  | 'refs' | 'conflicts' | 'incidents' | 'weather' | 'parkmap'
  | 'engine' | 'command' | 'rules' | 'users' | 'programs' | 'settings'
  | 'reports'

export function AppShell({ onChangeEvent }: { onChangeEvent?: () => void }) {
  const [activeTab, setActiveTab] = useState<TabName>('dashboard')
  const { state } = useApp()
  const { userRole, signOut, isAdmin } = useAuth()

  const ALL_TABS: { id: TabName; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'schedule',  label: 'Schedule' },
    { id: 'checkin',   label: 'Check-In & QR' },
    { id: 'rosters',   label: 'Rosters' },
    { id: 'refs',      label: 'Refs & Vols' },
    { id: 'conflicts', label: 'Conflicts' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'weather',   label: 'Weather' },
    { id: 'parkmap',   label: 'Park Map' },
    { id: 'command',   label: '⚡ Command' },
    { id: 'engine',    label: 'Sched Engine' },
    { id: 'rules',     label: 'Rules' },
    { id: 'users',     label: 'Users', adminOnly: true },
    { id: 'programs',  label: 'Programs', adminOnly: true },
    { id: 'settings',  label: 'Settings', adminOnly: true },
    { id: 'reports',   label: 'Reports' },
  ]

  // League admins see all tabs except Users
  const TABS = ALL_TABS.filter(t => !t.adminOnly || isAdmin)

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-cond text-4xl font-black text-white mb-2 tracking-widest">LEAGUEOPS</div>
          <div className="font-cond text-sm text-muted tracking-widest">LOADING TOURNAMENT DATA...</div>
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}
        userRole={userRole} onSignOut={signOut} isAdmin={isAdmin} onChangeEvent={onChangeEvent} />
      <StatusRow />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto min-w-0 tab-content">
          {activeTab === 'dashboard'  && <DashboardTab />}
          {activeTab === 'schedule'   && <ScheduleTab />}
          {activeTab === 'checkin'    && <CheckInTab />}
          {activeTab === 'rosters'    && <RostersTab />}
          {activeTab === 'qrcodes'    && <QRCodesPanel />}
          {activeTab === 'refs'       && <RefsTab />}
          {activeTab === 'conflicts'  && <ConflictsTab />}
          {activeTab === 'incidents'  && <IncidentsTab />}
          {activeTab === 'weather'    && <WeatherTab />}
          {activeTab === 'parkmap'    && <ParkMapTab />}
          {activeTab === 'command'    && <CommandCenter />}
          {activeTab === 'engine'     && <EngineTab />}
          {activeTab === 'rules'      && <RulesTab />}
          {activeTab === 'users'      && <UserManagement />}
          {activeTab === 'programs'   && <ProgramApprovals />}
          {activeTab === 'settings'   && <EventSetupTab />}
          {activeTab === 'reports'    && <ReportsTab />}
        </main>
        <RightPanel onNavigate={setActiveTab} />
      </div>
    </div>
  )
}
