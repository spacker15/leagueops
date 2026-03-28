'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { TabName } from '@/components/AppShell'
import type { UserRole } from '@/lib/auth'
import { LogOut, ChevronDown } from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red text-white',
  league_admin: 'bg-[#1a52b8] text-white',
  referee: 'bg-amber-600 text-white',
  volunteer: 'bg-emerald-700 text-white',
}

// Nav groups — each can be a single tab or a dropdown
interface NavGroup {
  label: string
  tab?: TabName // direct single tab
  items?: { id: TabName; label: string }[] // dropdown items
  adminOnly?: boolean
  accent?: boolean // highlight color (command center)
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'DASHBOARD', tab: 'dashboard' },
  {
    label: 'SCHEDULE',
    items: [
      { id: 'schedule', label: 'Schedule' },
      { id: 'conflicts', label: 'Conflicts' },
      { id: 'engine', label: 'Sched Engine' },
    ],
  },
  {
    label: 'GAME DAY',
    items: [
      { id: 'checkin', label: 'Check-In & QR' },
      { id: 'incidents', label: 'Incidents' },
      { id: 'weather', label: 'Weather' },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { id: 'rosters', label: 'Rosters' },
      { id: 'refs', label: 'Refs & Vols' },
      { id: 'parkmap', label: 'Park Map' },
    ],
  },
  { label: '⚡ COMMAND', tab: 'command', accent: true },
  { label: 'REPORTS', tab: 'reports' },
  {
    label: 'ADMIN',
    adminOnly: true,
    items: [
      { id: 'rules', label: 'Rules' },
      { id: 'fields', label: 'Fields' },
      { id: 'programs', label: 'Programs' },
      { id: 'payments', label: 'Payments' },
      { id: 'users', label: 'Users' },
      { id: 'qrcodes', label: 'QR Codes' },
      { id: 'settings', label: 'Settings' },
    ],
  },
]

interface Props {
  tabs: { id: TabName; label: string; adminOnly?: boolean }[]
  activeTab: TabName
  onTabChange: (tab: TabName) => void
  userRole?: UserRole | null
  onSignOut?: () => void
  isAdmin?: boolean
  onChangeEvent?: () => void // ← ADD THIS LINE
  rightSlot?: React.ReactNode
}

