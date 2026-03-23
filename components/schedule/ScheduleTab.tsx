'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { StatusBadge, Modal, Btn, FormField, SectionHeader } from '@/components/ui'
import { cn, nextStatusLabel, nextGameStatus } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { GameStatus, OperationalConflict } from '@/types'
import { createClient } from '@/supabase/client'
import { useRef } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Shield,
  Zap,
  ChevronRight,
  MoveHorizontal,
  Star,
  X,
  Upload,
  Download,
} from 'lucide-react'

type ViewMode = 'table' | 'board'
type TeamFilter = 'all' | 'my-teams'

const FOLLOWED_TEAMS_KEY = 'leagueops-followed-teams'

function loadFollowedTeams(): number[] {
  try {
    const raw = localStorage.getItem(FOLLOWED_TEAMS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveFollowedTeams(ids: number[]) {
  localStorage.setItem(FOLLOWED_TEAMS_KEY, JSON.stringify(ids))
}

interface FieldConflict extends OperationalConflict {
  conflict_type: 'field_overlap' | 'field_blocked' | 'schedule_cascade' | 'missing_referee'
}

export function ScheduleTab() {
  const { state, updateGameStatus, addGame, refreshGames, currentDate, eventId } = useApp()
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [fieldFilter, setFieldFilter] = useState('')
  const [divFilter, setDivFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [conflicts, setConflicts] = useState<FieldConflict[]>([])
  const [running, setRunning] = useState(false)
  const [engineResult, setEngineResult] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)
  const [showConflicts, setShowConflicts] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Schedule CSV import state
  const scheduleFileRef = useRef<HTMLInputElement>(null)
  const [scheduleCsvPreview, setScheduleCsvPreview] = useState<{ rows: Record<string, string>[]; warnings: string[] } | null>(null)
  const [importingSchedule, setImportingSchedule] = useState(false)

  // Follow teams
  const [followedTeams, setFollowedTeams] = useState<number[]>(loadFollowedTeams)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const followedSet = useMemo(() => new Set(followedTeams), [followedTeams])

  function toggleFollowTeam(id: number) {
    setFollowedTeams((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      saveFollowedTeams(next)
      return next
    })
  }

  // Close team picker on outside click
  useEffect(() => {
    if (!teamPickerOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-team-picker]')) setTeamPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [teamPickerOpen])

  // Add game form
  const [agField, setAgField] = useState('')
  const [agHome, setAgHome] = useState('')
  const [agAway, setAgAway] = useState('')
  const [agDiv, setAgDiv] = useState('')
  const [agTime, setAgTime] = useState('08:00')

  const loadConflicts = useCallback(async () => {
    if (!eventId) return
    const res = await fetch(`/api/field-engine?event_id=${eventId}`)
    if (res.ok) {
      const data = await res.json()
      setConflicts(data as FieldConflict[])
    }
  }, [])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  // Run field engine
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
      setConflicts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Conflict dismissed')
    }
  }

  // Time-to-minutes helper for proper chronological sort
  function timeToMin(t: string): number {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) return 0
    let h = parseInt(m[1])
    const min = parseInt(m[2])
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + min
  }

  // Filter games — sort by FIELD first, then TIME
  const filtered = useMemo(() => {
    let g = [...state.games].sort(
      (a, b) => a.field_id - b.field_id || timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)
    )
    if (fieldFilter) g = g.filter((x) => String(x.field_id) === fieldFilter)
    if (divFilter) g = g.filter((x) => x.division.startsWith(divFilter))
    if (statusFilter) g = g.filter((x) => x.status === statusFilter)
    if (teamFilter === 'my-teams' && followedTeams.length > 0) {
      g = g.filter((x) => followedSet.has(x.home_team_id) || followedSet.has(x.away_team_id))
    }
    return g
  }, [state.games, fieldFilter, divFilter, statusFilter, teamFilter, followedTeams, followedSet])

  async function cycleStatus(gameId: number, current: GameStatus) {
    const next = nextGameStatus(current)
    if (!next) return
    await updateGameStatus(gameId, next)
    toast.success(`Game #${gameId} → ${next}`)
  }

  async function handleAddGame() {
    if (!agField || !agHome || !agAway || !agDiv || agHome === agAway) {
      toast.error('Fill all fields (including division). Home ≠ Away.')
      return
    }
    if (!currentDate) {
      toast.error('No event date selected')
      return
    }
    const [h, m] = agTime.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
    const timeStr = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
    await addGame({
      event_id: eventId,
      event_date_id: currentDate.id,
      field_id: Number(agField),
      home_team_id: Number(agHome),
      away_team_id: Number(agAway),
      division: agDiv,
      scheduled_time: timeStr,
      status: 'Scheduled',
      home_score: 0,
      away_score: 0,
      notes: null,
    })
    toast.success('Game added!')
    setAddOpen(false)
  }

  // Generate schedule
  async function handleGenerateSchedule() {
    if (!eventId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/schedule-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed')
      toast.success(`Schedule generated: ${data.gamesCreated} games created`)
      setGenOpen(false)
      await refreshGames()
    } catch (err: any) {
      toast.error(`Schedule error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // --- Schedule CSV helpers ---
  function parseCSV(text: string): string[][] {
    const rows: string[][] = []
    let current = ''
    let inQuotes = false
    let row: string[] = []
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { row.push(current.trim()); current = '' }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++
          row.push(current.trim()); current = ''
          if (row.some(c => c)) rows.push(row)
          row = []
        } else current += ch
      }
    }
    row.push(current.trim())
    if (row.some(c => c)) rows.push(row)
    return rows
  }

  function handleScheduleCSVFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) { toast.error('CSV must have a header row and at least one data row'); return }

      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const expectedCols = ['date', 'time', 'home_team', 'away_team', 'division', 'field']
      const rows: Record<string, string>[] = []
      const warnings: string[] = []

      const missing = expectedCols.filter(c => !headers.includes(c))
      if (missing.length > 0) warnings.push(`Missing columns: ${missing.join(', ')}`)

      for (let i = 1; i < parsed.length; i++) {
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => { obj[h] = parsed[i][idx] || '' })
        if (!obj.home_team || !obj.away_team) { warnings.push(`Row ${i}: missing home_team or away_team — will skip`); continue }
        if (!obj.time) { warnings.push(`Row ${i}: missing time — will skip`); continue }
        rows.push(obj)
      }

      if (rows.length === 0) { toast.error('No valid rows found in CSV'); return }
      setScheduleCsvPreview({ rows, warnings })
    }
    reader.readAsText(file)
  }

  async function importScheduleCSV() {
    if (!scheduleCsvPreview || !currentDate) return
    setImportingSchedule(true)
    const sb = createClient()

    try {
      // Build lookup maps for teams and fields
      const teamMap = new Map(state.teams.map(t => [t.name.toLowerCase(), t]))
      const fieldMap = new Map(state.fields.map(f => [f.name.toLowerCase(), f]))

      const errors: string[] = []
      let created = 0

      for (let i = 0; i < scheduleCsvPreview.rows.length; i++) {
        const row = scheduleCsvPreview.rows[i]
        const homeTeam = teamMap.get(row.home_team?.toLowerCase())
        const awayTeam = teamMap.get(row.away_team?.toLowerCase())
        const field = fieldMap.get(row.field?.toLowerCase())

        if (!homeTeam) { errors.push(`Row ${i + 1}: home team "${row.home_team}" not found`); continue }
        if (!awayTeam) { errors.push(`Row ${i + 1}: away team "${row.away_team}" not found`); continue }
        if (!field && row.field) { errors.push(`Row ${i + 1}: field "${row.field}" not found — using first field`); }

        // Parse time to display format
        let timeStr = row.time
        const tm = row.time.match(/^(\d{1,2}):(\d{2})$/)
        if (tm) {
          const h = parseInt(tm[1])
          const m = parseInt(tm[2])
          const ampm = h >= 12 ? 'PM' : 'AM'
          const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
          timeStr = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
        }

        const { error } = await sb.from('games').insert({
          event_id: eventId,
          event_date_id: currentDate.id,
          field_id: field?.id ?? state.fields[0]?.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          division: row.division || homeTeam.division || '',
          scheduled_time: timeStr,
          status: 'Scheduled',
          home_score: 0,
          away_score: 0,
        })
        if (error) {
          errors.push(`Row ${i + 1}: ${error.message}`)
        } else {
          created++
        }
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} error${errors.length !== 1 ? 's' : ''} during import`)
        console.warn('Schedule import errors:', errors)
      }
      if (created > 0) {
        toast.success(`${created} game${created !== 1 ? 's' : ''} imported`)
      }
      setScheduleCsvPreview(null)
      await refreshGames()
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    }
    setImportingSchedule(false)
  }

  function exportScheduleCSV() {
    const headers = ['date', 'time', 'home_team', 'away_team', 'division', 'field', 'status', 'home_score', 'away_score']
    const csvRows = [headers.join(',')]
    for (const g of filtered) {
      const homeName = g.home_team?.name ?? ''
      const awayName = g.away_team?.name ?? ''
      const fieldName = g.field?.name ?? ''
      const dateStr = currentDate?.date ?? ''
      csvRows.push([
        `"${dateStr}"`,
        `"${g.scheduled_time}"`,
        `"${homeName.replace(/"/g, '""')}"`,
        `"${awayName.replace(/"/g, '""')}"`,
        `"${g.division}"`,
        `"${fieldName.replace(/"/g, '""')}"`,
        `"${g.status}"`,
        `"${g.home_score ?? 0}"`,
        `"${g.away_score ?? 0}"`,
      ].join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `schedule_export.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadScheduleTemplate() {
    const csv = 'date,time,home_team,away_team,division,field\n2026-03-22,08:00,Metro FC Blue,City SC Red,U12 Boys,Field 1'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'schedule_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Field columns for board view
  const fieldColumns = useMemo(() => {
    return state.fields
      .map((field) => ({
        field,
        games: filtered
          .filter((g) => g.field_id === field.id)
          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
      }))
      .filter((fc) => fc.games.length > 0)
  }, [state.fields, filtered])

  if (!eventId) return null

  const divisions = [...new Set(state.teams.map((t) => t.division))].sort()
  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length

  // Games with conflicts highlighted
  const conflictGameIds = new Set(conflicts.flatMap((c) => c.impacted_game_ids ?? []))

  return (
    <div>
      {/* Follow Teams Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-surface-card border border-border rounded-lg px-3 py-2">
        <span className="font-cond text-[10px] font-black tracking-widest text-muted mr-1">
          <Star size={10} className="inline mr-1 text-yellow-400" />
          MY TEAMS
        </span>

        {/* Followed team chips */}
        {followedTeams.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {followedTeams.map((id) => {
              const team = state.teams.find((t) => t.id === id)
              if (!team) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 font-cond text-[10px] font-bold bg-blue-900/40 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full"
                >
                  <Star size={8} className="text-yellow-400 fill-yellow-400" />
                  {team.name}
                  <button
                    onClick={() => toggleFollowTeam(id)}
                    className="hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X size={9} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Team picker dropdown */}
        <div className="relative" data-team-picker>
          <button
            onClick={() => setTeamPickerOpen((o) => !o)}
            className="font-cond text-[10px] font-bold tracking-wider px-2 py-1 rounded border border-border bg-navy hover:bg-navy-light text-white transition-colors"
          >
            + FOLLOW TEAM
          </button>
          {teamPickerOpen && (
            <div className="absolute z-50 mt-1 left-0 w-56 max-h-60 overflow-y-auto bg-surface-card border border-border rounded-lg shadow-xl">
              {state.teams
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((team) => {
                  const isFollowed = followedSet.has(team.id)
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleFollowTeam(team.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-left font-cond text-[11px] font-bold transition-colors border-b border-border/30 last:border-0',
                        isFollowed
                          ? 'bg-blue-900/30 text-blue-300'
                          : 'hover:bg-white/5 text-white'
                      )}
                    >
                      <Star
                        size={10}
                        className={cn(
                          isFollowed ? 'text-yellow-400 fill-yellow-400' : 'text-muted'
                        )}
                      />
                      <span className="truncate">{team.name}</span>
                      <span className="text-[9px] text-muted ml-auto">{team.division}</span>
                    </button>
                  )
                })}
            </div>
          )}
        </div>

        {/* Filter toggle: ALL GAMES | MY TEAMS */}
        {followedTeams.length > 0 && (
          <div className="flex rounded overflow-hidden border border-border ml-auto">
            {(['all', 'my-teams'] as TeamFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTeamFilter(f)}
                className={cn(
                  'font-cond text-[10px] font-bold tracking-wider px-3 py-1 transition-colors',
                  teamFilter === f
                    ? 'bg-blue-700 text-white'
                    : 'bg-surface-card text-muted hover:text-white'
                )}
              >
                {f === 'all' ? 'ALL GAMES' : 'MY TEAMS'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {/* View toggle */}
        <div className="flex rounded overflow-hidden border border-border">
          {(['table', 'board'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 transition-colors',
                viewMode === v
                  ? 'bg-navy text-white'
                  : 'bg-surface-card text-muted hover:text-white'
              )}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Filters */}
        <select
          className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
        >
          <option value="">All Fields</option>
          {state.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <select
          className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={divFilter}
          onChange={(e) => setDivFilter(e.target.value)}
        >
          <option value="">All Divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="bg-surface-card border border-border text-white px-2 py-1.5 rounded font-cond text-[11px] font-bold"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          {(['Scheduled', 'Starting', 'Live', 'Halftime', 'Final', 'Delayed'] as GameStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>

        <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>
          + ADD GAME
        </Btn>
        <Btn size="sm" variant="primary" onClick={() => setGenOpen(true)}>
          <Zap size={11} className="inline mr-1" />
          GENERATE SCHEDULE
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => scheduleFileRef.current?.click()}>
          <Upload size={11} className="inline mr-1" /> IMPORT CSV
        </Btn>
        <Btn size="sm" variant="ghost" onClick={exportScheduleCSV} disabled={filtered.length === 0}>
          <Download size={11} className="inline mr-1" /> EXPORT CSV
        </Btn>
        <button onClick={downloadScheduleTemplate} className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
          <Download size={10} /> Template
        </button>
        <input ref={scheduleFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleScheduleCSVFile(e.target.files[0]); e.target.value = '' }} />

        <div className="ml-auto flex items-center gap-2">
          {/* Conflict badge */}
          {conflicts.length > 0 && (
            <button
              onClick={() => setShowConflicts((s) => !s)}
              className={cn(
                'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors',
                showConflicts
                  ? 'bg-red-900/40 border-red-700/50 text-red-300'
                  : 'bg-red-900/20 border-red-800/40 text-red-400 hover:bg-red-900/30'
              )}
            >
              <AlertTriangle size={11} className="inline mr-1" />
              {criticalCount > 0 && `${criticalCount} CRITICAL `}
              {warningCount > 0 && `${warningCount} WARN`}
              {conflicts.filter((c) => c.severity === 'info').length > 0 &&
                ` ${conflicts.filter((c) => c.severity === 'info').length} INFO`}
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
              FIELD CONFLICTS —{' '}
              {criticalCount > 0 && <span className="text-red-400">{criticalCount} CRITICAL </span>}
              {warningCount > 0 && <span className="text-yellow-400">{warningCount} WARNINGS</span>}
            </span>
            <div className="flex gap-2">
              <button onClick={loadConflicts} className="text-muted hover:text-white">
                <RefreshCw size={12} />
              </button>
              <button
                onClick={() => setShowConflicts(false)}
                className="text-muted hover:text-white"
              >
                <XCircle size={14} />
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map((c) => (
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
                {['TIME', 'FIELD', 'HOME', 'AWAY', 'DIV', 'STATUS', 'SCORE', 'ACTIONS'].map((h) => (
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
              {filtered.map((game) => {
                const hasConflict = conflictGameIds.has(game.id)
                const conflict = conflicts.find((c) => c.impacted_game_ids?.includes(game.id))
                const isFollowedGame =
                  followedTeams.length > 0 &&
                  (followedSet.has(game.home_team_id) || followedSet.has(game.away_team_id))
                return (
                  <tr
                    key={game.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-white/5 transition-colors',
                      game.status === 'Live'
                        ? 'bg-green-900/10'
                        : game.status === 'Delayed'
                          ? 'bg-red-900/10'
                          : hasConflict
                            ? 'bg-yellow-900/8'
                            : isFollowedGame
                              ? 'bg-blue-900/8'
                              : '',
                      isFollowedGame && 'border-l-2 border-l-blue-500'
                    )}
                  >
                    <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap">
                      {game.scheduled_time}
                      {hasConflict && (
                        <span
                          className={cn(
                            'ml-1.5 text-[9px] font-cond font-black',
                            conflict?.severity === 'critical'
                              ? 'text-red-400'
                              : conflict?.severity === 'warning'
                                ? 'text-yellow-400'
                                : 'text-blue-300'
                          )}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="font-cond font-bold px-3 py-2">
                      {game.field?.name ?? `F${game.field_id}`}
                    </td>
                    <td className="font-cond font-bold text-white px-3 py-2">
                      {followedSet.has(game.home_team_id) && (
                        <Star size={9} className="inline mr-1 text-yellow-400 fill-yellow-400" />
                      )}
                      {game.home_team?.name ?? '?'}
                    </td>
                    <td className="font-cond font-bold text-white px-3 py-2">
                      {followedSet.has(game.away_team_id) && (
                        <Star size={9} className="inline mr-1 text-yellow-400 fill-yellow-400" />
                      )}
                      {game.away_team?.name ?? '?'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                        {game.division}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={game.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {['Live', 'Halftime', 'Final'].includes(game.status) ? (
                        <span className="text-green-400">
                          {game.home_score}–{game.away_score}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 items-center">
                        {game.status !== 'Final' && (
                          <button
                            onClick={() => cycleStatus(game.id, game.status)}
                            className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-navy hover:bg-navy-light text-white transition-colors"
                          >
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
        <ScheduleBoardView
          fieldColumns={fieldColumns}
          conflicts={conflicts}
          conflictGameIds={conflictGameIds}
          onCycleStatus={cycleStatus}
          onRescheduled={loadConflicts}
          followedSet={followedSet}
        />
      )}

      {/* Add game modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="ADD GAME"
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
              CANCEL
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleAddGame}>
              ADD GAME
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Field">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agField}
              onChange={(e) => setAgField(e.target.value)}
            >
              <option value="">Select field…</option>
              {state.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Time">
            <input
              type="time"
              value={agTime}
              onChange={(e) => setAgTime(e.target.value)}
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
            />
          </FormField>
          <FormField label="Division">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agDiv}
              onChange={(e) => setAgDiv(e.target.value)}
            >
              <option value="">Select division…</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>
          <div />
          <FormField label="Home Team">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agHome}
              onChange={(e) => setAgHome(e.target.value)}
            >
              <option value="">Select team…</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.division})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Away Team">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agAway}
              onChange={(e) => setAgAway(e.target.value)}
            >
              <option value="">Select team…</option>
              {state.teams
                .filter((t) => String(t.id) !== agHome)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.division})
                  </option>
                ))}
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Generate schedule confirmation modal */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="GENERATE SCHEDULE"
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setGenOpen(false)}>
              CANCEL
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleGenerateSchedule} disabled={generating}>
              {generating ? 'GENERATING...' : 'GENERATE'}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-muted">
            This will auto-generate a round-robin schedule for all divisions.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-navy/40 rounded-lg p-3">
              <div className="font-cond font-black text-xl text-white">{state.teams.length}</div>
              <div className="font-cond text-[10px] text-muted tracking-wide">TEAMS</div>
            </div>
            <div className="bg-navy/40 rounded-lg p-3">
              <div className="font-cond font-black text-xl text-white">{state.fields.length}</div>
              <div className="font-cond text-[10px] text-muted tracking-wide">FIELDS</div>
            </div>
            <div className="bg-navy/40 rounded-lg p-3">
              <div className="font-cond font-black text-xl text-white">{divisions.length}</div>
              <div className="font-cond text-[10px] text-muted tracking-wide">DIVISIONS</div>
            </div>
          </div>
          {state.games.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-3 py-2 text-[12px] text-yellow-300 flex items-center gap-2">
              <AlertTriangle size={14} />
              {state.games.length} existing games will not be removed. New games will be added alongside them.
            </div>
          )}
          <p className="text-[11px] text-muted">
            Games are generated using round-robin within each division and assigned to available time slots across all event dates and fields.
          </p>
        </div>
      </Modal>

      {/* Schedule CSV Preview Modal */}
      {scheduleCsvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-cond font-black text-[14px] text-white tracking-wider">
                IMPORT SCHEDULE — {scheduleCsvPreview.rows.length} game{scheduleCsvPreview.rows.length !== 1 ? 's' : ''}
              </div>
              <button onClick={() => setScheduleCsvPreview(null)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>

            {scheduleCsvPreview.warnings.length > 0 && (
              <div className="px-5 py-2 bg-yellow-900/20 border-b border-yellow-800/30">
                <div className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-yellow-400 mb-1">
                  <AlertTriangle size={12} /> WARNINGS
                </div>
                {scheduleCsvPreview.warnings.map((w, i) => (
                  <div key={i} className="font-cond text-[11px] text-yellow-300/80">{w}</div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-cond font-bold text-muted text-left py-1.5 pr-3">#</th>
                    {Object.keys(scheduleCsvPreview.rows[0] || {}).map(col => (
                      <th key={col} className="font-cond font-bold text-muted text-left py-1.5 pr-3">
                        {col.toUpperCase().replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleCsvPreview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-navy/20">
                      <td className="font-cond text-muted py-1.5 pr-3">{i + 1}</td>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="font-cond text-white py-1.5 pr-3">{val || <span className="text-muted italic">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="font-cond text-[11px] text-muted">
                {scheduleCsvPreview.rows.length} game{scheduleCsvPreview.rows.length !== 1 ? 's' : ''} will be imported into the current event date
              </span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setScheduleCsvPreview(null)}>CANCEL</Btn>
                <Btn size="sm" variant="success" onClick={importScheduleCSV} disabled={importingSchedule}>
                  {importingSchedule ? 'IMPORTING...' : `IMPORT ${scheduleCsvPreview.rows.length} GAME${scheduleCsvPreview.rows.length !== 1 ? 'S' : ''}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quick reschedule button ─────────────────────────────────
function QuickRescheduleBtn({ game, onRescheduled }: { game: any; onRescheduled: () => void }) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('')
  const [field, setField] = useState('')
  const { state, eventId } = useApp()

  async function save() {
    const sb = createClient()
    const updates: any = {}
    if (time) {
      const [h, m] = time.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
      updates.scheduled_time = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
    }
    if (field) updates.field_id = Number(field)
    if (Object.keys(updates).length === 0) {
      setOpen(false)
      return
    }

    await sb.from('games').update(updates).eq('id', game.id)
    await fetch('/api/ops-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        message: `Game #${game.id} rescheduled: ${Object.entries(updates)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
        log_type: 'ok',
      }),
    })
    toast.success(`Game #${game.id} updated`)
    setOpen(false)
    onRescheduled()
    window.location.reload()
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-surface-card border border-border text-muted hover:text-white hover:border-blue-400 transition-colors"
        title="Reschedule"
      >
        <MoveHorizontal size={10} />
      </button>
    )

  return (
    <div className="flex items-center gap-1">
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="bg-surface border border-border text-white px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-blue-400 w-24"
      />
      <select
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="bg-surface border border-border text-white px-1 py-0.5 rounded text-[10px] outline-none focus:border-blue-400 w-20"
      >
        <option value="">Field…</option>
        {state.fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        className="font-cond text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-700 text-white"
      >
        ✓
      </button>
      <button
        onClick={() => setOpen(false)}
        className="font-cond text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-card border border-border text-muted"
      >
        ✕
      </button>
    </div>
  )
}

// ─── Conflict row with resolution buttons ────────────────────
function ConflictRow({
  conflict,
  onResolve,
  onApply,
  applying,
}: {
  conflict: FieldConflict
  onResolve: () => void
  onApply: (action: string, params: Record<string, unknown>) => void
  applying: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const styles = {
    critical: {
      border: 'border-l-red-500',
      bg: 'bg-red-900/10',
      text: 'text-red-400',
      icon: <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />,
    },
    warning: {
      border: 'border-l-yellow-500',
      bg: 'bg-yellow-900/10',
      text: 'text-yellow-400',
      icon: <AlertTriangle size={12} className="text-yellow-400 shrink-0 mt-0.5" />,
    },
    info: {
      border: 'border-l-blue-400',
      bg: 'bg-blue-900/10',
      text: 'text-blue-300',
      icon: <Shield size={12} className="text-blue-300 shrink-0 mt-0.5" />,
    },
  }[conflict.severity]

  const TYPE_LABELS: Record<string, string> = {
    field_overlap: 'FIELD OVERLAP',
    field_blocked: 'FIELD BLOCKED',
    schedule_cascade: 'CASCADE DELAY',
    missing_referee: 'MISSING REF',
  }

  return (
    <div className={cn('border-l-4 rounded p-2.5', styles.border, styles.bg)}>
      <div className="flex items-start gap-2">
        {styles.icon}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className={cn('font-cond font-black text-[10px] tracking-widest', styles.text)}>
              {TYPE_LABELS[conflict.conflict_type] ??
                conflict.conflict_type.replace(/_/g, ' ').toUpperCase()}
            </span>
            <div className="flex items-center gap-1">
              {conflict.impacted_game_ids?.map((id) => (
                <span
                  key={id}
                  className="font-cond text-[9px] font-bold bg-white/10 text-muted px-1.5 py-0.5 rounded"
                >
                  #{id}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-gray-200 leading-snug">{conflict.description}</div>

          {/* Resolution options */}
          {conflict.resolution_options?.length > 0 && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="font-cond text-[9px] font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1"
              >
                <ChevronRight
                  size={10}
                  className={cn('transition-transform', expanded && 'rotate-90')}
                />
                {expanded ? 'HIDE FIXES' : `${conflict.resolution_options.length} QUICK FIXES`}
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {conflict.resolution_options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={applying}
                      onClick={() => onApply(opt.action, opt.params ?? {})}
                      className="font-cond text-[9px] font-bold tracking-wide px-2 py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors disabled:opacity-50"
                    >
                      {applying ? '...' : opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onResolve}
          className="shrink-0 font-cond text-[9px] font-bold px-2 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors whitespace-nowrap ml-1"
        >
          DISMISS
        </button>
      </div>
    </div>
  )
}

// ─── Rich Schedule Board View ────────────────────────────────
function ScheduleBoardView({
  fieldColumns,
  conflicts,
  conflictGameIds,
  onCycleStatus,
  onRescheduled,
  followedSet,
}: {
  fieldColumns: Array<{ field: any; games: any[] }>
  conflicts: any[]
  conflictGameIds: Set<number>
  onCycleStatus: (id: number, status: GameStatus) => void
  onRescheduled: () => void
  followedSet: Set<number>
}) {
  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="flex gap-3"
        style={{ minWidth: `${Math.max(fieldColumns.length * 230, 600)}px` }}
      >
        {fieldColumns.map(({ field, games }) => {
          const liveCount = games.filter(
            (g) => g.status === 'Live' || g.status === 'Halftime'
          ).length
          const delayedCount = games.filter((g) => g.status === 'Delayed').length
          const finalCount = games.filter((g) => g.status === 'Final').length
          const conflictCount = games.filter((g) => conflictGameIds.has(g.id)).length

          return (
            <div key={field.id} className="flex-shrink-0" style={{ width: 220 }}>
              {/* Field column header */}
              <div
                className={cn(
                  'rounded-lg border-2 mb-3 overflow-hidden',
                  liveCount > 0
                    ? 'border-green-600/60'
                    : delayedCount > 0
                      ? 'border-red-600/60'
                      : conflictCount > 0
                        ? 'border-yellow-600/50'
                        : 'border-border'
                )}
              >
                <div
                  className={cn(
                    'px-3 py-2.5',
                    liveCount > 0
                      ? 'bg-green-900/30'
                      : delayedCount > 0
                        ? 'bg-red-900/20'
                        : 'bg-navy'
                  )}
                >
                  <div className="font-cond font-black text-[15px] tracking-wide text-white">
                    {field.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-cond text-[10px] text-muted">{games.length} games</span>
                    {liveCount > 0 && (
                      <span className="font-cond text-[9px] font-bold text-green-400 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                        {liveCount} LIVE
                      </span>
                    )}
                    {delayedCount > 0 && (
                      <span className="font-cond text-[9px] font-bold text-red-400">
                        ⚡ {delayedCount} DELAYED
                      </span>
                    )}
                    {conflictCount > 0 && (
                      <span className="font-cond text-[9px] font-bold text-yellow-400">
                        ⚠ {conflictCount}
                      </span>
                    )}
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="flex h-1">
                  {finalCount > 0 && (
                    <div
                      className="bg-gray-600"
                      style={{ width: `${(finalCount / games.length) * 100}%` }}
                    />
                  )}
                  {liveCount > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(liveCount / games.length) * 100}%` }}
                    />
                  )}
                  {delayedCount > 0 && (
                    <div
                      className="bg-red-500"
                      style={{ width: `${(delayedCount / games.length) * 100}%` }}
                    />
                  )}
                  <div className="bg-blue-700 flex-1" />
                </div>
              </div>

              {/* Game cards */}
              <div className="space-y-2">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    hasConflict={conflictGameIds.has(game.id)}
                    conflict={conflicts.find((c) => c.impacted_game_ids?.includes(game.id))}
                    onCycleStatus={onCycleStatus}
                    onRescheduled={onRescheduled}
                    followedSet={followedSet}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Individual Game Card ─────────────────────────────────────
function GameCard({
  game,
  hasConflict,
  conflict,
  onCycleStatus,
  onRescheduled,
  followedSet,
}: {
  game: any
  hasConflict: boolean
  conflict: any
  onCycleStatus: (id: number, status: GameStatus) => void
  onRescheduled: () => void
  followedSet: Set<number>
}) {
  const [expanded, setExpanded] = useState(false)
  const isLive = game.status === 'Live' || game.status === 'Halftime'
  const isFinal = game.status === 'Final'
  const isDelayed = game.status === 'Delayed'
  const isStarting = game.status === 'Starting'
  const isFollowedGame =
    followedSet.size > 0 &&
    (followedSet.has(game.home_team_id) || followedSet.has(game.away_team_id))

  const borderColor =
    hasConflict && conflict?.severity === 'critical'
      ? 'border-red-600/70'
      : hasConflict
        ? 'border-yellow-600/60'
        : isLive
          ? 'border-green-600/60'
          : isDelayed
            ? 'border-red-600/50'
            : isStarting
              ? 'border-orange-500/60'
              : isFinal
                ? 'border-border/40'
                : isFollowedGame
                  ? 'border-blue-500/60'
                  : 'border-border'

  const bgColor = isLive
    ? 'bg-green-900/10'
    : isDelayed
      ? 'bg-red-900/10'
      : isFinal
        ? 'bg-surface-card/50'
        : isFollowedGame
          ? 'bg-blue-900/10'
          : 'bg-surface-card'

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        borderColor,
        bgColor,
        isFinal && 'opacity-75'
      )}
    >
      {/* Card header — time + status */}
      <div
        className={cn(
          'px-3 py-2 flex justify-between items-center border-b border-border/50',
          isLive
            ? 'bg-green-900/20'
            : isDelayed
              ? 'bg-red-900/20'
              : isStarting
                ? 'bg-orange-900/20'
                : 'bg-navy/50'
        )}
      >
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          )}
          <span className="font-mono text-[11px] font-bold text-blue-300">
            {game.scheduled_time}
          </span>
          <span className="font-cond text-[9px] font-bold text-muted">#{game.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasConflict && (
            <span
              className={cn(
                'font-cond text-[9px] font-black',
                conflict?.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
              )}
            >
              ⚠
            </span>
          )}
          <span
            className={cn(
              'font-cond text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded',
              game.status === 'Live'
                ? 'badge-live'
                : game.status === 'Final'
                  ? 'badge-final'
                  : game.status === 'Delayed'
                    ? 'badge-delayed'
                    : game.status === 'Halftime'
                      ? 'badge-halftime'
                      : game.status === 'Starting'
                        ? 'badge-starting'
                        : 'badge-scheduled'
            )}
          >
            {game.status === 'Halftime' ? 'HALF' : game.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Matchup */}
      <div className="px-3 py-2.5">
        {/* Score display for live/final games */}
        {isLive || isFinal ? (
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-cond font-black text-[13px] leading-tight truncate">
                {followedSet.has(game.home_team_id) && (
                  <Star size={9} className="inline mr-1 text-yellow-400 fill-yellow-400" />
                )}
                {game.home_team?.name ?? '?'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
              <span
                className={cn(
                  'font-mono text-[18px] font-bold',
                  isFinal ? 'text-muted' : 'text-green-400'
                )}
              >
                {game.home_score}
              </span>
              <span className="text-muted text-[12px]">–</span>
              <span
                className={cn(
                  'font-mono text-[18px] font-bold',
                  isFinal ? 'text-muted' : 'text-green-400'
                )}
              >
                {game.away_score}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="font-cond font-black text-[13px] leading-tight truncate">
                {game.away_team?.name ?? '?'}
                {followedSet.has(game.away_team_id) && (
                  <Star size={9} className="inline ml-1 text-yellow-400 fill-yellow-400" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <div className="font-cond font-black text-[13px] leading-tight mb-0.5">
              {followedSet.has(game.home_team_id) && (
                <Star size={9} className="inline mr-1 text-yellow-400 fill-yellow-400" />
              )}
              {game.home_team?.name ?? '?'}
            </div>
            <div className="font-cond text-[10px] text-muted mb-0.5">vs</div>
            <div className="font-cond font-black text-[13px] leading-tight">
              {followedSet.has(game.away_team_id) && (
                <Star size={9} className="inline mr-1 text-yellow-400 fill-yellow-400" />
              )}
              {game.away_team?.name ?? '?'}
            </div>
          </div>
        )}

        {/* Division */}
        <div className="mb-2">
          <span className="font-cond text-[9px] font-bold bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
            {game.division}
          </span>
        </div>

        {/* Conflict detail */}
        {hasConflict && conflict && (
          <div
            className={cn(
              'text-[9px] font-cond font-bold px-2 py-1 rounded mb-2',
              conflict.severity === 'critical'
                ? 'bg-red-900/30 text-red-300'
                : 'bg-yellow-900/30 text-yellow-300'
            )}
          >
            ⚠ {conflict.conflict_type?.replace(/_/g, ' ').toUpperCase()}
          </div>
        )}

        {/* Action buttons */}
        {!isFinal && (
          <div className="flex gap-1">
            <button
              onClick={() => onCycleStatus(game.id, game.status)}
              className={cn(
                'flex-1 font-cond text-[10px] font-bold tracking-wider py-1 rounded transition-colors',
                isLive
                  ? 'bg-yellow-900/40 hover:bg-yellow-900/60 text-yellow-300 border border-yellow-800/40'
                  : isDelayed
                    ? 'bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-800/40'
                    : isStarting
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-navy hover:bg-navy-light text-white'
              )}
            >
              {nextStatusLabel(game.status)}
            </button>
            <QuickRescheduleBtn game={game} onRescheduled={onRescheduled} />
          </div>
        )}
      </div>
    </div>
  )
}
