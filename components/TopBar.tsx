'use client'

import { cn } from '@/lib/utils'
import type { TabName } from '@/components/AppShell'
import type { UserRole } from '@/lib/auth'
import { LogOut } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-red/80 text-white',
  league_admin: 'bg-blue-800/80 text-blue-200',
  referee:      'bg-yellow-800/60 text-yellow-300',
  volunteer:    'bg-green-800/60 text-green-300',
}

interface Props {
  tabs: { id: TabName; label: string }[]
  activeTab: TabName
  onTabChange: (tab: TabName) => void
  userRole?: UserRole | null
  onSignOut?: () => void
}

export function TopBar({ tabs, activeTab, onTabChange, userRole, onSignOut }: Props) {
  return (
    <header className="flex items-stretch h-12 bg-navy-dark border-b-2 border-red flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 bg-red flex-shrink-0">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
          <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
          <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
          <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4"/>
        </svg>
        <span className="font-cond text-xl font-black tracking-widest text-white">LEAGUEOPS</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex flex-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-3 h-full font-cond text-[12px] font-bold tracking-widest uppercase',
              'border-r border-border whitespace-nowrap transition-all flex-shrink-0',
              activeTab === tab.id
                ? 'bg-navy text-white border-b-2 border-b-red'
                : 'text-muted hover:bg-white/5 hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right side — live indicator + user */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0 border-l border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
          <span className="font-cond text-[11px] font-black tracking-widest text-red">LIVE</span>
        </div>

        {userRole && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className={cn(
                'font-cond text-[10px] font-black tracking-wider px-2 py-0.5 rounded',
                ROLE_COLORS[userRole.role] ?? 'bg-surface text-muted'
              )}>
                {userRole.role.replace('_', ' ').toUpperCase()}
              </span>
              <span className="font-cond text-[11px] text-white truncate max-w-[120px]">
                {userRole.display_name}
              </span>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title="Sign out"
                  className="text-muted hover:text-white transition-colors p-1"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