export function TopBar({
  tabs,
  activeTab,
  onTabChange,
  userRole,
  onSignOut,
  isAdmin,
  onChangeEvent,
  rightSlot,
}: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Check if any item in a group is the active tab
  function groupIsActive(group: NavGroup) {
    if (group.tab) return activeTab === group.tab
    return group.items?.some((i) => i.id === activeTab) ?? false
  }

  // Find which group label to show as active sub-label
  function activeSubLabel(group: NavGroup): string | null {
    if (!group.items) return null
    const active = group.items.find((i) => i.id === activeTab)
    return active?.label ?? null
  }

  // Resolve groups — filter admin-only if not admin
  const visibleGroups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin)

  return (
    <header
      className="flex items-stretch flex-shrink-0"
      style={{ height: 48, background: '#030d20', borderBottom: '2px solid #1a2d50' }}
    >
      {/* Wordmark */}
      <div
        className="flex items-center gap-2.5 pl-4 pr-5 flex-shrink-0"
        style={{ borderRight: '1px solid #1a2d50' }}
      >
        <div className="w-1 h-5 rounded-sm bg-red mr-1" />
        <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
          <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
          <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
          <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.35" />
        </svg>
        <span className="font-cond text-[18px] font-black tracking-[0.15em] text-white ml-1">
          LEAGUEOPS
        </span>
      </div>

      {/* Grouped nav */}
      <nav ref={navRef} className="flex flex-1">
        {visibleGroups.map((group) => {
          const active = groupIsActive(group)
          const subLabel = activeSubLabel(group)
          const isOpen = openGroup === group.label
          const isDirect = !!group.tab

          const labelColor = group.accent
            ? active
              ? '#fbbf24'
              : '#d97706'
            : active
              ? '#ffffff'
              : '#4a5e80'

          return (
            <div key={group.label} className="relative flex items-stretch">
              <button
                className="flex items-center gap-1.5 px-4 h-full transition-all relative"
                style={{
                  background: isOpen ? '#081428' : active ? 'rgba(11,61,145,0.15)' : 'transparent',
                  borderRight: '1px solid #1a2d50',
                }}
                onClick={() => {
                  if (isDirect) {
                    onTabChange(group.tab!)
                    setOpenGroup(null)
                  } else {
                    setOpenGroup(isOpen ? null : group.label)
                  }
                }}
              >
                {/* Active underline */}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: group.accent ? '#fbbf24' : '#D62828' }}
                  />
                )}

                <div className="flex flex-col items-start leading-none">
                  <span
                    className="font-cond text-[11px] font-black tracking-[0.12em]"
                    style={{ color: labelColor }}
                  >
                    {group.label}
                  </span>
                  {/* Show which sub-item is active */}
                  {subLabel && (
                    <span
                      className="font-cond text-[9px] tracking-wide mt-0.5"
                      style={{ color: '#3a5070' }}
                    >
                      {subLabel}
                    </span>
                  )}
                </div>

                {!isDirect && (
                  <ChevronDown
                    size={10}
                    className="flex-shrink-0 transition-transform"
                    style={{
                      color: labelColor,
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      marginTop: subLabel ? '-4px' : undefined,
                    }}
                  />
                )}
              </button>

              {/* Dropdown */}
              {!isDirect && isOpen && (
                <div
                  className="absolute top-full left-0 z-50 py-1 rounded-b-xl shadow-2xl min-w-[160px]"
                  style={{ background: '#061428', border: '1px solid #1a2d50', borderTop: 'none' }}
                >
                  {group.items!.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id)
                        setOpenGroup(null)
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                      style={{
                        background: activeTab === item.id ? 'rgba(11,61,145,0.3)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== item.id)
                          (e.currentTarget as HTMLElement).style.background =
                            'rgba(255,255,255,0.04)'
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== item.id)
                          (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                    >
                      {activeTab === item.id && (
                        <span className="w-1 h-4 rounded-sm bg-red flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          'font-cond text-[12px] font-black tracking-[0.08em]',
                          activeTab === item.id ? 'text-white' : 'text-[#5a6e9a]'
                        )}
                      >
                        {item.label.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Right — live + user */}
      <div
        className="flex items-center gap-4 px-5 flex-shrink-0"
        style={{ borderLeft: '1px solid #1a2d50' }}
      >
        <div className="flex items-center gap-2">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-red/25 live-dot scale-150" />
            <div className="w-2 h-2 rounded-full bg-red relative z-10" />
          </div>
          <span className="font-cond text-[11px] font-black tracking-[.15em] text-red">LIVE</span>
        </div>

        {rightSlot}

        {userRole && (
          <div
            className="flex items-center gap-2.5 pl-4"
            style={{ borderLeft: '1px solid #1a2d50' }}
          >
            <span
              className={cn(
                'font-cond text-[9px] font-black tracking-[.12em] px-2 py-1 rounded',
                ROLE_BADGE[userRole.role] ?? 'bg-[#1a2d50] text-muted'
              )}
            >
              {userRole.role.replace('_', ' ').toUpperCase()}
            </span>
            <span className="font-cond text-[13px] font-bold text-white truncate max-w-[110px]">
              {userRole.display_name}
            </span>
            {onChangeEvent && (
              <button
                onClick={onChangeEvent}
                className="font-cond text-[9px] font-black tracking-[.1em] px-2 py-1 rounded border border-[#1a2d50] text-[#5a6e9a] hover:text-white hover:border-blue-400 transition-colors"
              >
                ⊞ EVENTS
              </button>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign out"
                className="text-[#4a5e80] hover:text-white transition-colors"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
