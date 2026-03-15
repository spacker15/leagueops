'use client'

import { useApp } from '@/lib/store'
import { CoverageBar, Pill } from '@/components/ui'
import { logTypeColor } from '@/lib/utils'
import type { TabName } from '@/components/AppShell'
import { cn } from '@/lib/utils'

interface Props { onNavigate: (tab: TabName) => void }

export function RightPanel({ onNavigate }: Props) {
  const { state } = useApp()

  const refs = state.referees
  const vols = state.volunteers
  const refsAssigned = refs.filter(r => r.checked_in).length

  const volByRole = (role: string) => vols.filter(v => v.role === role)
  const volChecked = (role: string) => volByRole(role).filter(v => v.checked_in).length

  const recentIncidents = state.incidents.slice(0, 4)
  const activeTrainers  = state.medicalIncidents.filter(m => m.status !== 'Resolved').slice(0, 4)
  const lightningActive = state.lightningActive
  const m = Math.floor(state.lightningSecondsLeft / 60)
  const s = state.lightningSecondsLeft % 60

  return (
    <aside className="w-72 bg-surface-panel border-l border-border overflow-y-auto flex-shrink-0">

      {/* Ref Coverage */}
      <Section title="REF COVERAGE" action={() => onNavigate('refs')} actionLabel="VIEW">
        <CoverageBar label="CHECKED IN" value={refsAssigned} total={refs.length} />
        <CoverageBar label="ASSIGNED"   value={state.games.filter(g => g.status !== 'Final' && g.status !== 'Scheduled').length} total={state.games.filter(g => g.status !== 'Final').length} />
      </Section>

      {/* Volunteer Coverage */}
      <Section title="VOLUNTEER COVERAGE">
        <CoverageBar label="SCORE TABLE"   value={volChecked('Score Table')}  total={volByRole('Score Table').length} />
        <CoverageBar label="CLOCK"         value={volChecked('Clock')}        total={volByRole('Clock').length} />
        <CoverageBar label="FIELD MARSHAL" value={volChecked('Field Marshal')} total={volByRole('Field Marshal').length} />
        <CoverageBar label="OPERATIONS"    value={volChecked('Operations')}   total={Math.max(1, volByRole('Operations').length)} />
      </Section>

      {/* Incident Monitor */}
      <Section title="INCIDENT MONITOR" action={() => onNavigate('incidents')} actionLabel="LOG">
        {recentIncidents.length === 0
          ? <p className="text-[11px] text-muted">No active incidents</p>
          : recentIncidents.map(inc => (
            <div key={inc.id}
              className={cn(
                'rounded p-1.5 mb-1.5 border-l-2 text-[10px]',
                ['Player Injury','Ejection'].includes(inc.type)
                  ? 'bg-white/5 border-red-500'
                  : 'bg-white/5 border-yellow-500'
              )}>
              <div className={cn(
                'font-cond font-black text-[11px] tracking-wide',
                ['Player Injury','Ejection'].includes(inc.type) ? 'text-red-400' : 'text-yellow-400'
              )}>{inc.type.toUpperCase()}</div>
              <div className="text-muted mt-0.5">{inc.field?.name ?? '—'} · {inc.team?.name ?? '—'}</div>
            </div>
          ))
        }
      </Section>

      {/* Weather */}
      <Section title="WEATHER / LIGHTNING" action={() => onNavigate('weather')} actionLabel="VIEW">
        {lightningActive ? (
          <div>
            <div className="font-cond text-[12px] font-black text-red-400 text-center tracking-wider mb-1 border border-red-500/40 rounded p-1 lightning-flash">
              ⚡ LIGHTNING DELAY ACTIVE
            </div>
            <div className="font-mono text-xl text-red-400 text-center">{m}:{s.toString().padStart(2,'0')}</div>
          </div>
        ) : (
          <div>
            <div className="font-cond text-[11px] font-black text-green-400 text-center tracking-wider border border-green-500/30 rounded p-1">
              ALL CLEAR
            </div>
            <div className="text-[10px] text-muted mt-2 space-y-0.5">
              <div className="flex justify-between"><span>Temperature</span><span className="text-white">84°F</span></div>
              <div className="flex justify-between"><span>Humidity</span><span className="text-white">67%</span></div>
              <div className="flex justify-between"><span>Wind</span><span className="text-white">12 mph</span></div>
            </div>
          </div>
        )}
        {state.weatherAlerts.filter(a => a.is_active).length > 0 && (
          <div className="mt-2 text-[10px] text-yellow-400 font-cond font-bold tracking-wide">
            {state.weatherAlerts.filter(a => a.is_active).length} ACTIVE ALERT(S)
          </div>
        )}
      </Section>

      {/* Trainer / Medical */}
      <Section title="TRAINER / MEDICAL" action={() => onNavigate('incidents')} actionLabel="DISPATCH">
        {activeTrainers.length === 0
          ? <p className="text-[11px] text-muted">No active dispatches</p>
          : activeTrainers.map(t => (
            <div key={t.id} className="bg-white/5 border-l-2 border-blue-400 rounded p-1.5 mb-1.5">
              <div className="font-cond font-black text-[11px] text-blue-300">{t.player_name}</div>
              <div className="text-[10px] text-muted">{t.injury_type} · {t.trainer_name}</div>
              <div className="text-[10px] mt-0.5">
                <Pill variant={t.status === 'Resolved' ? 'green' : t.status === 'Dispatched' ? 'yellow' : 'blue'}>
                  {t.status}
                </Pill>
              </div>
            </div>
          ))
        }
      </Section>

      {/* Ops Log */}
      <Section title="OPERATIONS LOG">
        <div className="space-y-1.5">
          {state.opsLog.slice(0, 15).map(entry => (
            <div key={entry.id} className="flex gap-2 text-[10px]">
              <span className="font-mono text-muted shrink-0 text-[9px]">
                {new Date(entry.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className={logTypeColor(entry.log_type)}>{entry.message}</span>
            </div>
          ))}
        </div>
      </Section>

    </aside>
  )
}

function Section({
  title, children, action, actionLabel
}: {
  title: string
  children: React.ReactNode
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="border-b border-border p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-cond text-[10px] font-black tracking-widest text-muted uppercase">{title}</span>
        {action && (
          <button onClick={action}
            className="font-cond text-[10px] font-bold tracking-wider text-blue-300 bg-navy/60 px-2 py-0.5 rounded hover:bg-navy transition-colors">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
