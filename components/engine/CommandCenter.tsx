'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import type { OpsAlert } from '@/lib/engines/unified'
import toast from 'react-hot-toast'
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Flame,
  Wind,
  Activity,
  Users,
  Shield,
  FileText,
  ArrowUpRight,
  Radio,
  Play,
  Pause,
} from 'lucide-react'

type CmdTab = 'alerts' | 'feed' | 'fields' | 'handoff'

interface OpsLogEntry {
  id: number
  message: string
  log_type: string
  occurred_at: string
  source: string | null
  entity_type: string | null
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, resolved: 99 }

export function CommandCenter() {
  const { state, currentDate } = useApp()
  const { userRole } = useAuth()
  const [tab, setTab] = useState<CmdTab>('alerts')
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<any>(null)
  const [alerts, setAlerts] = useState<OpsAlert[]>([])
  const [feed, setFeed] = useState<OpsLogEntry[]>([])
  const [feedPaused, setFeedPaused] = useState(false)
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [handoff, setHandoff] = useState<string | null>(null)
  const [generatingHandoff, setGeneratingHandoff] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const feedPausedRef = useRef(false)

  const approverName = userRole?.display_name ?? 'Staff'
  const eventDateId = currentDate?.id ?? 1

  const loadAlerts = useCallback(async () => {
    const sb = createClient()
    const query = sb.from('ops_alerts').select('*').eq('event_id', 1)
    const { data } = showResolved
      ? await query.order('created_at', { ascending: false }).limit(100)
      : await query.eq('resolved', false).order('created_at', { ascending: false })
    const sorted = [...(data ?? [])].sort(
      (a, b) =>
        SEVERITY_ORDER[(a as OpsAlert).severity] - SEVERITY_ORDER[(b as OpsAlert).severity] ||
        new Date((b as OpsAlert).created_at).getTime() -
          new Date((a as OpsAlert).created_at).getTime()
    )
    setAlerts(sorted as OpsAlert[])
  }, [showResolved])

  const loadFeed = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ops_log')
      .select('*')
      .eq('event_id', 1)
      .order('occurred_at', { ascending: false })
      .limit(80)
    setFeed((data as OpsLogEntry[]) ?? [])
  }, [])

  useEffect(() => {
    loadAlerts()
    loadFeed()
  }, [loadAlerts, loadFeed])

  // Realtime subscriptions
  useEffect(() => {
    const sb = createClient()
    const alertSub = sb
      .channel('cmd-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_alerts' }, () =>
        loadAlerts()
      )
      .subscribe()
    const feedSub = sb
      .channel('cmd-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ops_log' },
        (payload) => {
          if (!feedPausedRef.current) {
            setFeed((prev) => [payload.new as OpsLogEntry, ...prev].slice(0, 80))
            // Auto-scroll if at bottom
            if (feedRef.current) {
              feedRef.current.scrollTop = 0
            }
          }
        }
      )
      .subscribe()
    // Also subscribe to game changes for field board
    const gameSub = sb
      .channel('cmd-games')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => {
        // trigger game refresh via store if needed
      })
      .subscribe()
    return () => {
      sb.removeChannel(alertSub)
      sb.removeChannel(feedSub)
      sb.removeChannel(gameSub)
    }
  }, [loadAlerts])

  useEffect(() => {
    feedPausedRef.current = feedPaused
  }, [feedPaused])

  async function handleRunAll() {
    setRunning(true)
    try {
      const response = await fetch('/api/unified-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date_id: eventDateId }),
      })
      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error ?? 'Engine run failed')
      }
      const result = await response.json()
      setRunResult(result)
      setLastRun(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
      await loadAlerts()
      const total = result.alerts_created + result.alerts_escalated
      if (total === 0) toast.success('All systems clear — no issues detected')
      else
        toast(`${result.alerts_created} new alerts, ${result.alerts_escalated} escalated`, {
          icon: '⚠️',
          duration: 4000,
        })
    } catch (err: any) {
      toast.error(err.message)
    }
    setRunning(false)
  }

  async function handleResolve(alertId: number, note?: string) {
    setResolvingId(alertId)
    try {
      const response = await fetch('/api/unified-engine/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, resolved_by: approverName, note }),
      })
      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error ?? 'Resolve failed')
      }
      toast.success('Resolved')
      await loadAlerts()
    } catch (err: any) {
      toast.error(err.message)
    }
    setResolvingId(null)
  }

  async function handleGenerateHandoff() {
    setGeneratingHandoff(true)
    try {
      const response = await fetch('/api/shift-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: approverName }),
      })
      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error ?? 'Shift handoff failed')
      }
      const handoffData = await response.json()
      setHandoff(handoffData.summary ?? handoffData)
      toast.success('Shift handoff generated')
    } catch (err: any) {
      toast.error(err.message)
    }
    setGeneratingHandoff(false)
  }

  const criticals = alerts.filter((a) => a.severity === 'critical' && !a.resolved)
  const warnings = alerts.filter((a) => a.severity === 'warning' && !a.resolved)
  const open = criticals.length + warnings.length

  const gamesByField: Record<number, any[]> = {}
  for (const game of state.games) {
    if (!gamesByField[game.field_id]) gamesByField[game.field_id] = []
    gamesByField[game.field_id].push(game)
  }

  return (
    <div>
      {/* Command strip */}
      <div className="flex items-center gap-3 mb-5 bg-surface-card border border-border rounded-xl px-4 py-3">
        {/* Run button */}
        <button
          onClick={handleRunAll}
          disabled={running}
          className={cn(
            'flex items-center gap-2 font-cond font-black text-[13px] tracking-widest px-5 py-2.5 rounded-lg transition-all',
            running
              ? 'bg-navy text-muted cursor-wait'
              : 'bg-red hover:bg-red/80 text-white shadow-lg shadow-red/20'
          )}
        >
          {running ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> SCANNING...
            </>
          ) : (
            <>
              <Zap size={14} /> RUN ALL ENGINES
            </>
          )}
        </button>

        {/* Last run */}
        {lastRun && (
          <div className="font-cond text-[11px] text-muted">
            Last scan: <span className="text-white">{lastRun}</span>
          </div>
        )}

        {/* Run result chips */}
        {runResult && (
          <div className="flex gap-2 ml-1">
            {[
              { label: 'REF', val: runResult.referee_conflicts, color: 'text-blue-300' },
              { label: 'FIELD', val: runResult.field_conflicts, color: 'text-orange-300' },
              { label: 'WEATHER', val: runResult.weather_alerts, color: 'text-yellow-300' },
            ].map((c) => (
              <div key={c.label} className={cn('font-cond text-[10px] font-bold', c.color)}>
                {c.label}: <span className="text-white">{c.val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert summary */}
        <div className="ml-auto flex items-center gap-3">
          {criticals.length > 0 && (
            <div className="flex items-center gap-1.5 font-cond font-black text-[13px] text-red-400 animate-pulse">
              <AlertTriangle size={14} /> {criticals.length} CRITICAL
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1.5 font-cond font-bold text-[12px] text-yellow-400">
              <AlertTriangle size={13} /> {warnings.length} WARNING
            </div>
          )}
          {open === 0 && (
            <div className="flex items-center gap-1.5 font-cond font-bold text-[12px] text-green-400">
              <CheckCircle size={13} /> ALL CLEAR
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {[
          { id: 'alerts', label: `Alerts${open > 0 ? ` (${open})` : ''}` },
          { id: 'feed', label: 'Live Feed' },
          { id: 'fields', label: 'Field Board' },
          { id: 'handoff', label: 'Shift Handoff' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as CmdTab)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              tab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white',
              t.id === 'alerts' && criticals.length > 0 && tab !== t.id && 'text-red-400'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ALERTS ── */}
      {tab === 'alerts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="font-cond text-[11px] text-muted">
              {open} open · alerts escalate to CRITICAL after 15 min
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResolved((s) => !s)}
                className={cn(
                  'font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
                  showResolved
                    ? 'bg-navy border-blue-400 text-white'
                    : 'bg-surface-card border-border text-muted hover:text-white'
                )}
              >
                {showResolved ? 'HIDE RESOLVED' : 'SHOW RESOLVED'}
              </button>
              <button
                onClick={loadAlerts}
                className="font-cond text-[11px] text-muted hover:text-white px-2 py-1.5"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-900/30 border-2 border-green-700/40 flex items-center justify-center">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <div className="font-cond font-black text-[20px] text-green-400">
                ALL SYSTEMS CLEAR
              </div>
              <div className="font-cond text-[12px] text-muted">
                Run All Engines to scan for new conflicts
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  resolving={resolvingId === a.id}
                  onResolve={(note) => handleResolve(a.id, note)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LIVE FEED ── */}
      {tab === 'feed' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-cond text-[11px] text-white font-bold">
                LIVE OPERATIONS FEED
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFeedPaused((p) => !p)}
                className={cn(
                  'flex items-center gap-1.5 font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
                  feedPaused
                    ? 'bg-yellow-800/40 border-yellow-700/50 text-yellow-300'
                    : 'bg-surface-card border-border text-muted hover:text-white'
                )}
              >
                {feedPaused ? (
                  <>
                    <Play size={11} /> RESUME
                  </>
                ) : (
                  <>
                    <Pause size={11} /> PAUSE
                  </>
                )}
              </button>
              <button
                onClick={loadFeed}
                className="font-cond text-[11px] text-muted hover:text-white px-2 py-1.5"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          <div
            ref={feedRef}
            className="bg-surface-card border border-border rounded-xl overflow-hidden"
          >
            {feed.length === 0 ? (
              <div className="text-center py-12 text-muted font-cond">No activity yet</div>
            ) : (
              <div className="divide-y divide-border/30">
                {feed.map((entry, i) => (
                  <FeedEntry key={entry.id} entry={entry} isNew={i === 0} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FIELD BOARD ── */}
      {tab === 'fields' && (
        <div>
          <div className="font-cond text-[11px] text-muted mb-4">
            Click any game to manage it. Real-time status updates automatically.
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {state.fields.map((field) => {
              const fieldGames = (gamesByField[field.id] ?? []).sort((a: any, b: any) =>
                (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
              )
              const liveGame = fieldGames.find((g: any) => ['Live', 'Halftime'].includes(g.status))
              const fieldAlerts = alerts.filter((a) => a.field_id === field.id && !a.resolved)

              return (
                <FieldCard
                  key={field.id}
                  field={field}
                  games={fieldGames}
                  liveGame={liveGame}
                  fieldAlerts={fieldAlerts}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── SHIFT HANDOFF ── */}
      {tab === 'handoff' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="font-cond font-black text-[14px] text-white mb-0.5">
                SHIFT HANDOFF LOG
              </div>
              <div className="font-cond text-[11px] text-muted">
                Auto-generates a summary of the last hour for incoming operations staff.
              </div>
            </div>
            <button
              onClick={handleGenerateHandoff}
              disabled={generatingHandoff}
              className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wide bg-navy hover:bg-navy-light text-white px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileText size={14} />
              {generatingHandoff ? 'GENERATING...' : 'GENERATE HANDOFF'}
            </button>
          </div>

          {handoff ? (
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <div className="font-cond text-[11px] text-muted mb-3 flex justify-between">
                <span>Generated by {approverName}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(handoff)
                    toast.success('Copied to clipboard')
                  }}
                  className="text-blue-300 hover:text-white"
                >
                  Copy
                </button>
              </div>
              <pre className="font-mono text-[12px] text-white whitespace-pre-wrap leading-relaxed">
                {handoff}
              </pre>
            </div>
          ) : (
            <HandoffHistory />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Alert Card ───────────────────────────────────────────────
function AlertCard({
  alert: a,
  resolving,
  onResolve,
}: {
  alert: OpsAlert
  resolving: boolean
  onResolve: (note?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const ageMin = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 60000)

  const severityConfig = {
    critical: {
      bg: 'bg-red-900/20 border-red-700/60',
      badge: 'bg-red-700 text-white',
      icon: <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />,
      label: 'CRITICAL',
    },
    warning: {
      bg: 'bg-yellow-900/15 border-yellow-700/50',
      badge: 'bg-yellow-700/80 text-white',
      icon: <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />,
      label: 'WARNING',
    },
    info: {
      bg: 'bg-blue-900/10 border-blue-700/30',
      badge: 'bg-blue-800 text-white',
      icon: <Activity size={16} className="text-blue-400 flex-shrink-0" />,
      label: 'INFO',
    },
    resolved: {
      bg: 'bg-green-900/10 border-green-700/30 opacity-60',
      badge: 'bg-green-800 text-white',
      icon: <CheckCircle size={16} className="text-green-400 flex-shrink-0" />,
      label: 'RESOLVED',
    },
  }
  const cfg = severityConfig[a.severity] ?? severityConfig.info

  const sourceIcon: Record<string, React.ReactNode> = {
    referee_engine: <Users size={11} />,
    field_engine: <Activity size={11} />,
    weather_engine: <Wind size={11} />,
    escalation: <Flame size={11} />,
  }

  return (
    <div className={cn('border rounded-xl transition-all', cfg.bg)}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {cfg.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="font-cond font-black text-[15px] text-white leading-tight">
                {a.title}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-cond text-[9px] text-muted flex items-center gap-1">
                  {sourceIcon[a.source ?? '']} {a.source?.replace('_engine', '')}
                </span>
                <span
                  className={cn(
                    'font-cond text-[9px] font-black px-2 py-0.5 rounded tracking-widest',
                    cfg.badge
                  )}
                >
                  {cfg.label}
                </span>
                <span className="font-cond text-[9px] text-muted">
                  {ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`}
                </span>
              </div>
            </div>
            {a.description && (
              <div className="font-cond text-[12px] text-muted mt-0.5 leading-snug">
                {a.description}
              </div>
            )}

            {/* Resolution suggestion */}
            {a.resolution_suggestion && !a.resolved && (
              <div className="mt-2.5 bg-black/20 rounded-lg px-3 py-2 border border-border/40">
                <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-0.5">
                  RECOMMENDED ACTION
                </div>
                <div className="font-cond text-[12px] text-blue-300 leading-snug">
                  {a.resolution_suggestion}
                </div>
                {a.resolution_action && (
                  <div className="font-cond text-[9px] text-green-400 mt-1">
                    ✓ Can be auto-applied — click APPLY below
                  </div>
                )}
              </div>
            )}

            {/* Resolved info */}
            {a.resolved && (
              <div className="mt-2 font-cond text-[11px] text-green-400">
                ✓ Resolved by {a.resolved_by} — {a.resolution_note}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!a.resolved && (
          <div className="mt-3 flex gap-2 items-center">
            {!expanded ? (
              <>
                {a.resolution_action ? (
                  <button
                    onClick={() => onResolve(a.resolution_suggestion ?? undefined)}
                    disabled={resolving}
                    className="flex items-center gap-1.5 font-cond text-[12px] font-bold px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                  >
                    <Zap size={12} />
                    {resolving ? 'APPLYING...' : 'APPLY & RESOLVE'}
                  </button>
                ) : null}
                <button
                  onClick={() => setExpanded(true)}
                  className="font-cond text-[12px] font-bold px-4 py-2 rounded-lg border border-border text-muted hover:text-white transition-colors"
                >
                  {a.resolution_action ? 'RESOLVE MANUALLY' : 'RESOLVE'}
                </button>
              </>
            ) : (
              <div className="flex gap-2 items-center flex-1">
                <input
                  className="flex-1 bg-surface border border-border text-white px-2.5 py-2 rounded text-[12px] outline-none focus:border-blue-400"
                  placeholder="Resolution note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  onClick={() => {
                    onResolve(note || undefined)
                    setExpanded(false)
                  }}
                  disabled={resolving}
                  className="font-cond text-[12px] font-bold px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
                >
                  {resolving ? '...' : 'CONFIRM'}
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-muted hover:text-white text-[11px]"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Feed Entry ───────────────────────────────────────────────
function FeedEntry({ entry, isNew }: { entry: OpsLogEntry; isNew: boolean }) {
  const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })

  const cfg: Record<string, { dot: string; text: string }> = {
    ok: { dot: 'bg-green-400', text: 'text-green-300' },
    warn: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
    alert: { dot: 'bg-red-400 animate-pulse', text: 'text-red-300' },
    info: { dot: 'bg-blue-400', text: 'text-muted' },
  }
  const c = cfg[entry.log_type] ?? cfg.info

  const sourceLabels: Record<string, string> = {
    referee_engine: 'REF',
    field_engine: 'FIELD',
    weather_engine: 'WX',
    unified_engine: 'ENGINE',
    command_center: 'CMD',
  }
  const sourceLabel = entry.source
    ? (sourceLabels[entry.source] ?? entry.source.toUpperCase())
    : null

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/5',
        isNew && 'bg-blue-900/10'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', c.dot)} />
      <div className="font-mono text-[11px] text-muted flex-shrink-0 pt-px">{time}</div>
      {sourceLabel && (
        <div className="font-cond text-[9px] font-black bg-navy border border-border rounded px-1.5 py-0.5 text-muted flex-shrink-0 mt-0.5">
          {sourceLabel}
        </div>
      )}
      <div className={cn('font-cond text-[12px] flex-1', c.text)}>{entry.message}</div>
    </div>
  )
}

// ─── Field Card ───────────────────────────────────────────────
function FieldCard({
  field,
  games,
  liveGame,
  fieldAlerts,
}: {
  field: any
  games: any[]
  liveGame: any
  fieldAlerts: OpsAlert[]
}) {
  const [expanded, setExpanded] = useState(false)
  const hasCritical = fieldAlerts.some((a) => a.severity === 'critical')
  const hasWarning = fieldAlerts.some((a) => a.severity === 'warning')

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        hasCritical
          ? 'border-red-700/60 bg-red-900/10'
          : hasWarning
            ? 'border-yellow-700/50 bg-yellow-900/10'
            : liveGame
              ? 'border-green-700/50 bg-green-900/10'
              : 'border-border bg-surface-card'
      )}
    >
      {/* Field header */}
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="font-cond font-black text-[15px] text-white">{field.name}</div>
            <div className="flex items-center gap-2">
              {hasCritical && <AlertTriangle size={14} className="text-red-400" />}
              {hasWarning && <AlertTriangle size={14} className="text-yellow-400" />}
              {liveGame && !hasCritical && (
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              <ChevronRight
                size={14}
                className={cn('text-muted transition-transform', expanded && 'rotate-90')}
              />
            </div>
          </div>
          {liveGame ? (
            <div className="font-cond text-[11px] text-green-300 mt-0.5">
              ● LIVE — {liveGame.home_team?.name ?? '?'} vs {liveGame.away_team?.name ?? '?'}
            </div>
          ) : (
            <div className="font-cond text-[11px] text-muted mt-0.5">
              {games.filter((g: any) => g.status === 'Scheduled').length} upcoming
            </div>
          )}
        </div>
      </button>

      {/* Field alerts */}
      {fieldAlerts.length > 0 && (
        <div className="px-3 py-2 border-b border-border/30">
          {fieldAlerts.slice(0, 2).map((a) => (
            <div
              key={a.id}
              className={cn(
                'font-cond text-[10px] font-bold flex items-center gap-1.5',
                a.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
              )}
            >
              <AlertTriangle size={10} /> {a.title}
            </div>
          ))}
        </div>
      )}

      {/* Expanded game list */}
      {expanded && (
        <div className="divide-y divide-border/30">
          {games.length === 0 ? (
            <div className="px-4 py-3 text-muted font-cond text-[11px]">No games assigned</div>
          ) : (
            games.map((g: any) => <GameRow key={g.id} game={g} />)
          )}
        </div>
      )}
    </div>
  )
}

// ─── Game Row in field card ────────────────────────────────────
function GameRow({ game }: { game: any }) {
  const [managing, setManaging] = useState(false)

  const statusCfg: Record<string, string> = {
    Live: 'badge-live',
    Halftime: 'bg-yellow-700 text-white font-cond text-[9px] font-black px-1.5 py-0.5 rounded',
    Final: 'badge-final',
    Scheduled: 'badge-scheduled',
    Delayed: 'bg-orange-700/80 text-white font-cond text-[9px] font-black px-1.5 py-0.5 rounded',
    Suspended: 'bg-red-700 text-white font-cond text-[9px] font-black px-1.5 py-0.5 rounded',
  }

  async function updateStatus(newStatus: string) {
    const sb = createClient()
    await sb.from('games').update({ status: newStatus }).eq('id', game.id)
    await sb.from('ops_log').insert({
      event_id: 1,
      message: `Game #${game.id} status → ${newStatus} (via Command Center)`,
      log_type: newStatus === 'Live' ? 'ok' : newStatus === 'Final' ? 'info' : 'warn',
      source: 'command_center',
      occurred_at: new Date().toISOString(),
    })
    setManaging(false)
    toast.success(`Game #${game.id} → ${newStatus}`)
  }

  return (
    <div>
      <button
        onClick={() => setManaging((m) => !m)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
      >
        <div>
          <div className="font-cond text-[12px] font-bold text-white">
            {game.home_team?.name ?? '?'} vs {game.away_team?.name ?? '?'}
          </div>
          <div className="font-cond text-[10px] text-muted">
            {game.scheduled_time} · #{game.id}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={statusCfg[game.status] ?? 'badge-scheduled'}>
            {game.status?.toUpperCase()}
          </span>
          <ArrowUpRight
            size={12}
            className={cn('text-muted transition-transform', managing && 'rotate-45')}
          />
        </div>
      </button>

      {/* Inline game management */}
      {managing && (
        <div className="px-4 pb-3 bg-black/20">
          <div className="font-cond text-[9px] font-bold tracking-widest text-muted uppercase mb-2">
            UPDATE STATUS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Scheduled', 'Starting', 'Live', 'Halftime', 'Final', 'Delayed', 'Suspended'].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={cn(
                    'font-cond text-[10px] font-bold px-2.5 py-1.5 rounded border transition-colors',
                    game.status === s
                      ? 'bg-navy border-blue-400 text-white'
                      : 'bg-surface border-border text-muted hover:text-white hover:border-blue-400'
                  )}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Handoff History ──────────────────────────────────────────
function HandoffHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('shift_handoffs')
      .select('*')
      .eq('event_id', 1)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory(data ?? []))
  }, [])

  if (history.length === 0)
    return (
      <div className="text-center py-12 text-muted font-cond">
        No handoffs generated yet. Click GENERATE HANDOFF to create one.
      </div>
    )

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-2">
        <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
          PREVIOUS HANDOFFS
        </div>
        {history.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelected(h)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
              selected?.id === h.id
                ? 'bg-navy border-blue-400 text-white'
                : 'bg-surface-card border-border text-muted hover:text-white'
            )}
          >
            <div className="font-cond font-bold text-[12px]">
              {new Date(h.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
            <div className="font-cond text-[10px]">{h.created_by}</div>
          </button>
        ))}
      </div>
      <div className="col-span-2">
        {selected ? (
          <div className="bg-surface-card border border-border rounded-xl p-5">
            <pre className="font-mono text-[11px] text-white whitespace-pre-wrap leading-relaxed">
              {selected.summary}
            </pre>
          </div>
        ) : (
          <div className="text-center py-16 text-muted font-cond">Select a handoff to view</div>
        )}
      </div>
    </div>
  )
}
