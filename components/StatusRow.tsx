'use client'

import { useApp } from '@/lib/store'

export function StatusRow() {
  const { state, currentDate, changeDate } = useApp()
  const g = state.games

  const counts = {
    scheduled: g.filter(x => x.status === 'Scheduled').length,
    starting:  g.filter(x => x.status === 'Starting').length,
    live:      g.filter(x => x.status === 'Live').length,
    halftime:  g.filter(x => x.status === 'Halftime').length,
    final:     g.filter(x => x.status === 'Final').length,
    delayed:   g.filter(x => x.status === 'Delayed').length,
  }

  const pills = [
    { label: 'SCHEDULED', count: counts.scheduled, color: 'text-blue-300' },
    { label: 'STARTING',  count: counts.starting,  color: 'text-orange-400' },
    { label: 'LIVE',      count: counts.live,       color: 'text-green-400' },
    { label: 'HALFTIME',  count: counts.halftime,   color: 'text-yellow-400' },
    { label: 'FINAL',     count: counts.final,      color: 'text-gray-400' },
    { label: 'DELAYED',   count: counts.delayed,    color: 'text-red-400' },
  ]

  return (
    <div className="flex items-center h-10 bg-surface-panel border-b border-border flex-shrink-0 px-0">
      {pills.map((p, i) => (
        <div key={p.label}
          className="flex items-center gap-1.5 px-4 border-r border-border h-full">
          <span className={`font-cond text-xl font-black leading-none ${p.color}`}>{p.count}</span>
          <span className="font-cond text-[10px] font-bold tracking-wider text-muted">{p.label}</span>
        </div>
      ))}

      {/* Date controls */}
      <div className="flex items-center gap-2 ml-auto px-3">
        <button
          onClick={() => changeDate(Math.max(0, state.currentDateIdx - 1))}
          disabled={state.currentDateIdx === 0}
          className="font-cond text-[11px] font-bold px-2 py-0.5 bg-surface-card border border-border rounded text-muted hover:text-white hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >◀</button>

        <div className="font-cond text-[13px] font-bold text-blue-300 tracking-widest min-w-[170px] text-center">
          {currentDate?.label ?? '—'}
        </div>

        <button
          onClick={() => changeDate(Math.min(state.eventDates.length - 1, state.currentDateIdx + 1))}
          disabled={state.currentDateIdx >= state.eventDates.length - 1}
          className="font-cond text-[11px] font-bold px-2 py-0.5 bg-surface-card border border-border rounded text-muted hover:text-white hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >▶</button>

        <div className="font-cond text-[11px] font-bold text-blue-300 tracking-widest ml-1">
          DAY {state.currentDateIdx + 1} OF {state.eventDates.length}
        </div>
      </div>
    </div>
  )
}
