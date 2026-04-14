'use client'

import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/supabase/client'
import toast from 'react-hot-toast'

const PILLS = [
  { key: 'Scheduled', label: 'SCHED', activeColor: '#60a5fa', bg: '#071830' },
  { key: 'Starting', label: 'START', activeColor: '#fb923c', bg: '#2a1200' },
  { key: 'Live', label: 'LIVE', activeColor: '#22c55e', bg: '#052e14' },
  { key: 'Halftime', label: 'HALF', activeColor: '#facc15', bg: '#1f1800' },
  { key: 'Final', label: 'FINAL', activeColor: '#64748b', bg: '#111520' },
  { key: 'Delayed', label: 'DELAYED', activeColor: '#f87171', bg: '#2a0808' },
]

export function StatusRow() {
  const { state, currentDate, changeDate, updateMedicalStatus } = useApp()
  const g = state.games
  const counts: Record<string, number> = {}
  PILLS.forEach((p) => {
    counts[p.key] = g.filter((x) => x.status === p.key).length
  })

  const activeDispatches = state.medicalIncidents.filter(
    (m) => m.status !== 'Resolved' && m.status !== 'Released'
  )

  // First and last game time
  let firstGameTime = ''
  let firstGameMin = Infinity
  let lastGameTime = ''
  let lastGameMin = 0
  for (const game of g) {
    const m = game.scheduled_time?.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) continue
    let h = parseInt(m[1])
    const min = parseInt(m[2])
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
    const total = h * 60 + min
    if (total < firstGameMin) {
      firstGameMin = total
      firstGameTime = game.scheduled_time
    }
    if (total > lastGameMin) {
      lastGameMin = total
      lastGameTime = game.scheduled_time
    }
  }

  // Week label
  const first = state.eventDates[0]
  const wk =
    first && currentDate
      ? Math.floor(
          (new Date(currentDate.date + 'T00:00:00').getTime() -
            new Date(first.date + 'T00:00:00').getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        ) + 1
      : 1
  const multiWeek =
    state.eventDates.length > 1 &&
    Math.floor(
      (new Date(state.eventDates[state.eventDates.length - 1].date + 'T00:00:00').getTime() -
        new Date(state.eventDates[0].date + 'T00:00:00').getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    ) >= 1

  return (
    <div className="flex-shrink-0">
      {/* Medical dispatch banner */}
      {activeDispatches.length > 0 && (
        <div
          className="px-3 sm:px-4 py-1.5"
          style={{ background: '#3b0808', borderBottom: '1px solid #7f1d1d' }}
        >
          {activeDispatches.map((m) => (
            <div key={m.id} className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-[14px] animate-pulse">🚨</span>
              <span className="font-cond text-[10px] sm:text-[11px] font-black tracking-widest text-red-300 uppercase">
                TRAINER DISPATCHED
              </span>
              <span className="font-cond text-[10px] sm:text-[11px] text-red-200 flex-1">
                {m.trainer_name} → {m.field?.name ?? `Field ${m.field_id}`}
                {m.player_name ? ` · ${m.player_name}` : ''}
                <span className="text-red-400 font-bold ml-1.5">{m.status.toUpperCase()}</span>
              </span>
              <button
                onClick={async () => {
                  const sb = createClient()
                  await sb.from('medical_incidents').update({ status: 'Resolved' }).eq('id', m.id)
                  updateMedicalStatus(m.id, 'Resolved')
                  toast.success('Dispatch resolved')
                }}
                className="font-cond text-[9px] sm:text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors flex-shrink-0"
              >
                RESOLVE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile: date nav on top row, pills below */}
      {/* Desktop: single row with pills + date nav */}
      <div style={{ background: '#020810', borderBottom: '1px solid #1a2d50' }}>
        {/* Date nav — full width on mobile, right-aligned on desktop */}
        <div
          className="flex items-center justify-between sm:justify-end gap-1.5 px-2 sm:px-3 sm:hidden"
          style={{ height: 36, borderBottom: '1px solid #1a2d50' }}
        >
          <button
            onClick={() => changeDate(-1)}
            className={cn(
              'font-cond text-[11px] font-black tracking-[.1em] px-3 py-1 rounded transition-colors',
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
            className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-20 text-muted active:text-white"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-col items-center justify-center flex-1 px-1">
            {state.currentDateIdx === -1 ? (
              <span className="font-cond text-[14px] font-black text-blue-300 tracking-wide">
                ALL DATES
              </span>
            ) : currentDate ? (
              <>
                <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                  {multiWeek ? `WK ${wk} · ` : ''}
                  {currentDate.label}
                </span>
                <span className="font-cond text-[14px] font-black text-white tracking-wide">
                  {format(parseISO(currentDate.date), 'EEE, MMM d')}
                </span>
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
            className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-20 text-muted active:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Mobile first/last game strip */}
        {g.length > 0 && lastGameTime && (
          <div
            className="flex items-center justify-center gap-4 px-2 sm:hidden"
            style={{ height: 22, borderBottom: '1px solid #1a2d50', background: '#030c1a' }}
          >
            <span className="font-cond text-[9px] text-muted">
              FIRST <span className="text-white font-bold">{firstGameTime || '—'}</span>
            </span>
            <span className="font-cond text-[9px] text-muted">
              LAST <span className="text-white font-bold">{lastGameTime}</span>
            </span>
            <span className="font-cond text-[9px] text-muted">{g.length} GAMES</span>
          </div>
        )}

        {/* Pills row — scrollable on mobile */}
        <div className="flex items-stretch overflow-x-auto" style={{ height: 38 }}>
          {PILLS.map((p) => {
            const count = counts[p.key]
            const active = count > 0
            return (
              <div
                key={p.key}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 flex-shrink-0"
                style={{
                  borderRight: '1px solid #1a2d50',
                  background: active ? p.bg : 'transparent',
                }}
              >
                <span
                  className="font-cond text-[18px] sm:text-[22px] font-black leading-none tabular-nums"
                  style={{
                    color: active ? p.activeColor : '#1e2d40',
                    textShadow: active && p.key === 'Live' ? `0 0 12px ${p.activeColor}60` : 'none',
                  }}
                >
                  {count}
                </span>
                <span
                  className="font-cond text-[8px] sm:text-[9px] font-black tracking-[.12em]"
                  style={{ color: active ? p.activeColor : '#1e2d40' }}
                >
                  {p.label}
                </span>
                {p.key === 'Live' && active && (
                  <div className="relative w-1.5 h-1.5 ml-0.5">
                    <div className="absolute inset-0 rounded-full bg-green-500/30 live-dot scale-150" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 relative z-10" />
                  </div>
                )}
              </div>
            )
          })}

          {/* Last game — hidden on small phones */}
          {lastGameTime && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 flex-shrink-0"
              style={{ borderRight: '1px solid #1a2d50' }}
            >
              <span className="font-cond text-[9px] font-black tracking-[.1em] text-muted">
                LAST GAME
              </span>
              <span className="font-cond text-[13px] font-black text-white">{lastGameTime}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Date nav — desktop only (mobile version is above) */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 ml-auto flex-shrink-0"
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
                  <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                    {multiWeek ? `WK ${wk} · ` : ''}
                    {currentDate.label}
                  </span>
                  <span className="font-cond text-[13px] font-black text-white tracking-wide">
                    {format(parseISO(currentDate.date), 'EEE, MMM d')}
                  </span>
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

            <span className="font-cond text-[9px] font-black tracking-[.1em] text-[#1e2d40] ml-0.5">
              {state.currentDateIdx === -1
                ? `${state.eventDates.length} DAYS`
                : `${state.currentDateIdx + 1}/${state.eventDates.length}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
