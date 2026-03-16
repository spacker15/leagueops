'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Avatar, Pill, SectionHeader, Modal, Btn, FormField } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { OperationalConflict, Referee, RefereeAvailability } from '@/types'
import { createClient } from '@/supabase/client'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Clock, Shield } from 'lucide-react'

type SubTab = 'referees' | 'volunteers' | 'conflicts' | 'availability'

export function RefsTab() {
  const { state, toggleRefCheckin, toggleVolCheckin, currentDate } = useApp()
  const [subTab, setSubTab]           = useState<SubTab>('referees')
  const [conflicts, setConflicts]     = useState<OperationalConflict[]>([])
  const [running, setRunning]         = useState(false)
  const [engineResult, setEngineResult] = useState<string | null>(null)
  const [selectedRef, setSelectedRef] = useState<Referee | null>(null)
  const [availability, setAvailability] = useState<RefereeAvailability[]>([])
  const [availModal, setAvailModal]   = useState(false)
  const [newDate, setNewDate]         = useState('')
  const [newFrom, setNewFrom]         = useState('07:30')
  const [newTo, setNewTo]             = useState('17:00')

  const loadConflicts = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('operational_conflicts')
      .select('*')
      .eq('event_id', 1)
      .eq('resolved', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
    setConflicts((data as OperationalConflict[]) ?? [])
  }, [])

  useEffect(() => { loadConflicts() }, [loadConflicts])

  async function runEngine() {
    if (!currentDate) { toast.error('No event date selected'); return }
    setRunning(true)
    setEngineResult(null)
    try {
      const res = await fetch('/api/referee-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date_id: currentDate.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEngineResult(data.summary)
      await loadConflicts()
      if (data.clean) {
        toast.success('✓ All referee assignments clear')
      } else {
        toast(`${data.conflicts.length} conflicts detected`, { icon: '⚠️' })
        setSubTab('conflicts')
      }
    } catch (err: any) {
      toast.error(`Engine error: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  async function resolveConflict(id: number) {
    const res = await fetch('/api/conflicts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resolved_by: 'operator' }),
    })
    if (res.ok) {
      setConflicts(prev => prev.filter(c => c.id !== id))
      toast.success('Conflict resolved')
    }
  }

  async function openAvailability(ref: Referee) {
    setSelectedRef(ref)
    const sb = createClient()
    const { data } = await sb
      .from('referee_availability')
      .select('*')
      .eq('referee_id', ref.id)
      .order('date')
    setAvailability((data as RefereeAvailability[]) ?? [])
    setAvailModal(true)
  }

  async function saveAvailability() {
    if (!selectedRef || !newDate) { toast.error('Fill in all fields'); return }
    const sb = createClient()
    const { error } = await sb
      .from('referee_availability')
      .upsert({ referee_id: selectedRef.id, date: newDate, available_from: newFrom, available_to: newTo },
               { onConflict: 'referee_id,date' })
    if (error) { toast.error(error.message); return }
    const { data } = await sb.from('referee_availability').select('*').eq('referee_id', selectedRef.id).order('date')
    setAvailability((data as RefereeAvailability[]) ?? [])
    toast.success('Availability saved')
    setNewDate('')
  }

  async function deleteAvailability(id: number) {
    const sb = createClient()
    await sb.from('referee_availability').delete().eq('id', id)
    setAvailability(prev => prev.filter(a => a.id !== id))
    toast.success('Removed')
  }

  async function handleRefToggle(id: number) {
    await toggleRefCheckin(id)
    const ref = state.referees.find(r => r.id === id)
    toast.success(`${ref?.name} ${ref?.checked_in ? 'checked out' : 'checked in'}`)
  }

  async function handleVolToggle(id: number) {
    await toggleVolCheckin(id)
    const vol = state.volunteers.find(v => v.id === id)
    toast.success(`${vol?.name} ${vol?.checked_in ? 'checked out' : 'checked in'}`)
  }

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length
  const warningCount  = conflicts.filter(c => c.severity === 'warning').length

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'referees',     label: 'Referees' },
    { id: 'volunteers',   label: 'Volunteers' },
    { id: 'conflicts',    label: conflicts.length > 0 ? `Conflicts (${conflicts.length})` : 'Conflicts' },
    { id: 'availability', label: 'Availability' },
  ]

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              subTab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white',
              t.id === 'conflicts' && conflicts.length > 0 && subTab !== t.id && 'text-yellow-400'
            )}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          {engineResult && <span className="font-cond text-[11px] text-muted">{engineResult}</span>}
          <Btn variant="primary" size="sm" onClick={runEngine} disabled={running}>
            <RefreshCw size={11} className={cn('inline mr-1', running && 'animate-spin')} />
            {running ? 'SCANNING...' : 'RUN ENGINE'}
          </Btn>
        </div>
      </div>

      {/* ── REFEREES ── */}
      {subTab === 'referees' && (
        <div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 mb-6">
            {state.referees.map(ref => {
              const refData = ref as any
              return (
                <div key={ref.id} className={cn(
                  'p-3 rounded-md border transition-all',
                  ref.checked_in
                    ? 'bg-green-900/10 border-green-800/40'
                    : 'bg-surface-card border-border'
                )}>
                  <div className="flex gap-2 items-start mb-2">
                    <Avatar name={ref.name} variant="red" />
                    <div className="min-w-0 flex-1">
                      <div className="font-cond font-black text-[13px] truncate">{ref.name}</div>
                      <div className="font-cond text-[10px] text-muted">{ref.grade_level}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {ref.checked_in ? <Pill variant="green">CHECKED IN</Pill> : <Pill variant="yellow">NOT IN</Pill>}
                    {refData.max_games_per_day && <Pill variant="gray">MAX {refData.max_games_per_day}</Pill>}
                  </div>

                  {refData.eligible_divisions?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(refData.eligible_divisions as string[]).map((d: string) => (
                        <span key={d} className="font-cond text-[9px] font-bold tracking-wider bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {refData.certifications?.length > 0 && (
                    <div className="font-cond text-[9px] text-muted mb-2">
                      {(refData.certifications as string[]).join(' · ')}
                    </div>
                  )}

                  <div className="flex gap-1 mt-2">
                    <button onClick={() => handleRefToggle(ref.id)}
                      className="flex-1 font-cond text-[10px] font-bold tracking-wider py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors">
                      {ref.checked_in ? 'CHECK OUT' : 'CHECK IN'}
                    </button>
                    <button onClick={() => openAvailability(ref)} title="Edit availability"
                      className="font-cond text-[10px] font-bold px-2 py-1 rounded bg-surface border border-border text-muted hover:text-white hover:border-blue-400 transition-colors">
                      <Clock size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <SectionHeader>GAME ASSIGNMENTS — {currentDate?.label ?? 'Today'}</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-navy">
                  {['#','FIELD','TIME','MATCHUP','DIV','STATUS'].map(h => (
                    <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.games
                  .sort((a,b) => a.scheduled_time.localeCompare(b.scheduled_time))
                  .map(game => (
                    <tr key={game.id} className="border-b border-border/40 hover:bg-white/5">
                      <td className="font-mono text-muted text-[10px] px-3 py-2">#{game.id}</td>
                      <td className="font-cond font-bold px-3 py-2">{game.field?.name ?? `F${game.field_id}`}</td>
                      <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap">{game.scheduled_time}</td>
                      <td className="font-cond font-bold text-white px-3 py-2 whitespace-nowrap">
                        {game.home_team?.name ?? '?'} vs {game.away_team?.name ?? '?'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                          {game.division}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('font-cond text-[10px] font-black tracking-wider px-2 py-0.5 rounded',
                          game.status === 'Live'    ? 'badge-live' :
                          game.status === 'Final'   ? 'badge-final' :
                          game.status === 'Delayed' ? 'badge-delayed' : 'badge-scheduled'
                        )}>{game.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VOLUNTEERS ── */}
      {subTab === 'volunteers' && (
        <div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 mb-6">
            {state.volunteers.map(vol => (
              <div key={vol.id} onClick={() => handleVolToggle(vol.id)}
                className={cn(
                  'flex gap-2 items-start p-3 rounded-md border cursor-pointer transition-all',
                  vol.checked_in
                    ? 'bg-green-900/10 border-green-800/40 hover:border-green-500/60'
                    : 'bg-surface-card border-border hover:border-blue-400'
                )}>
                <Avatar name={vol.name} variant="blue" />
                <div className="min-w-0">
                  <div className="font-cond font-black text-[13px] truncate">{vol.name}</div>
                  <div className="font-cond text-[10px] text-muted">{vol.role}</div>
                  <div className="mt-1.5">
                    {vol.checked_in ? <Pill variant="green">CHECKED IN</Pill> : <Pill variant="yellow">NOT IN</Pill>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SectionHeader>COVERAGE BY ROLE</SectionHeader>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            {['Score Table','Clock','Field Marshal','Operations','Gate'].map(role => {
              const total   = state.volunteers.filter(v => v.role === role).length
              const checked = state.volunteers.filter(v => v.role === role && v.checked_in).length
              if (total === 0) return null
              const pct = Math.round(checked / total * 100)
              return (
                <div key={role} className="bg-surface-card border border-border rounded-md p-3">
                  <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-1">{role}</div>
                  <div className={cn('font-mono text-xl font-bold',
                    pct === 100 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                    {checked}/{total}
                  </div>
                  <div className="h-1 bg-white/10 rounded mt-2 overflow-hidden">
                    <div className="h-full rounded transition-all" style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#22c55e' : pct >= 50 ? '#facc15' : '#f87171'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONFLICTS ── */}
      {subTab === 'conflicts' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
              {conflicts.length === 0
                ? <span className="text-green-400">ALL CLEAR — NO OPEN CONFLICTS</span>
                : <>{criticalCount > 0 && <span className="text-red-400 mr-2">{criticalCount} CRITICAL</span>}
                   {warningCount > 0  && <span className="text-yellow-400">{warningCount} WARNINGS</span>}</>
              }
            </div>
            <Btn size="sm" variant="ghost" onClick={loadConflicts}>REFRESH</Btn>
          </div>

          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle size={48} className="text-green-400" />
              <div className="font-cond font-black text-[18px] text-green-400 tracking-wide">ALL CLEAR</div>
              <div className="font-cond text-[12px] text-muted">Run the engine above to scan for conflicts</div>
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.map(c => (
                <ConflictCard key={c.id} conflict={c} onResolve={() => resolveConflict(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AVAILABILITY ── */}
      {subTab === 'availability' && (
        <div>
          <SectionHeader>REFEREE AVAILABILITY WINDOWS</SectionHeader>
          <div className="text-[11px] text-muted font-cond mb-4">
            Click EDIT on any referee to set or update their availability. The engine uses these windows to detect assignment conflicts.
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {state.referees.map(ref => (
              <RefAvailCard key={ref.id} ref_={ref} onEdit={() => openAvailability(ref)} />
            ))}
          </div>
        </div>
      )}

      {/* Availability Modal */}
      <Modal
        open={availModal}
        onClose={() => setAvailModal(false)}
        title={`AVAILABILITY — ${selectedRef?.name ?? ''}`}
        footer={<Btn variant="ghost" size="sm" onClick={() => setAvailModal(false)}>CLOSE</Btn>}
      >
        {selectedRef && (
          <div>
            <div className="bg-surface-elevated rounded-md p-3 mb-4">
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">ADD / UPDATE WINDOW</div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <FormField label="Date">
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400" />
                </FormField>
                <FormField label="Available From">
                  <input type="time" value={newFrom} onChange={e => setNewFrom(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400" />
                </FormField>
                <FormField label="Available To">
                  <input type="time" value={newTo} onChange={e => setNewTo(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400" />
                </FormField>
              </div>
              <Btn variant="primary" size="sm" onClick={saveAvailability}>SAVE WINDOW</Btn>
            </div>
            {availability.length === 0 ? (
              <div className="text-center py-6 text-muted font-cond text-sm">No availability windows set yet</div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-navy">
                    {['DATE','FROM','TO',''].map(h => (
                      <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-1.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availability.map(a => (
                    <tr key={a.id} className="border-b border-border/40">
                      <td className="font-mono text-blue-300 text-[11px] px-3 py-2">{a.date}</td>
                      <td className="font-mono px-3 py-2">{a.available_from}</td>
                      <td className="font-mono px-3 py-2">{a.available_to}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteAvailability(a.id)}
                          className="text-muted hover:text-red-400 transition-colors">
                          <XCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Conflict Card ───────────────────────────────────────────
function ConflictCard({ conflict, onResolve }: { conflict: OperationalConflict; onResolve: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const styles = {
    critical: { border: 'border-l-red-500',    bg: 'bg-red-900/10 border-red-900/40',     text: 'text-red-400',    icon: <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" /> },
    warning:  { border: 'border-l-yellow-500', bg: 'bg-yellow-900/10 border-yellow-900/30',text: 'text-yellow-400', icon: <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" /> },
    info:     { border: 'border-l-blue-400',   bg: 'bg-blue-900/10 border-blue-900/30',   text: 'text-blue-300',   icon: <Shield size={14} className="text-blue-300 shrink-0 mt-0.5" /> },
  }[conflict.severity]

  const LABELS: Record<string, string> = {
    ref_double_booked: 'DOUBLE BOOKED', ref_unavailable: 'UNAVAILABLE',
    max_games_exceeded: 'MAX GAMES',    missing_referee: 'MISSING REF',
    field_overlap: 'FIELD OVERLAP',     field_blocked: 'FIELD BLOCKED',
    weather_closure: 'WEATHER',         schedule_cascade: 'CASCADE DELAY',
  }

  return (
    <div className={cn('border border-l-4 rounded-md p-3', styles.border, styles.bg)}>
      <div className="flex items-start gap-2">
        {styles.icon}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className={cn('font-cond font-black text-[11px] tracking-widest', styles.text)}>
              {LABELS[conflict.conflict_type] ?? conflict.conflict_type.toUpperCase()}
            </span>
            <span className="font-mono text-[9px] text-muted">
              {new Date(conflict.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
            </span>
          </div>
          <div className="text-[12px] text-gray-200 mb-2 leading-snug">{conflict.description}</div>
          {conflict.impacted_game_ids.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {conflict.impacted_game_ids.map(id => (
                <span key={id} className="font-cond text-[10px] font-bold bg-white/10 text-muted px-1.5 py-0.5 rounded">
                  Game #{id}
                </span>
              ))}
            </div>
          )}
          {conflict.resolution_options?.length > 0 && (
            <div>
              <button onClick={() => setExpanded(e => !e)}
                className="font-cond text-[10px] font-bold text-blue-300 hover:text-blue-200 tracking-wide mb-1">
                {expanded ? '▲ HIDE' : '▼ RESOLUTIONS'}
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {conflict.resolution_options.map((opt, i) => (
                    <button key={i}
                      className="font-cond text-[10px] font-bold tracking-wide px-2 py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={onResolve}
          className="shrink-0 font-cond text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-800/50 transition-colors whitespace-nowrap ml-2">
          RESOLVE
        </button>
      </div>
    </div>
  )
}

// ─── Ref Availability Summary Card ──────────────────────────
function RefAvailCard({ ref_, onEdit }: { ref_: Referee; onEdit: () => void }) {
  const [windows, setWindows] = useState<RefereeAvailability[]>([])

  useEffect(() => {
    const sb = createClient()
    sb.from('referee_availability').select('*').eq('referee_id', ref_.id).order('date')
      .then(({ data }) => setWindows((data as RefereeAvailability[]) ?? []))
  }, [ref_.id])

  return (
    <div className="bg-surface-card border border-border rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="font-cond font-black text-[13px]">{ref_.name}</div>
          <div className="font-cond text-[10px] text-muted">{ref_.grade_level}</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={onEdit}>EDIT</Btn>
      </div>
      {windows.length === 0 ? (
        <div className="text-[10px] text-muted font-cond italic">No windows set — engine will skip checks</div>
      ) : (
        <div className="space-y-1">
          {windows.map(w => (
            <div key={w.id} className="flex justify-between text-[10px]">
              <span className="font-mono text-blue-300">{w.date}</span>
              <span className="text-muted">{w.available_from} – {w.available_to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
