'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Tab components
import { DashboardTab } from '@/components/tabs/DashboardTab'
import { SportsTab } from '@/components/tabs/SportsTab'
import { ScheduleTab } from '@/components/tabs/ScheduleTab'
import { RostersTab } from '@/components/tabs/RostersTab'
import { StatsTab } from '@/components/tabs/StatsTab'
import { VolunteersTab } from '@/components/tabs/VolunteersTab'
import { CoachesTab } from '@/components/tabs/CoachesTab'
import { IncidentsTab } from '@/components/tabs/IncidentsTab'
import { SettingsTab } from '@/components/tabs/SettingsTab'

export type TabName =
  | 'dashboard'
  | 'sports'
  | 'schedule'
  | 'rosters'
  | 'stats'
  | 'volunteers'
  | 'coaches'
  | 'incidents'
  | 'settings'

interface TabDef {
  id: TabName
  label: string
  adminOnly?: boolean
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sports', label: 'Sports', adminOnly: true },
  { id: 'schedule', label: 'Schedule' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'stats', label: 'Stats' },
  { id: 'volunteers', label: 'Volunteers' },
  { id: 'coaches', label: 'Coaches', adminOnly: true },
  { id: 'incidents', label: 'Incidents' },
  { id: 'settings', label: 'Settings', adminOnly: true },
]

function TabContent({ tab }: { tab: TabName }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardTab />
    case 'sports':
      return <SportsTab />
    case 'schedule':
      return <ScheduleTab />
    case 'rosters':
      return <RostersTab />
    case 'stats':
      return <StatsTab />
    case 'volunteers':
      return <VolunteersTab />
    case 'coaches':
      return <CoachesTab />
    case 'incidents':
      return <IncidentsTab />
    case 'settings':
      return <SettingsTab />
    default:
      return null
  }
}

export function AppShell({ initialTab = 'dashboard' }: { initialTab?: TabName }) {
  const { school, loading } = useApp()
  const { user, signOut, canManage } = useAuth()
  const [activeTab, setActiveTab] = useState<TabName>(initialTab)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const visibleTabs = TABS.filter((t) => !t.adminOnly || canManage)

  if (loading) {
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

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* ── Header ── */}
      <header className="bg-navy-dark border-b-2 border-red shrink-0 flex items-center px-4 h-12 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 bg-red rounded flex items-center justify-center">
            <span className="font-cond font-black text-white text-[10px]">CA</span>
          </div>
          <span className="font-cond font-black tracking-widest uppercase text-[13px] text-white leading-none">
            Creekside AD
          </span>
        </div>

        {/* School name */}
        {school && (
          <span className="font-cond text-[11px] text-muted tracking-wide hidden sm:block">
            {school.name}
          </span>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-border hidden md:block" />

        {/* Desktop tabs */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'font-cond font-black tracking-widest uppercase text-[11px] px-3 py-1.5 rounded transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-red text-white'
                  : 'text-muted hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right side: user + signout */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {user?.email && (
            <span className="font-cond text-[11px] text-muted hidden sm:block truncate max-w-[160px]">
              {user.email}
            </span>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="text-muted hover:text-white transition-colors p-1 rounded"
          >
            <LogOut size={15} />
          </button>
          {/* Mobile hamburger */}
          <button
            className="md:hidden text-muted hover:text-white transition-colors p-1 rounded"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* ── Mobile nav drawer ── */}
      {mobileNavOpen && (
        <div className="md:hidden bg-navy-dark border-b border-border shrink-0">
          <nav className="flex flex-col py-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setMobileNavOpen(false)
                }}
                className={cn(
                  'font-cond font-black tracking-widest uppercase text-[11px] px-4 py-2.5 text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-red/20 text-white border-l-2 border-red'
                    : 'text-muted hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">
        <TabContent tab={activeTab} />
      </main>
    </div>
  )
}
