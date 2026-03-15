'use client'

import { cn } from '@/lib/utils'
import type { TabName } from '@/components/AppShell'

interface Props {
  tabs: { id: TabName; label: string }[]
  activeTab: TabName
  onTabChange: (tab: TabName) => void
}

export function TopBar({ tabs, activeTab, onTabChange }: Props) {
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

      {/* Title separator */}
      <div className="px-4 flex items-center border-r border-border flex-shrink-0">
        <span className="font-cond text-[11px] font-bold tracking-[3px] text-muted uppercase">
          Tournament Command Center
        </span>
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

      {/* Live indicator */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
        <span className="font-cond text-[11px] font-black tracking-widest text-red">LIVE</span>
      </div>
    </header>
  )
}
