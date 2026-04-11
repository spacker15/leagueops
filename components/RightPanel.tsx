'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import type { TabName } from '@/components/AppShell'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createClient } from '@/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  onNavigate: (tab: TabName) => void
}

export function RightPanel({ onNavigate }: Props) {
  const { state, currentDate } = useApp()

  const lightningActive = state.lightningActive
  const m = Math.floor(state.lightningSecondsLeft / 60)
  const s = state.lightningSecondsLeft % 60

  // Compute first/last game times
  const gameTimes = state.games
    .map((g) => {
      const match = g.scheduled_time?.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!match) return null
      let h = parseInt(match[1])
      const min = parseInt(match[2])
      if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12
      if (match[3].toUpperCase() === 'AM' && h === 12) h = 0
      return { time: g.scheduled_time, minutes: h * 60 + min, status: g.status }
    })
    .filter(Boolean) as { time: string; minutes: number; status: string }[]

  gameTimes.sort((a, b) => a.minutes - b.minutes)
  const firstGame = gameTimes[0] ?? null
  const lastGame = gameTimes[gameTimes.length - 1] ?? null
  const gamesRemaining = state.games.filter((g) => g.status === 'Scheduled' || g.status === 'Starting').length
  const gamesLive = state.games.filter((g) => g.status === 'Live' || g.status === 'Halftime').length
  const gamesFinal = state.games.filter((g) => g.status === 'Final').length

  return (
    <aside className="w-72 bg-surface-panel border-l border-border overflow-y-auto flex-shrink-0" style={{ maxHeight: 'calc(100vh - 48px)' }}>
      {/* Today's Schedule quick view */}
      {state.games.length > 0 && (
        <Section title={currentDate?.label ? `${currentDate.label.toUpperCase()} SCHEDULE` : "TODAY'S SCHEDULE"}>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted font-cond">First Game</span>
              <span className="text-white font-mono font-bold">{firstGame?.time ?? '—'}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted font-cond">Last Game</span>
              <span className="text-white font-mono font-bold">{lastGame?.time ?? '—'}</span>
            </div>
            <div className="border-t border-border/50 pt-1.5 mt-1.5 flex justify-between text-[11px]">
              <span className="text-muted font-cond">Total</span>
              <span className="text-white font-mono">{state.games.length}</span>
            </div>
            {gamesLive > 0 && (
              <div className="flex justify-between text-[11px]">
                <span className="text-green-400 font-cond font-bold">Live</span>
                <span className="text-green-400 font-mono font-bold">{gamesLive}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-muted font-cond">Remaining</span>
              <span className={cn('font-mono', gamesRemaining > 0 ? 'text-blue-300' : 'text-muted')}>{gamesRemaining}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted font-cond">Final</span>
              <span className="text-muted font-mono">{gamesFinal}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Weather / Lightning — always at top */}
      <WeatherRPPanel
        lightningActive={lightningActive}
        timerM={m}
        timerS={s}
        alertCount={state.weatherAlerts.filter((a) => a.is_active).length}
        onNavigate={onNavigate}
      />

      {/* Trainer on Duty */}
      <TrainerOnDutyPanel fields={state.fields} />

      {/* Incident Monitor */}
      {(() => {
        const today = new Date().toISOString().split('T')[0]
        const todayIncidents = state.incidents.filter((inc) =>
          inc.occurred_at?.startsWith(today) || inc.created_at?.startsWith(today)
        )
        const todayMedical = state.medicalIncidents.filter((m) =>
          m.status !== 'Resolved' || m.dispatched_at?.startsWith(today)
        ).filter((m) =>
          m.dispatched_at?.startsWith(today)
        )
        const totalToday = todayIncidents.length + todayMedical.length

        return (
          <Section
            title={`INCIDENT MONITOR${totalToday > 0 ? ` (${totalToday})` : ''}`}
            action={() => onNavigate('incidents')}
            actionLabel="LOG"
          >
            {totalToday === 0 ? (
              <p className="text-[11px] text-muted">No incidents today</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {/* Medical dispatches today */}
                {todayMedical
                  .filter((m) => m.status !== 'Resolved')
                  .map((m) => (
                    <div
                      key={`med-${m.id}`}
                      className="rounded p-1.5 border-l-2 text-[10px] bg-white/5 border-blue-500"
                    >
                      <div className="flex justify-between">
                        <span className="font-cond text-[11px] font-black tracking-wide text-blue-400">
                          MEDICAL — {m.injury_type.toUpperCase()}
                        </span>
                        <span className="font-mono text-[9px] text-muted">
                          {new Date(m.dispatched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-muted mt-0.5">
                        {m.field?.name ?? '—'} · {m.player_name || '—'}
                      </div>
                      <div className="text-muted">
                        Trainer: {m.trainer_name} · <span className="text-blue-300">{m.status}</span>
                      </div>
                    </div>
                  ))}
                {/* Resolved medical today */}
                {todayMedical
                  .filter((m) => m.status === 'Resolved')
                  .map((m) => (
                    <div
                      key={`med-r-${m.id}`}
                      className="rounded p-1.5 border-l-2 text-[10px] bg-white/5 border-green-800/50 opacity-60"
                    >
                      <div className="flex justify-between">
                        <span className="font-cond text-[11px] font-black tracking-wide text-green-400">
                          RESOLVED — {m.injury_type.toUpperCase()}
                        </span>
                        <span className="font-mono text-[9px] text-muted">
                          {new Date(m.dispatched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-muted mt-0.5">
                        {m.player_name || '—'} · {m.trainer_name}
                      </div>
                    </div>
                  ))}
                {/* General incidents today */}
                {todayIncidents.map((inc) => (
                  <div
                    key={`inc-${inc.id}`}
                    className={cn(
                      'rounded p-1.5 border-l-2 text-[10px]',
                      ['Player Injury', 'Ejection'].includes(inc.type)
                        ? 'bg-white/5 border-red-500'
                        : 'bg-white/5 border-yellow-500'
                    )}
                  >
                    <div className="flex justify-between">
                      <span
                        className={cn(
                          'font-cond text-[11px] font-black tracking-wide',
                          ['Player Injury', 'Ejection'].includes(inc.type) ? 'text-red-400' : 'text-yellow-400'
                        )}
                      >
                        {inc.type.toUpperCase()}
                      </span>
                      <span className="font-mono text-[9px] text-muted">
                        {new Date(inc.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-muted mt-0.5">
                      {inc.field?.name ?? '—'} · {inc.team?.name ?? '—'}
                    </div>
                    {inc.person_involved && (
                      <div className="text-white font-bold mt-0.5">{inc.person_involved}</div>
                    )}
                    {inc.description && (
                      <div className="text-gray-400 mt-0.5">{inc.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )
      })()}
    </aside>
  )
}

// ─── Section wrapper ─────────────────────────────────────────
function Section({
  title,
  children,
  action,
  actionLabel,
}: {
  title: string
  children: React.ReactNode
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="border-b border-border p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-cond text-[10px] font-black tracking-widest text-muted uppercase">
          {title}
        </span>
        {action && (
          <button
            onClick={action}
            className="font-cond text-[10px] font-bold tracking-wider text-blue-300 bg-navy/60 px-2 py-0.5 rounded hover:bg-navy transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Trainer On Duty ─────────────────────────────────────────
function TrainerOnDutyPanel({ fields }: { fields: { id: number; name: string }[] }) {
  const { state, dispatchTrainer, updateMedicalStatus } = useApp()
  const [dispatchingId, setDispatchingId] = useState<number | null>(null)
  const [dispatching, setDispatching] = useState(false)

  const onDuty = state.trainers.filter((t) => t.checked_in)
  const offDuty = state.trainers.filter((t) => !t.checked_in)

  async function handleDispatch(trainerId: number, fieldId: number) {
    const trainer = state.trainers.find((t) => t.id === trainerId)
    const field = fields.find((f) => f.id === fieldId)
    if (!trainer || !field || !state.event?.id) return

    setDispatching(true)
    try {
      await dispatchTrainer({
        event_id: state.event.id,
        field_id: fieldId,
        game_id: null,
        player_name: '',
        team_name: null,
        injury_type: 'General / Unknown',
        trainer_name: trainer.name,
        status: 'Dispatched',
        dispatched_at: new Date().toISOString(),
        notes: `Quick dispatch to ${field.name}`,
      })
      toast.success(`${trainer.name} dispatched to ${field.name}`)
    } catch {
      toast.error('Failed to dispatch trainer')
    }
    setDispatching(false)
    setDispatchingId(null)
  }

  return (
    <Section title="TRAINER ON DUTY">
      {state.trainers.length === 0 ? (
        <p className="text-[11px] text-muted">No trainers registered</p>
      ) : onDuty.length === 0 ? (
        <p className="text-[11px] text-red-400 font-cond font-bold">NO TRAINER ON DUTY</p>
      ) : (
        <div className="space-y-1.5">
          {onDuty.map((t) => (
            <div key={t.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-cond text-[11px] font-bold text-white">{t.name}</span>
                </div>
                <button
                  onClick={() => setDispatchingId(dispatchingId === t.id ? null : t.id)}
                  disabled={dispatching}
                  className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-red/20 text-red-300 border border-red/40 hover:bg-red/30 transition-colors"
                >
                  DISPATCH
                </button>
              </div>
              {dispatchingId === t.id && (
                <div className="mt-1.5 ml-3.5 space-y-1">
                  {fields.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleDispatch(t.id, f.id)}
                      disabled={dispatching}
                      className="block w-full text-left font-cond text-[10px] px-2 py-1 rounded bg-surface border border-border text-muted hover:text-white hover:border-blue-400 transition-colors disabled:opacity-50"
                    >
                      → {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Active dispatches */}
      {state.medicalIncidents.filter((m) => m.status !== 'Resolved' && m.status !== 'Released').length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-red-800/30">
          <div className="font-cond text-[9px] text-red-400 tracking-wider font-bold mb-1">ACTIVE DISPATCHES</div>
          {state.medicalIncidents
            .filter((m) => m.status !== 'Resolved' && m.status !== 'Released')
            .map((m) => (
              <div key={m.id} className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <div className="font-cond text-[10px] text-red-200 truncate">
                    {m.trainer_name}{m.player_name ? ` · ${m.player_name}` : ''}
                  </div>
                  <div className="font-cond text-[9px] text-red-400/70">{m.status}</div>
                </div>
                <button
                  onClick={async () => {
                    await updateMedicalStatus(m.id, 'Resolved')
                    toast.success('Dispatch resolved')
                  }}
                  className="font-cond text-[8px] font-bold px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors flex-shrink-0 ml-1"
                >
                  RESOLVE
                </button>
              </div>
            ))}
        </div>
      )}

      {offDuty.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-border/50">
          <div className="font-cond text-[9px] text-muted tracking-wider mb-1">OFF DUTY</div>
          {offDuty.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-muted/40" />
              <span className="font-cond text-[10px] text-muted">{t.name}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── Right Panel Weather component ─────────────────────────────
function WeatherRPPanel({
  lightningActive,
  timerM,
  timerS,
  alertCount,
  onNavigate,
}: {
  lightningActive: boolean
  timerM: number
  timerS: number
  alertCount: number
  onNavigate: (tab: any) => void
}) {
  const { state, liftLightning } = useApp()

  // Use the latest weather reading from auto-poll (store)
  const readings = Object.values(state.weatherReadings)
  const latestReading = readings.length > 0 ? readings[0] : null

  const heatIdx = latestReading?.heat_index_f
  const heatColor = !heatIdx
    ? 'text-white'
    : heatIdx >= 113
      ? 'text-red-400'
      : heatIdx >= 103
        ? 'text-orange-400'
        : heatIdx >= 95
          ? 'text-yellow-400'
          : 'text-green-400'

  return (
    <Section title="WEATHER / LIGHTNING" action={() => onNavigate('weather')} actionLabel="VIEW">
      {lightningActive ? (
        <div>
          <div className="font-cond text-[11px] font-black text-red-400 text-center tracking-wider mb-1 border border-red-500/40 rounded p-1 lightning-flash">
            ⚡ LIGHTNING DELAY ACTIVE
          </div>
          <div className="font-cond text-[9px] font-bold text-muted text-center tracking-wide mb-1">
            {format(new Date(), 'EEE, MMM d, yyyy')}
          </div>
          <div className="font-mono text-xl text-red-400 text-center">
            {timerM}:{timerS.toString().padStart(2, '0')}
          </div>
          <button
            onClick={() => liftLightning()}
            className="w-full mt-2 font-cond text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors text-center"
          >
            LIFT DELAY
          </button>
        </div>
      ) : (
        <div>
          {alertCount > 0 ? (
            <div className="font-cond text-[10px] font-black text-yellow-400 text-center tracking-wider border border-yellow-500/40 bg-yellow-900/10 rounded p-1 mb-2">
              ⚠ {alertCount} ACTIVE ALERT{alertCount > 1 ? 'S' : ''}
            </div>
          ) : (
            <div className="font-cond text-[10px] font-black text-green-400 text-center tracking-wider border border-green-500/30 rounded p-1 mb-2">
              ALL CLEAR
            </div>
          )}
          <div className="font-cond text-[9px] font-bold text-muted text-center tracking-wide mb-1.5">
            {format(new Date(), 'EEE, MMM d, yyyy')}
          </div>
          {latestReading ? (
            <div className="text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted">Temp</span>
                <span className="text-white font-mono">{latestReading.temperature_f}°F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Heat Index</span>
                <span className={cn('font-mono font-bold', heatColor)}>
                  {latestReading.heat_index_f}°F
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Humidity</span>
                <span className="text-white font-mono">{latestReading.humidity_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Wind</span>
                <span className="text-white font-mono">{latestReading.wind_mph} mph</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Conditions</span>
                <span className="text-white capitalize">{latestReading.conditions}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted font-cond text-center">
              Loading weather data...
            </div>
          )}
        </div>
      )}
      {alertCount > 0 && (
        <div className="mt-2 flex items-center justify-end">
          <button
            onClick={async () => {
              const sb = createClient()
              const active = state.weatherAlerts.filter((a) => a.is_active)
              for (const a of active) {
                await sb.from('weather_alerts').update({ is_active: false }).eq('id', a.id)
              }
              // Force refresh alerts from DB so UI updates immediately
              const eventId = state.event?.id
              if (eventId) {
                const { data } = await sb
                  .from('weather_alerts')
                  .select('*')
                  .eq('event_id', eventId)
                  .eq('is_active', true)
                  .order('created_at', { ascending: false })
                // The realtime subscription will pick up the changes
              }
            }}
            className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors"
          >
            RESOLVE
          </button>
        </div>
      )}
    </Section>
  )
}
