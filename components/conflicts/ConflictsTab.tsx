'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Btn, FormField, SectionHeader, Pill } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { createClient } from '@/supabase/client'
import type { OperationalConflict } from '@/types'
import {
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Shield,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Calendar,
} from 'lucide-react'

type SubTab = 'conflicts' | 'blocks' | 'history'

interface FieldBlock {
  id: number
  field_id: number
  reason: string
  starts_at: string
  ends_at: string
  notes: string | null
  field?: { id: number; name: string }
}

interface EngineRun {
  id: number
  engine_type: string
  conflicts_found: number
  duration_ms: number
  triggered_by: string
  ran_at: string
}

export function ConflictsTab() {
  const { state, currentDate } = useApp()
  const [subTab, setSubTab] = useState<SubTab>('conflicts')
  const [conflicts, setConflicts] = useState<OperationalConflict[]>([])
  const [blocks, setBlocks] = useState<FieldBlock[]>([])
  const [runs, setRuns] = useState<EngineRun[]>([])
  const [running, setRunning] = useState(false)
  const [engineResult, setEngineResult] = useState<any | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  // Block form
  const [blockField, setBlockField] = useState('')
  const [blockReason, setBlockReason] = useState('maintenance')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockNotes, setBlockNotes] = useState('')
  const [addingBlock, setAddingBlock] = useState(false)

  const eventId = state.event?.id

  const loadConflicts = useCallback(async () => {
    if (!eventId) return
    const res = await fetch(`/api/field-engine?event_id=${eventId}&type=open`)
    if (res.ok) setConflicts((await res.json()) as OperationalConflict[])
  }, [eventId])

  const loadBlocks = useCallback(async () => {
    if (!eventId) return
    const sb = createClient()
    const { data } = await sb
      .from('field_blocks')
      .select('*, field:fields(id, name)')
      .eq('event_id', eventId)
      .order('starts_at')
    setBlocks((data as FieldBlock[]) ?? [])
  }, [eventId])

  const loadHistory = useCallback(async () => {
    if (!eventId) return
    const res = await fetch(`/api/field-engine?event_id=${eventId}&type=history`)
    if (res.ok) setRuns((await res.json()) as EngineRun[])
  }, [eventId])

  useEffect(() => {
    loadConflicts()
    loadBlocks()
  }, [loadConflicts, loadBlocks])

  useEffect(() => {
    if (subTab === 'history') loadHistory()
  }, [subTab, loadHistory])

  async function runEngine() {
    if (!currentDate) {
      toast.error('No event date selected')
      return
    }
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
      setEngineResult(data)
      await loadConflicts()
      if (data.clean) toast.success(data.summary)
      else toast(`${data.conflicts.length} conflicts detected`, { icon: '⚠️' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  async function applyResolution(
    conflictId: number,
    action: string,
    params: Record<string, unknown>
  ) {
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
        setConflicts((prev) => prev.filter((c) => c.id !== conflictId))
      } else {
        toast.error(data.message)
      }
    } finally {
      setApplying(null)
    }
  }

  async function dismissConflict(id: number) {
    const res = await fetch('/api/conflicts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setConflicts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Dismissed')
    }
  }

  async function addBlock() {
    if (!blockField || !blockStart || !blockEnd) {
      toast.error('Field, start and end time required')
      return
    }
    setAddingBlock(true)
    const sb = createClient()
    const { error } = await sb.from('field_blocks').insert({
      field_id: Number(blockField),
      event_id: eventId,
      reason: blockReason,
      starts_at: blockStart,
      ends_at: blockEnd,
      notes: blockNotes || null,
    })
    if (error) {
      toast.error(error.message)
      setAddingBlock(false)
      return
    }
    await fetch('/api/ops-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        message: `Field block added: ${state.fields.find((f) => f.id === Number(blockField))?.name} — ${blockReason}`,
        log_type: 'warn',
      }),
    })
    toast.success('Field block added')
    setBlockField('')
    setBlockStart('')
    setBlockEnd('')
    setBlockNotes('')
    await loadBlocks()
    setAddingBlock(false)
  }

  async function removeBlock(id: number) {
    const sb = createClient()
    await sb.from('field_blocks').delete().eq('id', id)
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    toast.success('Block removed')
  }

  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length
  const infoCount = conflicts.filter((c) => c.severity === 'info').length

  const SUBTABS: { id: SubTab; label: string }[] = [
    {
      id: 'conflicts',
      label: conflicts.length > 0 ? `Conflicts (${conflicts.length})` : 'Conflicts',
    },
    { id: 'blocks', label: `Field Blocks (${blocks.length})` },
    { id: 'history', label: 'Engine History' },
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              subTab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white',
              t.id === 'conflicts' &&
                conflicts.length > 0 &&
                subTab !== t.id &&
                (criticalCount > 0 ? 'text-red-400' : 'text-yellow-400')
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          {engineResult && (
            <span className="font-cond text-[10px] text-muted">{engineResult.summary}</span>
          )}
          <Btn variant="primary" size="sm" onClick={runEngine} disabled={running}>
            <RefreshCw size={11} className={cn('inline mr-1', running && 'animate-spin')} />
            {running ? 'SCANNING...' : 'RUN ENGINE'}
          </Btn>
        </div>
      </div>

      {/* Engine stats bar */}
      {engineResult && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            {
              label: 'GAMES SCANNED',
              value: engineResult.stats?.gamesScanned ?? 0,
              color: 'text-blue-300',
            },
            {
              label: 'FIELDS SCANNED',
              value: engineResult.stats?.fieldsScanned ?? 0,
              color: 'text-blue-300',
            },
            {
              label: 'OVERLAPS',
              value: engineResult.stats?.overlapCount ?? 0,
              color: engineResult.stats?.overlapCount > 0 ? 'text-red-400' : 'text-green-400',
            },
            {
              label: 'FIELD BLOCKS',
              value: engineResult.stats?.blockedCount ?? 0,
              color: engineResult.stats?.blockedCount > 0 ? 'text-yellow-400' : 'text-green-400',
            },
            {
              label: 'CASCADE RISK',
              value: engineResult.stats?.cascadeCount ?? 0,
              color: engineResult.stats?.cascadeCount > 0 ? 'text-orange-400' : 'text-green-400',
            },
          ].map((s) => (
            <div key={s.label} className="bg-surface-card border border-border rounded-md p-2.5">
              <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-0.5">
                {s.label}
              </div>
              <div className={cn('font-mono text-xl font-bold', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONFLICTS ── */}
      {subTab === 'conflicts' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
              {conflicts.length === 0 ? (
                <span className="text-green-400">ALL CLEAR — NO OPEN CONFLICTS</span>
              ) : (
                <>
                  {criticalCount > 0 && (
                    <span className="text-red-400 mr-3">{criticalCount} CRITICAL</span>
                  )}
                  {warningCount > 0 && (
                    <span className="text-yellow-400 mr-3">{warningCount} WARNINGS</span>
                  )}
                  {infoCount > 0 && <span className="text-blue-300">{infoCount} INFO</span>}
                </>
              )}
            </div>
            <Btn size="sm" variant="ghost" onClick={loadConflicts}>
              REFRESH
            </Btn>
          </div>

          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <CheckCircle size={48} className="text-green-400" />
              <div className="font-cond font-black text-[18px] text-green-400">ALL CLEAR</div>
              <div className="font-cond text-[12px] text-muted">
                Run the engine to scan for field conflicts
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <ConflictCard
                  key={c.id}
                  conflict={c}
                  onDismiss={() => dismissConflict(c.id)}
                  onApply={(action, params) => applyResolution(c.id, action, params)}
                  applying={applying === c.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FIELD BLOCKS ── */}
      {subTab === 'blocks' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Add block form */}
          <div>
            <SectionHeader>ADD FIELD BLOCK</SectionHeader>
            <div className="bg-surface-card border border-border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <FormField label="Field">
                  <select
                    className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                    value={blockField}
                    onChange={(e) => setBlockField(e.target.value)}
                  >
                    <option value="">Select field…</option>
                    {state.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Reason">
                  <select
                    className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="reserved">Reserved</option>
                    <option value="weather">Weather</option>
                    <option value="lightning">Lightning</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField label="Start Time">
                  <input
                    type="datetime-local"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
                  />
                </FormField>
                <FormField label="End Time">
                  <input
                    type="datetime-local"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
                  />
                </FormField>
              </div>
              <FormField label="Notes (optional)" className="mb-3">
                <input
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  placeholder="e.g. Ground crew maintenance 8–10am"
                  className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                />
              </FormField>
              <Btn variant="primary" className="w-full" onClick={addBlock} disabled={addingBlock}>
                <Plus size={12} className="inline mr-1" />
                ADD FIELD BLOCK
              </Btn>
              <div className="text-[10px] text-muted font-cond mt-2 leading-relaxed">
                Field blocks prevent games from being scheduled during that window. Run the conflict
                engine after adding blocks to flag any existing games that conflict.
              </div>
            </div>
          </div>

          {/* Existing blocks */}
          <div>
            <SectionHeader>ACTIVE FIELD BLOCKS ({blocks.length})</SectionHeader>
            {blocks.length === 0 ? (
              <div className="text-center py-12 text-muted font-cond font-bold">
                NO FIELD BLOCKS SET
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      'flex items-start justify-between rounded-md border p-3 border-l-4',
                      block.reason === 'weather' || block.reason === 'lightning'
                        ? 'border-l-red-500 bg-red-900/10 border-red-900/40'
                        : block.reason === 'maintenance'
                          ? 'border-l-yellow-500 bg-yellow-900/10 border-yellow-900/30'
                          : 'border-l-blue-400 bg-blue-900/10 border-blue-900/30'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-cond font-black text-[13px] text-white">
                          {block.field?.name ?? `Field ${block.field_id}`}
                        </span>
                        <span
                          className={cn(
                            'font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase',
                            block.reason === 'weather' || block.reason === 'lightning'
                              ? 'bg-red-900/40 text-red-300'
                              : 'bg-yellow-900/40 text-yellow-300'
                          )}
                        >
                          {block.reason}
                        </span>
                      </div>
                      <div className="font-cond text-[11px] text-muted">
                        <Clock size={10} className="inline mr-1" />
                        {new Date(block.starts_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' → '}
                        {new Date(block.ends_at).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      {block.notes && (
                        <div className="text-[11px] text-gray-300 mt-1">{block.notes}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-muted hover:text-red-400 transition-colors ml-3 mt-0.5 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENGINE HISTORY ── */}
      {subTab === 'history' && (
        <div>
          <SectionHeader>ENGINE RUN HISTORY</SectionHeader>
          {runs.length === 0 ? (
            <div className="text-center py-12 text-muted font-cond">
              No engine runs yet — click RUN ENGINE to start
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-navy">
                  {['TIME', 'TYPE', 'CONFLICTS', 'DURATION', 'TRIGGERED BY'].map((h) => (
                    <th
                      key={h}
                      className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border/40 hover:bg-white/5">
                    <td className="font-mono text-blue-300 text-[11px] px-3 py-2">
                      {new Date(run.ran_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="font-cond font-bold px-3 py-2 uppercase">{run.engine_type}</td>
                    <td className="px-3 py-2">
                      {run.conflicts_found === 0 ? (
                        <span className="font-cond text-[11px] text-green-400 font-bold">
                          0 — CLEAN
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'font-mono font-bold',
                            run.conflicts_found > 3 ? 'text-red-400' : 'text-yellow-400'
                          )}
                        >
                          {run.conflicts_found}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-muted text-[11px] px-3 py-2">
                      {run.duration_ms}ms
                    </td>
                    <td className="font-cond text-[11px] text-muted px-3 py-2">
                      {run.triggered_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Full conflict card with resolution actions ───────────────
function ConflictCard({
  conflict,
  onDismiss,
  onApply,
  applying,
}: {
  conflict: OperationalConflict
  onDismiss: () => void
  onApply: (action: string, params: Record<string, unknown>) => void
  applying: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const styles = {
    critical: {
      border: 'border-l-red-500',
      bg: 'bg-red-900/10 border-red-900/40',
      text: 'text-red-400',
      icon: <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />,
    },
    warning: {
      border: 'border-l-yellow-500',
      bg: 'bg-yellow-900/10 border-yellow-900/30',
      text: 'text-yellow-400',
      icon: <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />,
    },
    info: {
      border: 'border-l-blue-400',
      bg: 'bg-blue-900/10 border-blue-900/30',
      text: 'text-blue-300',
      icon: <Shield size={14} className="text-blue-300 shrink-0 mt-0.5" />,
    },
  }[conflict.severity]

  const TYPE_LABELS: Record<string, string> = {
    field_overlap: '⚡ FIELD OVERLAP',
    field_blocked: '🚫 FIELD BLOCKED',
    schedule_cascade: '⏱ CASCADE DELAY',
    missing_referee: '👤 MISSING REF',
  }

  return (
    <div className={cn('border border-l-4 rounded-lg p-3', styles.border, styles.bg)}>
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-1.5">
            <span className={cn('font-cond font-black text-[12px] tracking-widest', styles.text)}>
              {TYPE_LABELS[conflict.conflict_type] ??
                conflict.conflict_type.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="font-mono text-[10px] text-muted ml-2 shrink-0">
              {new Date(conflict.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Description */}
          <p className="text-[12px] text-gray-100 leading-snug mb-2">{conflict.description}</p>

          {/* Impacted games */}
          {conflict.impacted_game_ids?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="font-cond text-[10px] text-muted">Affects:</span>
              {conflict.impacted_game_ids.map((id) => {
                return (
                  <span
                    key={id}
                    className="font-cond text-[10px] font-bold bg-white/10 text-muted px-2 py-0.5 rounded"
                  >
                    Game #{id}
                  </span>
                )
              })}
              {conflict.impacted_field_ids?.map((id) => (
                <span
                  key={id}
                  className="font-cond text-[10px] font-bold bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded"
                >
                  Field {id}
                </span>
              ))}
            </div>
          )}

          {/* Resolution options */}
          {conflict.resolution_options?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="font-cond text-[10px] font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1 mb-1"
              >
                <ChevronRight
                  size={11}
                  className={cn('transition-transform', expanded && 'rotate-90')}
                />
                {expanded
                  ? 'HIDE RESOLUTION OPTIONS'
                  : `${conflict.resolution_options.length} RESOLUTION OPTION${conflict.resolution_options.length > 1 ? 'S' : ''}`}
              </button>
              {expanded && (
                <div className="grid grid-cols-2 gap-1.5">
                  {conflict.resolution_options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={applying}
                      onClick={() => onApply(opt.action, opt.params ?? {})}
                      className={cn(
                        'font-cond text-[10px] font-bold tracking-wide px-3 py-2 rounded border text-left transition-colors',
                        'bg-navy/60 border-border hover:bg-navy hover:border-blue-400 text-white',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {applying ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw size={10} className="animate-spin" /> Applying…
                        </span>
                      ) : (
                        opt.label
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="shrink-0 font-cond text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-800/50 transition-colors whitespace-nowrap"
        >
          DISMISS
        </button>
      </div>
    </div>
  )
}
