'use client'

import { useApp } from '@/lib/store'
import { CoverageBar, Pill } from '@/components/ui'
import { logTypeColor, cn } from '@/lib/utils'
import type { TabName } from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { createClient } from '@/supabase/client'
import type { OperationalConflict } from '@/types'
import { AlertTriangle, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface Props {
  onNavigate: (tab: TabName) => void
}

export function RightPanel({ onNavigate }: Props) {
  const { state } = useApp()

  const refs = state.referees
  const vols = state.volunteers
  const refsAssigned = refs.filter((r) => r.checked_in).length

  const volByRole = (role: string) => vols.filter((v) => v.role === role)
  const volChecked = (role: string) => volByRole(role).filter((v) => v.checked_in).length

  const activeTrainers = state.medicalIncidents.filter((m) => m.status !== 'Resolved').slice(0, 4)
  const lightningActive = state.lightningActive
  const m = Math.floor(state.lightningSecondsLeft / 60)
  const s = state.lightningSecondsLeft % 60

  return (
    <aside className="hidden lg:block w-72 bg-surface-panel border-l border-border overflow-y-auto flex-shrink-0">
      {/* Weather / Lightning — always at top */}
      <WeatherRPPanel
        lightningActive={lightningActive}
        timerM={m}
        timerS={s}
        alertCount={state.weatherAlerts.filter((a) => a.is_active).length}
        onNavigate={onNavigate}
      />

      {/* Ref Coverage */}
      <Section title="REF COVERAGE" action={() => onNavigate('refs')} actionLabel="VIEW">
        <CoverageBar label="CHECKED IN" value={refsAssigned} total={refs.length} />
        <CoverageBar
          label="ASSIGNED"
          value={state.games.filter((g) => g.status !== 'Final' && g.status !== 'Scheduled').length}
          total={state.games.filter((g) => g.status !== 'Final').length}
        />
      </Section>

      {/* Volunteer Coverage */}
      <Section title="VOLUNTEER COVERAGE">
        <CoverageBar
          label="SCORE TABLE"
          value={volChecked('Score Table')}
          total={volByRole('Score Table').length}
        />
        <CoverageBar label="CLOCK" value={volChecked('Clock')} total={volByRole('Clock').length} />
        <CoverageBar
          label="FIELD MARSHAL"
          value={volChecked('Field Marshal')}
          total={volByRole('Field Marshal').length}
        />
        <CoverageBar
          label="OPERATIONS"
          value={volChecked('Operations')}
          total={Math.max(1, volByRole('Operations').length)}
        />
      </Section>

      {/* Incident Monitor */}
      <Section title="INCIDENT MONITOR" action={() => onNavigate('incidents')} actionLabel="LOG">
        {state.incidents.slice(0, 4).length === 0 ? (
          <p className="text-[11px] text-muted">No active incidents</p>
        ) : (
          state.incidents.slice(0, 4).map((inc) => (
            <div
              key={inc.id}
              className={cn(
                'rounded p-1.5 mb-1.5 border-l-2 text-[10px]',
                ['Player Injury', 'Ejection'].includes(inc.type)
                  ? 'bg-white/5 border-red-500'
                  : 'bg-white/5 border-yellow-500'
              )}
            >
              <div
                className={cn(
                  'font-cond text-[11px] font-black tracking-wide',
                  ['Player Injury', 'Ejection'].includes(inc.type)
                    ? 'text-red-400'
                    : 'text-yellow-400'
                )}
              >
                {inc.type.toUpperCase()}
              </div>
              <div className="text-muted mt-0.5">
                {inc.field?.name ?? '—'} · {inc.team?.name ?? '—'}
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Operational Conflicts (Phase 2) */}
      <ConflictPanel onNavigate={onNavigate} />

      {/* Trainer / Medical */}
      <Section
        title="TRAINER / MEDICAL"
        action={() => onNavigate('incidents')}
        actionLabel="DISPATCH"
      >
        {activeTrainers.length === 0 ? (
          <p className="text-[11px] text-muted">No active dispatches</p>
        ) : (
          activeTrainers.map((t) => (
            <div key={t.id} className="bg-white/5 border-l-2 border-blue-400 rounded p-1.5 mb-1.5">
              <div className="font-cond font-black text-[11px] text-blue-300">{t.player_name}</div>
              <div className="text-[10px] text-muted">
                {t.injury_type} · {t.trainer_name}
              </div>
              <div className="text-[10px] mt-0.5">
                <Pill
                  variant={
                    t.status === 'Resolved'
                      ? 'green'
                      : t.status === 'Dispatched'
                        ? 'yellow'
                        : 'blue'
                  }
                >
                  {t.status}
                </Pill>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Ops Log */}
      <Section title="OPERATIONS LOG">
        <div className="space-y-1.5">
          {state.opsLog.slice(0, 15).map((entry) => (
            <div key={entry.id} className="flex gap-2 text-[10px]">
              <span className="font-mono text-muted shrink-0 text-[9px]">
                {new Date(entry.occurred_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className={logTypeColor(entry.log_type)}>{entry.message}</span>
            </div>
          ))}
        </div>
      </Section>
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

// ─── Conflict Panel ──────────────────────────────────────────
function ConflictPanel({ onNavigate }: { onNavigate: (tab: TabName) => void }) {
  const { state } = useApp()
  const [conflicts, setConflicts] = useState<OperationalConflict[]>([])
  const eventId = state.event?.id

  useEffect(() => {
    if (!eventId) return
    const sb = createClient()

    function fetchConflicts() {
      sb.from('operational_conflicts')
        .select('*')
        .eq('event_id', eventId)
        .eq('resolved', false)
        .order('severity', { ascending: false })
        .limit(5)
        .then(({ data }) => setConflicts((data as OperationalConflict[]) ?? []))
    }

    fetchConflicts()

    const sub = sb
      .channel(`rp-conflicts-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operational_conflicts' },
        fetchConflicts
      )
      .subscribe()

    return () => {
      sb.removeChannel(sub)
    }
  }, [eventId])

  const critical = conflicts.filter((c) => c.severity === 'critical').length
  const warning = conflicts.filter((c) => c.severity === 'warning').length

  return (
    <Section
      title={`REF CONFLICTS${conflicts.length > 0 ? ` (${conflicts.length})` : ''}`}
      action={() => onNavigate('refs')}
      actionLabel="VIEW"
    >
      {conflicts.length === 0 ? (
        <p className="text-[11px] text-green-400 font-cond font-bold">ALL CLEAR</p>
      ) : (
        <div>
          {critical > 0 && (
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle size={11} className="text-red-400" />
              <span className="font-cond text-[11px] font-bold text-red-400">
                {critical} CRITICAL
              </span>
            </div>
          )}
          {warning > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={11} className="text-yellow-400" />
              <span className="font-cond text-[11px] font-bold text-yellow-400">
                {warning} WARNINGS
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            {conflicts.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className={cn(
                  'text-[10px] rounded p-1.5 border-l-2',
                  c.severity === 'critical'
                    ? 'bg-white/5 border-red-500 text-red-300'
                    : 'bg-white/5 border-yellow-500 text-yellow-300'
                )}
              >
                {c.description.length > 70 ? c.description.slice(0, 70) + '…' : c.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

// ─── Right Panel Weather component — one card per complex ──────
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
  const { isAdmin } = useAuth()
  const [complexes, setComplexes] = useState<{ id: number; name: string }[]>([])

  // Load complexes for this event so we can label each weather reading
  useEffect(() => {
    const eventId = state.event?.id
    if (!eventId) return
    const sb = createClient()
    sb.from('complexes')
      .select('id, name')
      .eq('event_id', eventId)
      .order('id')
      .then(({ data }) => setComplexes(data ?? []))
  }, [state.event?.id])

  // weatherReadings keyed by complex_id
  const readings = state.weatherReadings as Record<
    number,
    import('@/lib/engines/weather').WeatherReading
  >

  // Lightning timer display
  const timerStr = `${timerM}:${timerS.toString().padStart(2, '0')}`

  const activeAlerts = state.weatherAlerts.filter((a) => a.is_active)

  function heatColor(hi: number | undefined) {
    if (!hi) return 'text-white'
    if (hi >= 113) return 'text-red-400'
    if (hi >= 103) return 'text-orange-400'
    if (hi >= 95) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <Section title="WEATHER / LIGHTNING" action={() => onNavigate('weather')} actionLabel="VIEW">
      {/* Global lightning banner */}
      {lightningActive && (
        <div className="mb-3">
          <div className="font-cond text-[11px] font-black text-red-400 text-center tracking-wider border border-red-500/40 rounded p-1 mb-1 lightning-flash">
            ⚡ LIGHTNING DELAY — {timerStr}
          </div>
          {isAdmin && (
            <button
              onClick={() => liftLightning()}
              className="w-full font-cond text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors text-center"
            >
              LIFT DELAY
            </button>
          )}
        </div>
      )}

      {/* Per-complex weather rows */}
      {complexes.length === 0 && Object.keys(readings).length === 0 ? (
        <div className="text-[10px] text-muted font-cond text-center py-2">
          No complexes — add one in Settings
        </div>
      ) : (
        <div className="space-y-2">
          {/* Show complexes that have a reading */}
          {complexes.map((cx) => {
            const r = readings[cx.id]
            return (
              <div key={cx.id} className="rounded bg-white/4 border border-border/60 p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-cond text-[10px] font-black tracking-wide text-muted uppercase truncate max-w-[120px]">
                    {cx.name}
                  </span>
                  {r ? (
                    <span className="font-cond text-[10px] font-bold text-green-400">LIVE</span>
                  ) : (
                    <span className="font-cond text-[9px] text-muted">NO DATA</span>
                  )}
                </div>
                {r ? (
                  <div className="text-[10px] space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted">Temp</span>
                      <span className="text-white font-mono">{r.temperature_f}°F</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Heat Idx</span>
                      <span className={cn('font-mono font-bold', heatColor(r.heat_index_f))}>
                        {r.heat_index_f}°F
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Wind</span>
                      <span className="text-white font-mono">
                        {r.wind_mph} mph{r.wind_gust_mph > r.wind_mph ? ` g${r.wind_gust_mph}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Conditions</span>
                      <span className="text-white capitalize truncate max-w-[90px] text-right">
                        {r.conditions}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] text-muted">Scan pending…</div>
                )}
              </div>
            )
          })}

          {/* Complexes that have readings but aren't in complexes list yet */}
          {Object.entries(readings)
            .filter(([id]) => !complexes.find((c) => c.id === Number(id)))
            .map(([id, r]) => (
              <div key={id} className="rounded bg-white/4 border border-border/60 p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-cond text-[10px] font-black tracking-wide text-muted uppercase">
                    {r.complex_name}
                  </span>
                  <span className="font-cond text-[10px] font-bold text-green-400">LIVE</span>
                </div>
                <div className="text-[10px] flex gap-3">
                  <span className="text-white font-mono">{r.temperature_f}°F</span>
                  <span className="text-muted">{r.conditions}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Active alert count */}
      {alertCount > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-yellow-400 font-cond font-bold tracking-wide">
            ⚠ {alertCount} ACTIVE ALERT{alertCount > 1 ? 'S' : ''}
          </span>
          {isAdmin && (
            <button
              onClick={async () => {
                const sb = createClient()
                for (const a of activeAlerts) {
                  await sb.from('weather_alerts').update({ is_active: false }).eq('id', a.id)
                }
              }}
              className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors"
            >
              RESOLVE ALL
            </button>
          )}
        </div>
      )}
    </Section>
  )
}
