'use client'

import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PILLS = [
  { key: 'Scheduled', label: 'SCHED', activeColor: '#60a5fa', bg: '#071830' },
  { key: 'Starting', label: 'START', activeColor: '#fb923c', bg: '#2a1200' },
  { key: 'Live', label: 'LIVE', activeColor: '#22c55e', bg: '#052e14' },
  { key: 'Halftime', label: 'HALF', activeColor: '#facc15', bg: '#1f1800' },
  { key: 'Final', label: 'FINAL', activeColor: '#64748b', bg: '#111520' },
  { key: 'Delayed', label: 'DELAYED', activeColor: '#f87171', bg: '#2a0808' },
]

export function StatusRow() {
  const { state, currentDate, changeDate } = useApp()
  const g = state.games
  const counts: Record<string, number> = {}
  PILLS.forEach((p) => {
    counts[p.key] = g.filter((x) => x.status === p.key).length
  })

  return (
    <div
      className="flex items-stretch flex-shrink-0"
      style={{ height: 38, background: '#020810', borderBottom: '1px solid #1a2d50' }}
    >
      {/* Game status pills */}
      {PILLS.map((p, i) => {
        const count = counts[p.key]
        const active = count > 0
        return (
          <div
            key={p.key}
            className="flex items-center gap-2 px-4"
            style={{ borderRight: '1px solid #1a2d50', background: active ? p.bg : 'transparent' }}
          >
            <span
              className="font-cond text-[22px] font-black leading-none tabular-nums"
              style={{
                color: active ? p.activeColor : '#1e2d40',
                textShadow: active && p.key === 'Live' ? `0 0 12px ${p.activeColor}60` : 'none',
              }}
            >
              {count}
            </span>
            <span
              className="font-cond text-[9px] font-black tracking-[.12em]"
              style={{ color: active ? p.activeColor : '#1e2d40' }}
            >
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
      <div
        className="flex items-center gap-1.5 px-3 ml-auto"
        style={{ borderLeft: '1px solid #1a2d50' }}
      >
        <button
          onClick={() => changeDate(-1)}
          className={cn(
            'font-cond text-[10px] font-black tracking-[.1em] px-2.5 py-1 rounded transition-colors',
            state.currentDateIdx === -1
              ? 'bg-blue-600 text-white'
              : 'text-muted hover:text-white hover:bg-white/5'
          )}
        >
          ALL
        </button>

        <button
          onClick={() =>
            changeDate(Math.max(0, state.currentDateIdx === -1 ? 0 : state.currentDateIdx - 1))
          }
          disabled={state.currentDateIdx === 0 || state.currentDateIdx === -1}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20 text-muted hover:text-white"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex flex-col items-center justify-center min-w-[130px] px-1">
          {state.currentDateIdx === -1 ? (
            <span className="font-cond text-[13px] font-black text-blue-300 tracking-wide">
              ALL DATES
            </span>
          ) : currentDate ? (
            <>
              {(() => {
                const first = state.eventDates[0]
                const wk = first
                  ? Math.floor(
                      (new Date(currentDate.date + 'T00:00:00').getTime() -
                        new Date(first.date + 'T00:00:00').getTime()) /
                        (7 * 24 * 60 * 60 * 1000)
                    ) + 1
                  : 1
                const multiWeek =
                  state.eventDates.length > 1 &&
                  Math.floor(
                    (new Date(
                      state.eventDates[state.eventDates.length - 1].date + 'T00:00:00'
                    ).getTime() -
                      new Date(state.eventDates[0].date + 'T00:00:00').getTime()) /
                      (7 * 24 * 60 * 60 * 1000)
                  ) >= 1
                return (
                  <>
                    <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                      {multiWeek ? `WK ${wk} · ` : ''}
                      {currentDate.label}
                    </span>
                    <span className="font-cond text-[13px] font-black text-white tracking-wide">
                      {format(parseISO(currentDate.date), 'EEE, MMM d')}
                    </span>
                  </>
                )
              })()}
            </>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>

        <button
          onClick={() =>
            changeDate(
              Math.min(
                state.eventDates.length - 1,
                state.currentDateIdx === -1 ? 0 : state.currentDateIdx + 1
              )
            )
          }
          disabled={state.currentDateIdx >= state.eventDates.length - 1}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20 text-muted hover:text-white"
        >
          <ChevronRight size={14} />
        </button>

        <span className="font-cond text-[9px] font-black tracking-[.1em] text-[#1e2d40] ml-0.5 hidden sm:block">
          {state.currentDateIdx === -1
            ? `${state.eventDates.length} DAYS`
            : `${state.currentDateIdx + 1}/${state.eventDates.length}`}
        </span>
      </div>
    </div>
  )
}
