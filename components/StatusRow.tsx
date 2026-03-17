'use client'

import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PILLS = [
  { key: 'Scheduled', label: 'SCHED',   activeColor: '#60a5fa', bg: '#071830' },
  { key: 'Starting',  label: 'START',   activeColor: '#fb923c', bg: '#2a1200' },
  { key: 'Live',      label: 'LIVE',    activeColor: '#22c55e', bg: '#052e14' },
  { key: 'Halftime',  label: 'HALF',    activeColor: '#facc15', bg: '#1f1800' },
  { key: 'Final',     label: 'FINAL',   activeColor: '#64748b', bg: '#111520' },
  { key: 'Delayed',   label: 'DELAYED', activeColor: '#f87171', bg: '#2a0808' },
]

export function StatusRow() {
  const { state, currentDate, changeDate } = useApp()
  const g = state.games
  const counts: Record<string,number> = {}
  PILLS.forEach(p => { counts[p.key] = g.filter(x => x.status === p.key).length })

  return (
    <div className="flex items-stretch flex-shrink-0"
      style={{ height: 38, background: '#020810', borderBottom: '1px solid #1a2d50' }}>

      {/* Game status pills */}
      {PILLS.map((p, i) => {
        const count  = counts[p.key]
        const active = count > 0
        return (
          <div key={p.key} className="flex items-center gap-2 px-4"
            style={{ borderRight: '1px solid #1a2d50', background: active ? p.bg : 'transparent' }}>
            <span className="font-cond text-[22px] font-black leading-none tabular-nums"
              style={{ color: active ? p.activeColor : '#1e2d40', textShadow: active && p.key === 'Live' ? `0 0 12px ${p.activeColor}60` : 'none' }}>
              {count}
            </span>
            <span className="font-cond text-[9px] font-black tracking-[.12em]"
              style={{ color: active ? p.activeColor : '#1e2d40' }}>
              {p.label}
            </span>
            {/* Live pulse dot */}
            {p.key === 'Live' && active && (
              <div className="relative w-1.5 h-1.5 ml-0.5">
                <div className="absolute inset-0 rounded-full bg-green-500/30 live-dot scale-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 relative z-10" />
              </div>
            )}
          </div>
        )
      })}

      <div className="flex-1" />

      {/* Date nav */}
      <div className="flex items-center gap-2 px-4" style={{ borderLeft: '1px solid #1a2d50' }}>
        <button onClick={() => changeDate(Math.max(0, state.currentDateIdx - 1))}
          disabled={state.currentDateIdx === 0}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20"
          style={{ color: '#5a6e9a' }} onMouseEnter={e => (e.currentTarget.style.color='white')} onMouseLeave={e => (e.currentTarget.style.color='#5a6e9a')}>
          <ChevronLeft size={14} />
        </button>

        <div className="font-cond text-[13px] font-black text-white tracking-wide px-1 min-w-[155px] text-center">
          {currentDate?.label ?? '—'}
        </div>

        <button onClick={() => changeDate(Math.min(state.eventDates.length - 1, state.currentDateIdx + 1))}
          disabled={state.currentDateIdx >= state.eventDates.length - 1}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20"
          style={{ color: '#5a6e9a' }} onMouseEnter={e => (e.currentTarget.style.color='white')} onMouseLeave={e => (e.currentTarget.style.color='#5a6e9a')}>
          <ChevronRight size={14} />
        </button>

        <span className="font-cond text-[10px] font-black tracking-[.1em] ml-1" style={{ color: '#1e2d40' }}>
          DAY {state.currentDateIdx + 1}/{state.eventDates.length}
        </span>
      </div>
    </div>
  )
}
