'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { StatusBadge, Modal, Btn, FormField, SectionHeader } from '@/components/ui'
import { cn, nextStatusLabel, nextGameStatus } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { GameStatus, OperationalConflict } from '@/types'
import { createClient } from '@/supabase/client'
import {
  RefreshCw, AlertTriangle, XCircle, CheckCircle,
  Shield, Zap, ChevronRight, MoveHorizontal,
} from 'lucide-react'

type ViewMode = 'table' | 'board'

interface FieldConflict extends OperationalConflict {
  conflict_type: 'field_overlap' | 'field_blocked' | 'schedule_cascade' | 'missing_referee'
}

export function ScheduleTab() {
  const { state, updateGameStatus, addGame, currentDate } = useApp()
  const [viewMode, setViewMode]         = useState<ViewMode>('table')
  const [fieldFilter, setFieldFilter]   = useState('')
  const [divFilter, setDivFilter]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen]           = useState(false)
  const [conflicts, setConflicts]       = useState<FieldConflict[]>([])
  const [running, setRunning]           = useState(false)
  const [engineResult, setEngineResult] = useState<string | null>(null)
  const [applying, setApplying]         = useState<number | null>(null)
  const [showConflicts, setShowConflicts] = useState(false)

  // Add game form
  const [agField, setAgField] = useState('')
  const [agHome, setAgHome]   = useState('')
  const [agAway, setAgAway]   = useState('')
  const [agDiv, setAgDiv]     = useState('U14')
  const [agTime, setAgTime]   = useState('08:00')

  const loadConflicts = useCallback(async () => {
    const res = await fetch('/api/field-engine?event_id=1')
    if (res.ok) {
      const data = await res.json()
      setConflicts(data as FieldConflict[])
    }
  }, [])

  useEffect(() => { loadConflicts() }, [loadConflicts])

  // Run field engine
  async function runEngine() {
    if (!currentDate) { toast.error('No event date selected'); return }
    setRunning(true)
    setEngineResult(null)
    try {
      const res = await fetch('/api/field-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date_id: currentDate.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEngineResult(data.summary)
      await loadConflicts()
      if (data.clean) {
        toast.success(`✓ ${data.summary}`)
      } else {
        toast(`${data.conflicts.length} conflicts found`, { icon: '⚠️' })
        setShowConflicts(true)
      }
    } catch (err: any) {
      toast.error(`Engine error: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  // Apply a resolution
  async function applyResolution(conflictId: number, action: string, params: Record<string, unknown>) {
    setApplying(conflictId)
    try {
      const res = await fetch('/api/field-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          conflict_id: conflictId,
          resolution_action: action,
          resolution_params: params,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setConflicts(prev => prev.filter(c => c.id !== conflictId))
        // Refresh games
        window.location.reload()
      } else {
        toast.error(data.message)
      }
    } finally {
      setApplying(null)
    }
  }

  async function resolveConflict(id: number) {
    const res = await fetch('/api/conflicts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setConflicts(prev => prev.filter(c => c.id !== id))
      toast.success('Conflict dismissed')
    }
  }

  // Time-to-minutes helper for proper chronological sort
  function timeToMin(t: string): number {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) return 0
    let h = parseInt(m[1]), min = parseInt(m[2])
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + min
  }

  // Filter games — sort by FIELD first, then TIME
  const filtered = useMemo(() => {
    let g = [...state.games].sort((a, b) =>
      a.field_id - b.field_id || timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)
    )
    if (fieldFilter) g = g.filter(x => String(x.field_id) === fieldFilter)
    if (divFilter)   g = g.filter(x => x.division.startsWith(divFilter))
    if (statusFilter)g = g.filter(x => x.status === statusFilter)
    return g
  }, [state.games, fieldFilter, divFilter, statusFilter])

  async function cycleStatus(gameId: number, current: GameStatus) {
    const next = nextGameStatus(current)
    if (!next) return
    await updateGameStatus(gameId, next)
    toast.success(`Game #${gameId} → ${next}`)
  }

  async function handleAddGame() {
    if (!agField || !agHome || !agAway || agHome === agAway) {
      toast.error('Fill all fields. Home ≠ Away.')
      return
    }
    if (!currentDate) { toast.error('No event date selected'); return }
    const [h, m] = agTime.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
    const timeStr = `${dh}:${m.toString().padStart(2,'0')} ${ampm}`
    await addGame({
      event_id: 1, event_date_id: currentDate.id,
      field_id: Number(agField), home_team_id: Number(agHome),
      away_team_id: Number(agAway), division: agDiv,
      scheduled_time: timeStr, status: 'Scheduled',
      home_score: 0, away_score: 0, notes: null,
    })
    toast.success('Game added!')
    setAddOpen(false)
  }

  // Field columns for board view
  const fieldColumns = useMemo(() => {
    return state.fields.map(field => ({
      field,
      games: filtered.filter(g => g.field_id === field.id)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
    })).filter(fc => fc.games.length > 0)
  }, [state.fields, filtered])

  const divisions = [...new Set(state.teams.map(t => t.division))].sort()
  const criticalCount = conflicts.filter(c => c.severity === 'critical').length
  const warningCount  = conflicts.filter(c => c.severity === 'warning').length

  // Games with conflicts highlighted
  const conflictGameIds = new Set(conflicts.flatMap(c => c.impacted_game_ids ?? []))

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {/* View toggle */}
        <div className="flex rounded overflow-hidden border border-border">
          {(['table', 'board'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={cn(
                'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 transition-colors',
                viewMode === v ? 'bg-navy text-white' : 'bg-surface-card text-muted hover:text-white'
              )}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Filters */}
        <select className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}>
          <option value="">All Fields</option>
          {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <select className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={divFilter} onChange={e => setDivFilter(e.target.value)}>
          <option value="">All Divisions</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {(['Scheduled','Starting','Live','Halftime','Final','Delayed'] as GameStatus[]).map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>

        <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>+ ADD GAME</Btn>

        <div className="ml-auto flex items-center gap-2">
          {/* Conflict badge */}
          {conflicts.length > 0 && (
            <button onClick={() => setShowConflicts(s => !s)}
              className={cn(
                'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors',
                showConflicts
                  ? 'bg-red-900/40 border-red-700/50 text-red-300'
                  : 'bg-red-900/20 border-red-800/40 text-red-400 hover:bg-red-900/30'
              )}>
              <AlertTriangle size={11} className="inline mr-1" />
              {criticalCount > 0 && `${criticalCount} CRITICAL `}
              {warningCount > 0 && `${warningCount} WARN`}
              {conflicts.filter(c => c.severity === 'info').length > 0 && ` ${conflicts.filter(c => c.severity === 'info').length} INFO`}
            </button>
          )}
          {conflicts.length === 0 && engineResult && (
            <span className="font-cond text-[11px] text-green-400 flex items-center gap-1">
              <CheckCircle size={11} /> ALL CLEAR
            </span>
          )}
          {engineResult && !conflicts.length && (
            <span className="font-cond text-[10px] text-muted">{engineResult}</span>
          )}
          <Btn variant="primary" size="sm" onClick={runEngine} disabled={running}>
            <RefreshCw size={11} className={cn('inline mr-1', running && 'animate-spin')} />
            {running ? 'SCANNING...' : 'SCAN CONFLICTS'}
          </Btn>
        </div>
      </div>

      {/* Conflict panel */}
      {showConflicts && conflicts.length > 0 && (
        <div className="mb-4 bg-surface-card border border-border rounded-lg overflow-hidden">
          <div className="bg-navy/60 px-4 py-2 flex justify-between items-center border-b border-border">
            <span className="font-cond font-black text-[12px] tracking-wide">
              FIELD CONFLICTS — {criticalCount > 0 && <span className="text-red-400">{criticalCount} CRITICAL </span>}
              {warningCount > 0 && <span className="text-yellow-400">{warningCount} WARNINGS</span>}
            </span>
            <div className="flex gap-2">
              <button onClick={loadConflicts} className="text-muted hover:text-white">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => setShowConflicts(false)} className="text-muted hover:text-white">
                <XCircle size={14} />
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map(c => (
              <ConflictRow
                key={c.id}
                conflict={c}
                onResolve={() => resolveConflict(c.id)}
                onApply={(action, params) => applyResolution(c.id, action, params)}
                applying={applying === c.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-navy">
                {['TIME','FIELD','HOME','AWAY','DIV','STATUS','SCORE','ACTIONS'].map(h => (
                  <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(game => {
                const hasConflict = conflictGameIds.has(game.id)
                const conflict    = conflicts.find(c => c.impacted_game_ids?.includes(game.id))
                return (
                  <tr key={game.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-white/5 transition-colors',
                      game.status === 'Live'    ? 'bg-green-900/10' :
                      game.status === 'Delayed' ? 'bg-red-900/10' :
                      hasConflict               ? 'bg-yellow-900/8' : ''
                    )}>
                    <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap">
                      {game.scheduled_time}
                      {hasConflict && (
                        <span className={cn('ml-1.5 text-[9px] font-cond font-black',
                          conflict?.severity === 'critical' ? 'text-red-400' :
                          conflict?.severity === 'warning'  ? 'text-yellow-400' : 'text-blue-300'
                        )}>⚠</span>
                      )}
                    </td>
                    <td className="font-cond font-bold px-3 py-2">{game.field?.name ?? `F${game.field_id}`}</td>
                    <td className="font-cond font-bold text-white px-3 py-2">{game.home_team?.name ?? '?'}</td>
                    <td className="font-cond font-bold text-white px-3 py-2">{game.away_team?.name ?? '?'}</td>
                    <td className="px-3 py-2">
                      <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">{game.division}</span>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={game.status} /></td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {['Live','Halftime','Final'].includes(game.status)
                        ? <span className="text-green-400">{game.home_score}–{game.away_score}</span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 items-center">
                        {game.status !== 'Final' && (
                          <button
                            onClick={() => cycleStatus(game.id, game.status)}
                            className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-navy hover:bg-navy-light text-white transition-colors">
                            {nextStatusLabel(game.status)}
                          </button>
                        )}
                        <QuickRescheduleBtn game={game} onRescheduled={loadConflicts} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-2 font-cond text-[10px] text-muted">{filtered.length} games</div>
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto">
          <div className="flex gap-3" style={{ minWidth: `${fieldColumns.length * 200}px` }}>
            {fieldColumns.map(({ field, games }) => (
              <div key={field.id} className="flex-shrink-0 w-48">
                <div className="bg-navy text-center py-2 rounded-md mb-2 border border-border">
                  <div className="font-cond font-black text-[13px] tracking-wide">{field.name}</div>
                  <div className="font-cond text-[10px] text-muted">{games.length} games</div>
                </div>
                {games.map(game => {
                  const hasConflict = conflictGameIds.has(game.id)
                  const conflict    = conflicts.find(c => c.impacted_game_ids?.includes(game.id))
                  return (
                    <div key={game.id} className={cn(
                      'rounded-md border mb-2 overflow-hidden',
                      hasConflict
                        ? conflict?.severity === 'critical'
                          ? 'border-red-600/60 bg-red-900/15'
                          : 'border-yellow-600/60 bg-yellow-900/10'
                        : game.status === 'Live'
                          ? 'border-green-700/60 bg-green-900/10'
                          : game.status === 'Final'
                            ? 'border-border/50 opacity-70'
                            : 'border-border bg-surface-card'
                    )}>
                      <div className="bg-navy/60 px-2 py-1 flex justify-between items-center">
                        <span className="font-mono text-[10px] text-blue-300">{game.scheduled_time}</span>
                        <span className={cn('font-cond text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded',
                          game.status === 'Live'    ? 'badge-live' :
                          game.status === 'Final'   ? 'badge-final' :
                          game.status === 'Delayed' ? 'badge-delayed' : 'badge-scheduled'
                        )}>{game.status.toUpperCase()}</span>
                      </div>
                      <div className="px-2 py-1.5">
                        <div className="font-cond font-black text-[11px] leading-tight">
                          {game.home_team?.name ?? '?'}
                        </div>
                        <div className="font-cond text-[9px] text-muted my-0.5">vs</div>
                        <div className="font-cond font-black text-[11px] leading-tight">
                          {game.away_team?.name ?? '?'}
                        </div>
                        <div className="font-cond text-[9px] text-muted mt-1">{game.division}</div>
                        {hasConflict && (
                          <div className={cn('font-cond text-[9px] font-bold mt-1',
                            conflict?.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                          )}>
                            ⚠ {conflict?.conflict_type?.replace(/_/g,' ').toUpperCase()}
                          </div>
                        )}
                        {game.status !== 'Final' && (
                          <button
                            onClick={() => cycleStatus(game.id, game.status)}
                            className="mt-1.5 w-full font-cond text-[9px] font-bold tracking-wider py-0.5 rounded bg-navy hover:bg-navy-light text-white transition-colors">
                            {nextStatusLabel(game.status)}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add game modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="ADD GAME"
        footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setAddOpen(false)}>CANCEL</Btn>
          <Btn variant="primary" size="sm" onClick={handleAddGame}>ADD GAME</Btn>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Field">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agField} onChange={e => setAgField(e.target.value)}>
              <option value="">Select field…</option>
              {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FormField>
          <FormField label="Time">
            <input type="time" value={agTime} onChange={e => setAgTime(e.target.value)}
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400" />
          </FormField>
          <FormField label="Division">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agDiv} onChange={e => setAgDiv(e.target.value)}>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <div />
          <FormField label="Home Team">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agHome} onChange={e => setAgHome(e.target.value)}>
              <option value="">Select team…</option>
              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.division})</option>)}
            </select>
          </FormField>
          <FormField label="Away Team">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agAway} onChange={e => setAgAway(e.target.value)}>
              <option value="">Select team…</option>
              {state.teams.filter(t => String(t.id) !== agHome).map(t =>
                <option key={t.id} value={t.id}>{t.name} ({t.division})</option>
              )}
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

// ─── Quick reschedule button ─────────────────────────────────
function QuickRescheduleBtn({ game, onRescheduled }: { game: any; onRescheduled: () => void }) {
  const [open, setOpen]   = useState(false)
  const [time, setTime]   = useState('')
  const [field, setField] = useState('')
  const { state }         = useApp()

  async function save() {
    const sb = createClient()
    const updates: any = {}
    if (time) {
      const [h, m] = time.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
      updates.scheduled_time = `${dh}:${m.toString().padStart(2,'0')} ${ampm}`
    }
    if (field) updates.field_id = Number(field)
    if (Object.keys(updates).length === 0) { setOpen(false); return }

    await sb.from('games').update(updates).eq('id', game.id)
    await fetch('/api/ops-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: 1,
        message: `Game #${game.id} rescheduled: ${Object.entries(updates).map(([k,v]) => `${k}=${v}`).join(', ')}`,
        log_type: 'ok',
      }),
    })
    toast.success(`Game #${game.id} updated`)
    setOpen(false)
    onRescheduled()
    window.location.reload()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-surface-card border border-border text-muted hover:text-white hover:border-blue-400 transition-colors"
      title="Reschedule">
      <MoveHorizontal size={10} />
    </button>
  )

  return (
    <div className="flex items-center gap-1">
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        className="bg-surface border border-border text-white px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-blue-400 w-24" />
      <select value={field} onChange={e => setField(e.target.value)}
        className="bg-surface border border-border text-white px-1 py-0.5 rounded text-[10px] outline-none focus:border-blue-400 w-20">
        <option value="">Field…</option>
        {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <button onClick={save} className="font-cond text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-700 text-white">✓</button>
      <button onClick={() => setOpen(false)} className="font-cond text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-card border border-border text-muted">✕</button>
    </div>
  )
}

// ─── Conflict row with resolution buttons ────────────────────
function ConflictRow({ conflict, onResolve, onApply, applying }: {
  conflict: FieldConflict
  onResolve: () => void
  onApply: (action: string, params: Record<string, unknown>) => void
  applying: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const styles = {
    critical: { border: 'border-l-red-500',    bg: 'bg-red-900/10',     text: 'text-red-400',    icon: <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" /> },
    warning:  { border: 'border-l-yellow-500', bg: 'bg-yellow-900/10',  text: 'text-yellow-400', icon: <AlertTriangle size={12} className="text-yellow-400 shrink-0 mt-0.5" /> },
    info:     { border: 'border-l-blue-400',   bg: 'bg-blue-900/10',    text: 'text-blue-300',   icon: <Shield size={12} className="text-blue-300 shrink-0 mt-0.5" /> },
  }[conflict.severity]

  const TYPE_LABELS: Record<string, string> = {
    field_overlap:    'FIELD OVERLAP',
    field_blocked:    'FIELD BLOCKED',
    schedule_cascade: 'CASCADE DELAY',
    missing_referee:  'MISSING REF',
  }

  return (
    <div className={cn('border-l-4 rounded p-2.5', styles.border, styles.bg)}>
      <div className="flex items-start gap-2">
        {styles.icon}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className={cn('font-cond font-black text-[10px] tracking-widest', styles.text)}>
              {TYPE_LABELS[conflict.conflict_type] ?? conflict.conflict_type.replace(/_/g,' ').toUpperCase()}
            </span>
            <div className="flex items-center gap-1">
              {conflict.impacted_game_ids?.map(id => (
                <span key={id} className="font-cond text-[9px] font-bold bg-white/10 text-muted px-1.5 py-0.5 rounded">#{id}</span>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-gray-200 leading-snug">{conflict.description}</div>

          {/* Resolution options */}
          {conflict.resolution_options?.length > 0 && (
            <div className="mt-1.5">
              <button onClick={() => setExpanded(e => !e)}
                className="font-cond text-[9px] font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1">
                <ChevronRight size={10} className={cn('transition-transform', expanded && 'rotate-90')} />
                {expanded ? 'HIDE FIXES' : `${conflict.resolution_options.length} QUICK FIXES`}
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {conflict.resolution_options.map((opt, i) => (
                    <button key={i}
                      disabled={applying}
                      onClick={() => onApply(opt.action, opt.params ?? {})}
                      className="font-cond text-[9px] font-bold tracking-wide px-2 py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors disabled:opacity-50">
                      {applying ? '...' : opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={onResolve}
          className="shrink-0 font-cond text-[9px] font-bold px-2 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors whitespace-nowrap ml-1">
          DISMISS
        </button>
      </div>
    </div>
  )
}
