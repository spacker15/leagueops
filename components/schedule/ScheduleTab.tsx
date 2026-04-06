'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { StatusBadge, Modal, Btn, FormField, SectionHeader } from '@/components/ui'
import { ScheduleChangeRequestModal } from '@/components/schedule/ScheduleChangeRequestModal'
import {
  cn,
  nextStatusLabel,
  nextGameStatus,
  fuzzyMatch,
  findCsvMismatches,
  type CsvMismatch,
  type FuzzyResult,
} from '@/lib/utils'
import toast from 'react-hot-toast'
import type { GameStatus, OperationalConflict, ScheduleChangeRequest } from '@/types'
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
  Plus,
  CalendarX,
  Trash2,
  CheckSquare,
  Square,
  GitCompareArrows,
  Pencil,
} from 'lucide-react'

type ViewMode = 'table' | 'board'
type TeamFilter = 'all' | 'my-teams'

// Enhanced resolver types for schedule CSV import
type ResolverAction = 'create' | 'map' | 'skip' | null
interface ResolverEntry {
  csvValue: string
  column: string
  action: ResolverAction
  mapToId: string | null // team id when action='map'
  detectedDivision: string | null
  detectedProgram: { id: number; name: string } | null
  suggestions: FuzzyResult[]
}

interface CsvProgram {
  id: number
  name: string
  short_name: string | null
}

// Division prefix map: CSV prefix -> possible division names
const DIV_PREFIX_MAP: Record<string, string[]> = {
  '8u': ['1/2 grade', '8u', '1st/2nd grade'],
  '10u': ['3/4 grade', '10u', '3rd/4th grade'],
  '12u': ['5/6 grade', '12u', '5th/6th grade'],
  '14u': ['7/8 grade', '14u', '7th/8th grade'],
  '6u': ['k/1 grade', '6u', 'kindergarten'],
  '16u': ['9/10 grade', '16u'],
  '18u': ['11/12 grade', '18u'],
}

function parseTeamName(
  name: string,
  programs: CsvProgram[],
  divisionNames: string[]
): { teamName: string; detectedDivision: string | null; detectedProgram: CsvProgram | null } {
  const parts = name.trim()

  // Try to detect division prefix: "8U", "10U", "12U", "14U", etc.
  let detectedDivision: string | null = null
  const divPrefixMatch = parts.match(/^(\d+U)/i)
  if (divPrefixMatch) {
    const prefix = divPrefixMatch[1].toLowerCase()
    const possibleNames = DIV_PREFIX_MAP[prefix] ?? [prefix]
    for (const d of divisionNames) {
      const dLower = d.toLowerCase()
      if (possibleNames.some((p) => dLower.includes(p))) {
        detectedDivision = d
        break
      }
    }
    if (!detectedDivision) detectedDivision = divPrefixMatch[1].toUpperCase()
  }

  // Also try "1/2 Grade", "3/4 Grade" style prefixes
  if (!detectedDivision) {
    const gradeMatch = parts.match(/^(\d+\/\d+\s*Grade)/i)
    if (gradeMatch) {
      const prefix = gradeMatch[1].toLowerCase()
      for (const d of divisionNames) {
        if (d.toLowerCase().includes(prefix)) {
          detectedDivision = d
          break
        }
      }
      if (!detectedDivision) detectedDivision = gradeMatch[1]
    }
  }

  // Try to detect program from name
  let detectedProgram: CsvProgram | null = null
  const partsLower = parts.toLowerCase()
  for (const p of programs) {
    if (partsLower.includes(p.name.toLowerCase())) {
      detectedProgram = p
      break
    }
    if (p.short_name && partsLower.includes(p.short_name.toLowerCase())) {
      detectedProgram = p
      break
    }
  }

  return { teamName: parts, detectedDivision, detectedProgram }
}

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
  const { state, updateGameStatus, addGame, deleteGame, refreshGames, currentDate, eventId } =
    useApp()

  // Logo lookup from state.teams (always current, even after uploads)
  const teamLogoMap = Object.fromEntries(
    (state.teams ?? []).map((t) => [t.id, t.logo_url ?? (t as any).programs?.logo_url ?? null])
  )
  const { userRole } = useAuth()
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
  const [validationResult, setValidationResult] = useState<any>(null)
  const [dryRunning, setDryRunning] = useState(false)
  // Audit log state
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [auditExpanded, setAuditExpanded] = useState(false)
  const [lastRunId, setLastRunId] = useState<string | null>(null)

  // Schedule CSV import state
  const scheduleFileRef = useRef<HTMLInputElement>(null)
  const [scheduleCsvPreview, setScheduleCsvPreview] = useState<{
    rows: Record<string, string>[]
    warnings: string[]
  } | null>(null)
  const [importingSchedule, setImportingSchedule] = useState(false)
  const [csvMismatches, setCsvMismatches] = useState<CsvMismatch[]>([])
  const [csvResolvedMap, setCsvResolvedMap] = useState<Map<string, string>>(new Map())
  // Enhanced resolver state
  const [resolverEntries, setResolverEntries] = useState<ResolverEntry[]>([])
  const [csvPrograms, setCsvPrograms] = useState<CsvProgram[]>([])

  // CSV compare state
  const compareFileRef = useRef<HTMLInputElement>(null)
  const [compareResult, setCompareResult] = useState<{
    matched: number
    missingInApp: { time: string; home: string; away: string; division: string; field: string }[]
    missingInCsv: { time: string; home: string; away: string; division: string; field: string }[]
    differences: {
      time: string
      home: string
      away: string
      csvField: string
      appField: string
      csvDiv: string
      appDiv: string
    }[]
  } | null>(null)

  // Follow teams
  const [followedTeams, setFollowedTeams] = useState<number[]>(loadFollowedTeams)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const followedSet = useMemo(() => new Set(followedTeams), [followedTeams])

  // Schedule Change Request modal state
  const [scrModalOpen, setScrModalOpen] = useState(false)
  const [scrPreSelectedGameId, setScrPreSelectedGameId] = useState<number | undefined>()

  // Bulk select / delete state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Edit game modal state
  const [editGameOpen, setEditGameOpen] = useState(false)
  const [editGame, setEditGame] = useState<any>(null)
  const [editTime, setEditTime] = useState('')
  const [editField, setEditField] = useState('')
  const [editHome, setEditHome] = useState('')
  const [editAway, setEditAway] = useState('')
  const [editDiv, setEditDiv] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [noShowTeam, setNoShowTeam] = useState<'home' | 'away' | null>(null)
  const [noShowPenalty, setNoShowPenalty] = useState('0')
  const [noShowNotes, setNoShowNotes] = useState('')

  function openEditGame(game: any) {
    setEditGame(game)
    // Convert display time (e.g. "9:00 AM") to 24h for input
    const m = (game.scheduled_time || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (m) {
      let h = parseInt(m[1])
      const min = parseInt(m[2])
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
      setEditTime(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
    } else {
      setEditTime('')
    }
    setEditField(String(game.field_id))
    setEditHome(String(game.home_team_id))
    setEditAway(String(game.away_team_id))
    setEditDiv(game.division || '')
    setNoShowTeam(null)
    setNoShowPenalty('0')
    setNoShowNotes('')
    setEditGameOpen(true)
  }

  async function handleEditGameSave() {
    if (!editGame) return
    if (!editField || !editHome || !editAway || editHome === editAway) {
      toast.error('Fill all fields. Home ≠ Away.')
      return
    }
    setEditSaving(true)
    try {
      const sb = createClient()
      const updates: Record<string, unknown> = {}
      if (editTime) {
        const [h, m] = editTime.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
        updates.scheduled_time = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
      }
      if (Number(editField) !== editGame.field_id) updates.field_id = Number(editField)
      if (Number(editHome) !== editGame.home_team_id) updates.home_team_id = Number(editHome)
      if (Number(editAway) !== editGame.away_team_id) updates.away_team_id = Number(editAway)
      if (editDiv !== editGame.division) updates.division = editDiv

      if (Object.keys(updates).length === 0) {
        setEditGameOpen(false)
        return
      }

      const { error } = await sb.from('games').update(updates).eq('id', editGame.id)
      if (error) throw error

      await fetch('/api/ops-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          message: `Game #${editGame.id} edited: ${Object.entries(updates)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`,
          log_type: 'ok',
        }),
      })

      toast.success(`Game #${editGame.id} updated`)
      setEditGameOpen(false)
      await refreshGames()
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleNoShow() {
    if (!editGame || !noShowTeam) return
    const teamId = noShowTeam === 'home' ? editGame.home_team_id : editGame.away_team_id
    const teamName =
      noShowTeam === 'home'
        ? (editGame.home_team?.name ?? 'Home')
        : (editGame.away_team?.name ?? 'Away')
    const penalty = parseInt(noShowPenalty) || 0

    setEditSaving(true)
    try {
      const sb = createClient()

      // Record no-show
      await sb.from('team_no_shows').insert({
        event_id: eventId,
        game_id: editGame.id,
        team_id: teamId,
        penalty_points: penalty,
        notes: noShowNotes || null,
      })

      // Mark game as Final with forfeit score (opponent wins)
      const updates: Record<string, unknown> = { status: 'Final' }
      if (noShowTeam === 'home') {
        updates.home_score = 0
        updates.away_score = 1
        updates.notes = `No-show: ${teamName} (forfeit)`
      } else {
        updates.home_score = 1
        updates.away_score = 0
        updates.notes = `No-show: ${teamName} (forfeit)`
      }
      await sb.from('games').update(updates).eq('id', editGame.id)

      // Log to ops_log
      await fetch('/api/ops-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          message: `NO-SHOW: ${teamName} did not show for Game #${editGame.id}${penalty > 0 ? ` (${penalty} pt penalty)` : ''}${noShowNotes ? ` — ${noShowNotes}` : ''}`,
          log_type: 'alert',
        }),
      })

      toast.success(`${teamName} marked as no-show for Game #${editGame.id}`)
      setEditGameOpen(false)
      await refreshGames()
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`)
    } finally {
      setEditSaving(false)
    }
  }

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
  const [fieldAvailability, setFieldAvailability] = useState<import('@/types').FieldAvailability[]>(
    []
  )

  // Load field availability
  useEffect(() => {
    if (!eventId) return
    import('@/lib/db').then((db) => db.getFieldAvailability(eventId)).then(setFieldAvailability)
  }, [eventId])

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
        body: JSON.stringify({ event_date_id: currentDate.id, event_id: eventId }),
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
    try {
      const res = await fetch('/api/conflicts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setConflicts((prev) => prev.filter((c) => c.id !== id))
        toast.success('Conflict dismissed')
      } else {
        // If DB dismiss fails, just remove from local state
        setConflicts((prev) => prev.filter((c) => c.id !== id))
        toast.success('Conflict dismissed')
      }
    } catch {
      // Fallback: remove from local state even if API fails
      setConflicts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Conflict dismissed')
    }
  }

  async function dismissAllConflicts() {
    const count = conflicts.length
    if (count === 0) return
    try {
      const sb = createClient()
      const ids = conflicts.map((c) => c.id).filter(Boolean)
      if (ids.length > 0) {
        await sb
          .from('operational_conflicts')
          .update({ resolved: true, resolved_at: new Date().toISOString() })
          .in('id', ids)
      }
    } catch {
      // Non-fatal — still clear local state
    }
    setConflicts([])
    toast.success(`${count} conflict${count !== 1 ? 's' : ''} dismissed`)
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

  // Filter games — sort by TIME first (earliest → latest), then FIELD
  const filtered = useMemo(() => {
    let g = [...state.games]
      .filter((x) => x.status !== 'Unscheduled')
      .sort(
        (a, b) =>
          timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time) || a.field_id - b.field_id
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

  // Generate schedule — dry run for validation first
  async function handleDryRun() {
    if (!eventId) return
    setDryRunning(true)
    setValidationResult(null)
    try {
      const res = await fetch('/api/schedule-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, dry_run: true }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Dry run failed')
      setValidationResult(data.validation)
    } catch (err: any) {
      toast.error(`Validation error: ${err.message}`)
    } finally {
      setDryRunning(false)
    }
  }

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
      if (data.auditRunId) setLastRunId(data.auditRunId)
      setGenOpen(false)
      setValidationResult(null)
      await refreshGames()
    } catch (err: any) {
      toast.error(`Schedule error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function loadAuditLog() {
    if (!eventId || !lastRunId) return
    try {
      const res = await fetch(`/api/schedule-audit?event_id=${eventId}&run_id=${lastRunId}`)
      const json = await res.json()
      setAuditLog(json.audit ?? [])
      setAuditExpanded(true)
    } catch {
      toast.error('Failed to load audit log')
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
        if (ch === '"' && text[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') {
          row.push(current.trim())
          current = ''
        } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++
          row.push(current.trim())
          current = ''
          if (row.some((c) => c)) rows.push(row)
          row = []
        } else current += ch
      }
    }
    row.push(current.trim())
    if (row.some((c) => c)) rows.push(row)
    return rows
  }

  async function handleScheduleCSVFile(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) {
        toast.error('CSV must have a header row and at least one data row')
        return
      }

      const rawHeaders = parsed[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'))

      // Flexible header aliases — map common variations to expected names
      const headerAliases: Record<string, string> = {
        date: 'date',
        game_date: 'date',
        day: 'date',
        time: 'time',
        game_time: 'time',
        start_time: 'time',
        start: 'time',
        home_team: 'home_team',
        home: 'home_team',
        team_1: 'home_team',
        team1: 'home_team',
        away_team: 'away_team',
        away: 'away_team',
        visitor: 'away_team',
        team_2: 'away_team',
        team2: 'away_team',
        division: 'division',
        div: 'division',
        grade: 'division',
        age_group: 'division',
        field: 'field',
        field_name: 'field',
        location: 'field',
        venue: 'field',
      }

      const headers = rawHeaders.map((h) => headerAliases[h] ?? h)

      const expectedCols = ['date', 'time', 'home_team', 'away_team', 'division', 'field']
      const rows: Record<string, string>[] = []
      const warnings: string[] = []

      const missing = expectedCols.filter((c) => !headers.includes(c))
      if (missing.length > 0)
        warnings.push(`Missing columns: ${missing.join(', ')}. Found: ${rawHeaders.join(', ')}`)

      for (let i = 1; i < parsed.length; i++) {
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => {
          obj[h] = parsed[i][idx] || ''
        })
        if (!obj.home_team || !obj.away_team) {
          warnings.push(`Row ${i}: missing home_team or away_team — will skip`)
          continue
        }
        if (!obj.time) {
          warnings.push(`Row ${i}: missing time — will skip`)
          continue
        }
        rows.push(obj)
      }

      if (rows.length === 0) {
        toast.error(`No valid rows found in CSV. Headers found: ${rawHeaders.join(', ')}`)
        return
      }

      // Fetch programs for smart detection
      const sb = createClient()
      const { data: progs } = await sb
        .from('programs')
        .select('id, name, short_name')
        .eq('event_id', eventId)
        .order('name')
      const fetchedPrograms: CsvProgram[] = (progs ?? []) as CsvProgram[]
      setCsvPrograms(fetchedPrograms)

      // Get division names from existing teams
      const divisionNames = [...new Set(state.teams.map((t) => t.division).filter(Boolean))]

      // Fuzzy match team names, fields, divisions against existing data
      const teamCandidates = state.teams.map((t) => ({ id: t.id ?? t.name, name: t.name }))
      const fieldCandidates = state.fields.map((f) => ({ id: f.id ?? f.name, name: f.name }))
      const divCandidates = divisionNames.map((d) => ({ id: d, name: d }))

      const homeTeamVals = rows.map((r) => r.home_team).filter(Boolean)
      const awayTeamVals = rows.map((r) => r.away_team).filter(Boolean)
      const fieldVals = rows.map((r) => r.field).filter(Boolean)
      const divVals = rows.map((r) => r.division).filter(Boolean)

      // Field and division mismatches use old system
      const fieldMismatches = findCsvMismatches(fieldVals, fieldCandidates, 'field')
      const divMismatches = findCsvMismatches(divVals, divCandidates, 'division')
      setCsvMismatches([...fieldMismatches, ...divMismatches])

      // Team mismatches use new enhanced resolver
      const allTeamVals = [...new Set([...homeTeamVals, ...awayTeamVals])]
      const teamLowerMap = new Map(state.teams.map((t) => [t.name.toLowerCase().trim(), t]))
      const entries: ResolverEntry[] = []

      for (const val of allTeamVals) {
        const key = val.toLowerCase().trim()
        if (!key) continue
        if (teamLowerMap.has(key)) continue // exact match

        const suggestions = fuzzyMatch(val, teamCandidates)
        const parsed = parseTeamName(val, fetchedPrograms, divisionNames)

        // Auto-approve matches with 80%+ confidence
        const bestMatch = suggestions.length > 0 ? suggestions[0] : null
        const autoApproved = bestMatch && bestMatch.score >= 0.8

        entries.push({
          csvValue: val,
          column: 'team',
          action: autoApproved ? 'map' : null,
          mapToId: autoApproved ? String(bestMatch.id) : null,
          detectedDivision: parsed.detectedDivision,
          detectedProgram: parsed.detectedProgram,
          suggestions,
        })
      }

      setResolverEntries(entries)
      setCsvResolvedMap(new Map())
      setScheduleCsvPreview({ rows, warnings })
    }
    reader.readAsText(file)
  }

  // Resolver entry actions
  function setResolverAction(idx: number, action: ResolverAction, mapToId?: string) {
    setResolverEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, action, mapToId: action === 'map' ? (mapToId ?? e.mapToId) : null } : e
      )
    )
  }

  function setResolverMapId(idx: number, mapToId: string) {
    setResolverEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, action: 'map', mapToId } : e))
    )
  }

  function setResolverDivision(idx: number, division: string) {
    setResolverEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, detectedDivision: division } : e))
    )
  }

  function setResolverProgram(idx: number, programId: string) {
    setResolverEntries((prev) =>
      prev.map((e, i) => {
        const prog = csvPrograms.find((p) => String(p.id) === programId) ?? null
        return i === idx ? { ...e, detectedProgram: prog } : e
      })
    )
  }

  // Bulk actions
  function bulkAutoCreateAll() {
    setResolverEntries((prev) => prev.map((e) => ({ ...e, action: 'create' as ResolverAction })))
  }

  function bulkSkipAll() {
    setResolverEntries((prev) => prev.map((e) => ({ ...e, action: 'skip' as ResolverAction })))
  }

  function bulkBestMatchAll() {
    setResolverEntries((prev) =>
      prev.map((e) => {
        if (e.suggestions.length > 0) {
          return { ...e, action: 'map' as ResolverAction, mapToId: String(e.suggestions[0].id) }
        }
        return { ...e, action: 'create' as ResolverAction }
      })
    )
  }

  // Old mismatch resolver for fields/divisions
  function resolveCsvMismatch(idx: number, value: string) {
    setCsvMismatches((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, resolvedTo: value || null } : m))
    )
  }

  const unresolvedOldMismatches = csvMismatches.filter((m) => m.resolvedTo === null)
  const unresolvedTeamEntries = resolverEntries.filter((e) => e.action === null)
  const resolvedTeamCount = resolverEntries.filter((e) => e.action !== null).length
  const skippedCsvValues = new Set([
    ...csvMismatches
      .filter((m) => m.resolvedTo === '__skip__')
      .map((m) => m.csvValue.toLowerCase().trim()),
    ...resolverEntries
      .filter((e) => e.action === 'skip')
      .map((e) => e.csvValue.toLowerCase().trim()),
  ])
  const teamsToCreate = resolverEntries.filter((e) => e.action === 'create')
  const hasUnresolved = unresolvedOldMismatches.length > 0 || unresolvedTeamEntries.length > 0

  async function importScheduleCSV() {
    if (!scheduleCsvPreview) return
    if (hasUnresolved) {
      toast.error('Resolve all mismatches before importing')
      return
    }
    setImportingSchedule(true)
    const sb = createClient()

    try {
      // 1. Create new teams first
      const newTeamLookup = new Map<string, number>()
      if (teamsToCreate.length > 0) {
        // Insert one at a time to handle potential duplicates gracefully
        for (const e of teamsToCreate) {
          const { data: existing } = await sb
            .from('teams')
            .select('id')
            .eq('event_id', eventId!)
            .ilike('name', e.csvValue.trim())
            .limit(1)

          if (existing && existing.length > 0) {
            newTeamLookup.set(e.csvValue.toLowerCase().trim(), existing[0].id)
            continue
          }

          const { data: created, error: createErr } = await sb
            .from('teams')
            .insert({
              event_id: eventId,
              name: e.csvValue.trim(),
              division: e.detectedDivision || '',
              program_id: e.detectedProgram?.id ?? null,
              color: '#0B3D91',
            })
            .select('id, name')
            .single()

          if (createErr) {
            console.warn(`Failed to create team "${e.csvValue}": ${createErr.message}`)
            continue
          }
          if (created) {
            newTeamLookup.set(e.csvValue.toLowerCase().trim(), created.id)
          }
        }
        if (newTeamLookup.size > 0) {
          toast.success(`${newTeamLookup.size} team${newTeamLookup.size !== 1 ? 's' : ''} created`)
        }
      }

      // 2. Reload teams to include newly created ones
      const { data: freshTeams } = await sb
        .from('teams')
        .select('id, name, division')
        .eq('event_id', eventId!)

      const teamMap = new Map<string, { id: number; name: string; division: string }>()
      for (const t of freshTeams ?? []) {
        teamMap.set(t.name.toLowerCase().trim(), t)
      }

      // Also add newly created teams
      for (const [key, id] of newTeamLookup) {
        if (!teamMap.has(key)) {
          teamMap.set(key, { id, name: key, division: '' })
        }
      }

      const fieldMap = new Map(state.fields.map((f) => [f.name.toLowerCase().trim(), f]))
      const fieldIdMap = new Map(state.fields.map((f) => [String(f.id), f]))

      // Build resolved field/div name map from old-style mismatches
      const resolvedNameMap = new Map<string, string>()
      for (const m of csvMismatches) {
        if (m.resolvedTo && m.resolvedTo !== '__skip__') {
          resolvedNameMap.set(m.csvValue.toLowerCase().trim(), m.resolvedTo)
        }
      }

      // Build team resolver map: csvValue -> team id
      const resolvedTeamMap = new Map<string, number>()
      for (const e of resolverEntries) {
        if (e.action === 'map' && e.mapToId) {
          resolvedTeamMap.set(e.csvValue.toLowerCase().trim(), Number(e.mapToId))
        } else if (e.action === 'create') {
          const created = newTeamLookup.get(e.csvValue.toLowerCase().trim())
          if (created) resolvedTeamMap.set(e.csvValue.toLowerCase().trim(), created)
        }
      }

      // Collect unique dates from CSV and auto-create missing event_dates
      const csvDates = new Set<string>()
      for (const row of scheduleCsvPreview.rows) {
        if (row.date) {
          const raw = row.date.trim()
          // Normalize to ISO format (YYYY-MM-DD)
          let iso = raw
          // Handle M/D/YYYY or MM/DD/YYYY
          const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          if (slashMatch) {
            iso = `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`
          }
          // Handle other parseable formats
          if (!iso.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parsed = new Date(raw)
            if (!isNaN(parsed.getTime())) {
              iso = parsed.toISOString().split('T')[0]
            }
          }
          if (iso.match(/^\d{4}-\d{2}-\d{2}$/)) {
            csvDates.add(iso)
          }
        }
      }

      // Check which dates already exist
      const { data: existingDates } = await sb
        .from('event_dates')
        .select('id, date')
        .eq('event_id', eventId!)

      const existingDateSet = new Set((existingDates ?? []).map((d) => d.date))
      const datesToCreate = [...csvDates].filter((d) => !existingDateSet.has(d)).sort()

      if (datesToCreate.length > 0) {
        const inserts = datesToCreate.map((d, i) => ({
          event_id: eventId!,
          date: d,
          label: `Game Day`,
          day_number: (existingDates?.length ?? 0) + i + 1,
        }))
        await sb.from('event_dates').insert(inserts)
        toast.success(
          `${datesToCreate.length} event date${datesToCreate.length !== 1 ? 's' : ''} created`
        )
      }

      // Build event_date map for date matching (reload after potential inserts)
      const { data: eventDates } = await sb
        .from('event_dates')
        .select('id, date')
        .eq('event_id', eventId!)
        .order('date')

      const dateMap = new Map<string, number>()
      for (const ed of eventDates ?? []) {
        dateMap.set(ed.date, ed.id)
        // Also map common formats
        const d = new Date(ed.date + 'T12:00:00')
        dateMap.set(`${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`, ed.id)
        dateMap.set(
          `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`,
          ed.id
        )
      }

      const gamesToInsert: any[] = []
      const errors: string[] = []
      let gamesSkipped = 0

      for (let i = 0; i < scheduleCsvPreview.rows.length; i++) {
        const row = scheduleCsvPreview.rows[i]

        // Skip rows with skipped values
        if (
          skippedCsvValues.has(row.home_team?.toLowerCase().trim()) ||
          skippedCsvValues.has(row.away_team?.toLowerCase().trim())
        ) {
          gamesSkipped++
          continue
        }

        // Resolve team names
        const homeKey = (row.home_team || '').toLowerCase().trim()
        const awayKey = (row.away_team || '').toLowerCase().trim()

        const homeTeamId = resolvedTeamMap.get(homeKey) ?? teamMap.get(homeKey)?.id ?? null
        const awayTeamId = resolvedTeamMap.get(awayKey) ?? teamMap.get(awayKey)?.id ?? null

        const fieldKey = (row.field || '').toLowerCase().trim()
        const resolvedFieldId = resolvedNameMap.get(fieldKey)
        const field = resolvedFieldId ? fieldIdMap.get(resolvedFieldId) : fieldMap.get(fieldKey)

        if (!homeTeamId) {
          errors.push(`Row ${i + 1}: home team "${row.home_team}" not found`)
          continue
        }
        if (!awayTeamId) {
          errors.push(`Row ${i + 1}: away team "${row.away_team}" not found`)
          continue
        }

        // Match date to event_date
        let eventDateId = currentDate?.id
        if (row.date) {
          const dateKey = row.date.trim()
          const matched = dateMap.get(dateKey)
          if (matched) {
            eventDateId = matched
          } else {
            // Try parsing as a date and matching
            const parsed = new Date(dateKey)
            if (!isNaN(parsed.getTime())) {
              const isoDate = parsed.toISOString().split('T')[0]
              const matchedIso = dateMap.get(isoDate)
              if (matchedIso) eventDateId = matchedIso
            }
          }
        }

        if (!eventDateId) {
          errors.push(`Row ${i + 1}: no matching event date for "${row.date}"`)
          continue
        }

        // Parse time to display format
        let timeStr = row.time || ''
        const tm24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
        if (tm24) {
          const h = parseInt(tm24[1])
          const m = parseInt(tm24[2])
          const ampm = h >= 12 ? 'PM' : 'AM'
          const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
          timeStr = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
        }

        // Resolve division: use CSV value mapped through mismatch resolver, or fall back to team's division
        let resolvedDiv = ''
        if (row.division) {
          const divKey = row.division.toLowerCase().trim()
          const mappedDiv = resolvedNameMap.get(divKey)
          if (mappedDiv) {
            resolvedDiv = mappedDiv
          } else {
            // Try to match CSV division to an existing division name
            const existingDivs = [
              ...new Set((freshTeams ?? []).map((t) => t.division).filter(Boolean)),
            ]
            const exactDiv = existingDivs.find((d) => d.toLowerCase().trim() === divKey)
            if (exactDiv) {
              resolvedDiv = exactDiv
            } else {
              // Try DIV_PREFIX_MAP to resolve e.g. "8U" -> "1/2 Grade"
              const prefixMatch = row.division.match(/^(\d+U)/i)
              if (prefixMatch) {
                const prefix = prefixMatch[1].toLowerCase()
                const possibleNames = DIV_PREFIX_MAP[prefix] ?? [prefix]
                for (const d of existingDivs) {
                  const dLower = d.toLowerCase()
                  if (possibleNames.some((p) => dLower.includes(p))) {
                    resolvedDiv = d
                    break
                  }
                }
              }
              if (!resolvedDiv) resolvedDiv = row.division
            }
          }
        }
        if (!resolvedDiv) {
          resolvedDiv = teamMap.get(homeKey)?.division || teamMap.get(awayKey)?.division || ''
        }

        // Resolve team IDs to the correct division — prevent cross-division mismatches
        let finalHomeId = homeTeamId
        let finalAwayId = awayTeamId
        if (resolvedDiv) {
          // Helper: find the correct team in the target division
          // First try exact name match, then try matching by color suffix (e.g. "Riptide Black" → "8U Riptide Black")
          function findTeamInDiv(teamId: number): number {
            const team = (freshTeams ?? []).find((t) => t.id === teamId)
            if (!team || team.division === resolvedDiv) return teamId
            // Exact name match in target division
            const exact = (freshTeams ?? []).find(
              (t) => t.name === team.name && t.division === resolvedDiv
            )
            if (exact) return exact.id
            // Strip age prefix (8U/10U/12U) and match by suffix
            const stripPrefix = (n: string) =>
              n
                .replace(/^\d+U\s*/i, '')
                .toLowerCase()
                .trim()
            const suffix = stripPrefix(team.name)
            if (suffix) {
              const bySuffix = (freshTeams ?? []).find(
                (t) => t.division === resolvedDiv && stripPrefix(t.name) === suffix
              )
              if (bySuffix) return bySuffix.id
            }
            return teamId
          }
          finalHomeId = findTeamInDiv(homeTeamId)
          finalAwayId = findTeamInDiv(awayTeamId)
        }

        gamesToInsert.push({
          event_id: eventId,
          event_date_id: eventDateId,
          field_id: field?.id ?? state.fields[0]?.id,
          home_team_id: finalHomeId,
          away_team_id: finalAwayId,
          division: resolvedDiv,
          scheduled_time: timeStr,
          status: 'Scheduled',
          home_score: 0,
          away_score: 0,
        })
      }

      // Final safety pass: fix any remaining cross-division team references
      const teamById = new Map((freshTeams ?? []).map((t) => [t.id, t]))
      const stripAgePrefix = (n: string) =>
        n
          .replace(/^\d+U\s*/i, '')
          .toLowerCase()
          .trim()
      for (const game of gamesToInsert) {
        const div = game.division
        if (!div) continue
        for (const key of ['home_team_id', 'away_team_id'] as const) {
          const team = teamById.get(game[key])
          if (team && team.division !== div) {
            // Try exact name match first
            const exact = (freshTeams ?? []).find((t) => t.name === team.name && t.division === div)
            if (exact) {
              game[key] = exact.id
            } else {
              // Try suffix match (strip 8U/10U/12U prefix)
              const suffix = stripAgePrefix(team.name)
              if (suffix) {
                const match = (freshTeams ?? []).find(
                  (t) => t.division === div && stripAgePrefix(t.name) === suffix
                )
                if (match) game[key] = match.id
              }
            }
          }
        }
      }

      // Deduplicate: remove games that already exist (same date, time, home, away)
      let duplicatesSkipped = 0
      if (gamesToInsert.length > 0) {
        const { data: existingGames } = await sb
          .from('games')
          .select('event_date_id, scheduled_time, home_team_id, away_team_id')
          .eq('event_id', eventId!)

        const existingSet = new Set(
          (existingGames ?? []).map(
            (g) => `${g.event_date_id}|${g.scheduled_time}|${g.home_team_id}|${g.away_team_id}`
          )
        )

        const deduped = gamesToInsert.filter((g) => {
          const key = `${g.event_date_id}|${g.scheduled_time}|${g.home_team_id}|${g.away_team_id}`
          if (existingSet.has(key)) {
            duplicatesSkipped++
            return false
          }
          return true
        })

        // Batch insert games
        if (deduped.length > 0) {
          const { error: insertErr, data: inserted } = await sb
            .from('games')
            .insert(deduped)
            .select('id')

          if (insertErr) {
            toast.error(`Import failed: ${insertErr.message}`)
          } else {
            const parts: string[] = [
              `${inserted?.length ?? deduped.length} game${deduped.length !== 1 ? 's' : ''} imported`,
            ]
            if (gamesSkipped) parts.push(`${gamesSkipped} skipped`)
            if (duplicatesSkipped)
              parts.push(
                `${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} ignored`
              )
            toast.success(parts.join(', '))
          }
        } else {
          const parts: string[] = ['No new games to import']
          if (duplicatesSkipped)
            parts.push(
              `${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} already exist`
            )
          if (gamesSkipped) parts.push(`${gamesSkipped} skipped`)
          toast(parts.join(' — '))
        }
      }

      if (errors.length > 0) {
        toast.error(
          `${errors.length} row${errors.length !== 1 ? 's' : ''} had errors — check console`
        )
        console.warn('Schedule import errors:', errors)
      }

      setScheduleCsvPreview(null)
      setCsvMismatches([])
      setResolverEntries([])
      await refreshGames()
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    }
    setImportingSchedule(false)
  }

  function exportScheduleCSV() {
    const headers = [
      'date',
      'time',
      'home_team',
      'away_team',
      'division',
      'field',
      'status',
      'home_score',
      'away_score',
    ]
    const csvRows = [headers.join(',')]
    for (const g of filtered) {
      const homeName = g.home_team?.name ?? ''
      const awayName = g.away_team?.name ?? ''
      const fieldName = g.field?.name ?? ''
      const dateStr = currentDate?.date ?? ''
      csvRows.push(
        [
          `"${dateStr}"`,
          `"${g.scheduled_time}"`,
          `"${homeName.replace(/"/g, '""')}"`,
          `"${awayName.replace(/"/g, '""')}"`,
          `"${g.division}"`,
          `"${fieldName.replace(/"/g, '""')}"`,
          `"${g.status}"`,
          `"${g.home_score ?? 0}"`,
          `"${g.away_score ?? 0}"`,
        ].join(',')
      )
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadScheduleTemplate() {
    const csv =
      'date,time,home_team,away_team,division,field\n2026-03-22,08:00,Metro FC Blue,City SC Red,U12 Boys,Field 1'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schedule_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCompareCSV(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) return

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
      const timeIdx = headers.findIndex((h) => h === 'time')
      const homeIdx = headers.findIndex((h) => h.includes('home'))
      const awayIdx = headers.findIndex((h) => h.includes('away'))
      const divIdx = headers.findIndex((h) => h.includes('div'))
      const fieldIdx = headers.findIndex((h) => h.includes('field'))

      if (timeIdx < 0 || homeIdx < 0 || awayIdx < 0) {
        toast.error('CSV must have time, home_team, away_team columns')
        return
      }

      // Parse CSV rows
      function parseCSVLine(line: string): string[] {
        const values: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            inQuotes = !inQuotes
            continue
          }
          if (ch === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
            continue
          }
          current += ch
        }
        values.push(current.trim())
        return values
      }

      const csvGames = lines
        .slice(1)
        .map((line) => {
          const cols = parseCSVLine(line)
          return {
            time: (cols[timeIdx] ?? '').trim(),
            home: (cols[homeIdx] ?? '').trim().toLowerCase(),
            away: (cols[awayIdx] ?? '').trim().toLowerCase(),
            division: divIdx >= 0 ? (cols[divIdx] ?? '').trim().toLowerCase() : '',
            field: fieldIdx >= 0 ? (cols[fieldIdx] ?? '').trim().toLowerCase() : '',
          }
        })
        .filter((g) => g.home && g.away)

      // Build app games lookup
      const appGames = filtered.map((g) => ({
        time: g.scheduled_time ?? '',
        home: (g.home_team?.name ?? '').toLowerCase(),
        away: (g.away_team?.name ?? '').toLowerCase(),
        division: (g.division ?? '').toLowerCase(),
        field: (g.field?.name ?? '').toLowerCase(),
      }))

      // Match by home+away team names (order-independent)
      const makeKey = (home: string, away: string) => [home, away].sort().join('|||')
      const appMap = new Map<string, (typeof appGames)[0][]>()
      for (const g of appGames) {
        const key = makeKey(g.home, g.away)
        if (!appMap.has(key)) appMap.set(key, [])
        appMap.get(key)!.push(g)
      }

      let matched = 0
      const missingInApp: typeof csvGames = []
      const differences: {
        time: string
        home: string
        away: string
        csvField: string
        appField: string
        csvDiv: string
        appDiv: string
      }[] = []
      const matchedAppKeys = new Set<string>()

      for (const csvGame of csvGames) {
        const key = makeKey(csvGame.home, csvGame.away)
        const appMatches = appMap.get(key)
        if (!appMatches || appMatches.length === 0) {
          missingInApp.push(csvGame)
        } else {
          const appGame = appMatches.shift()!
          if (appMatches.length === 0) appMap.delete(key)
          matchedAppKeys.add(key)
          // Check for field/division differences
          const fieldDiff = csvGame.field && appGame.field && csvGame.field !== appGame.field
          const divDiff =
            csvGame.division && appGame.division && csvGame.division !== appGame.division
          if (fieldDiff || divDiff) {
            differences.push({
              time: csvGame.time || appGame.time,
              home: csvGame.home,
              away: csvGame.away,
              csvField: csvGame.field,
              appField: appGame.field,
              csvDiv: csvGame.division,
              appDiv: appGame.division,
            })
          }
          matched++
        }
      }

      // Remaining unmatched app games
      const missingInCsv: typeof appGames = []
      for (const [, remaining] of appMap) {
        for (const g of remaining) missingInCsv.push(g)
      }

      setCompareResult({ matched, missingInApp, missingInCsv, differences })
      toast.success(
        `Comparison complete: ${matched} matched, ${missingInApp.length + missingInCsv.length} differences`
      )
    }
    reader.readAsText(file)
  }

  // Field columns for board view
  const fieldColumns = useMemo(() => {
    return state.fields
      .map((field) => ({
        field,
        games: filtered
          .filter((g) => g.field_id === field.id)
          .sort((a, b) => timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)),
      }))
      .filter((fc) => fc.games.length > 0)
  }, [state.fields, filtered])

  // Unscheduled games for current date
  const unscheduledGames = useMemo(() => {
    return state.games.filter((g) => g.status === 'Unscheduled')
  }, [state.games])

  // Out-of-range games: games whose event_date falls outside event start/end
  const outOfRangeGames = useMemo(() => {
    if (!state.event?.start_date || !state.event?.end_date) return []
    const start = state.event.start_date
    const end = state.event.end_date
    const validDateIds = new Set(state.eventDates.map((ed) => ed.id))
    return state.games.filter((g) => {
      // Check if event_date_id is not in the valid list
      if (!validDateIds.has(g.event_date_id)) return true
      // Check if the associated date is outside event window
      const ed = state.eventDates.find((d) => d.id === g.event_date_id)
      if (ed && (ed.date < start || ed.date > end)) return true
      return false
    })
  }, [state.games, state.event, state.eventDates])

  async function handleUnschedule(gameId: number) {
    await updateGameStatus(gameId, 'Unscheduled')
    toast.success(`Game #${gameId} moved to Unscheduled`)
  }

  async function handleDeleteGame(gameId: number) {
    await deleteGame(gameId)
    toast.success(`Game #${gameId} deleted`)
  }

  // ── Bulk select helpers ──
  function toggleGameSelection(gameId: number) {
    setSelectedGameIds((prev) => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  function selectAllGames() {
    setSelectedGameIds(new Set(filtered.map((g) => g.id)))
  }

  function deselectAllGames() {
    setSelectedGameIds(new Set())
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedGameIds(new Set())
  }

  async function bulkDeleteGames() {
    const count = selectedGameIds.size
    if (count === 0) return
    if (!window.confirm(`Delete ${count} game${count !== 1 ? 's' : ''}? This cannot be undone.`))
      return
    setBulkDeleting(true)
    try {
      const sb = createClient()
      const ids = Array.from(selectedGameIds)
      const { error } = await sb.from('games').delete().in('id', ids)
      if (error) throw error
      await refreshGames()
      toast.success(`${count} game${count !== 1 ? 's' : ''} deleted`)
      exitSelectionMode()
    } catch (err: any) {
      toast.error(`Bulk delete failed: ${err.message}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  if (!eventId) return null

  // Derive team context for SCR modal
  const teamId = userRole?.team_id ?? undefined
  const teamGames = teamId
    ? state.games.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId)
    : []
  const scrRequests = (state.scheduleChangeRequests ?? []) as ScheduleChangeRequest[]
  const pendingRequestGameIds = new Set(
    scrRequests
      .filter((r) => r.status === 'pending' || r.status === 'under_review')
      .flatMap((r) => (r.games ?? []).map((g) => g.game_id))
  )

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
                  {team.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logo_url}
                      alt=""
                      className="w-3.5 h-3.5 rounded object-cover flex-shrink-0"
                    />
                  )}
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
            <div className="absolute z-50 mt-1 left-0 w-72 max-h-72 overflow-y-auto bg-surface-card border border-border rounded-lg shadow-xl">
              {(() => {
                // Group teams by program -> division -> teams
                const programs = new Map<string, Map<string, typeof state.teams>>()
                const unassigned = new Map<string, typeof state.teams>()

                for (const team of state.teams) {
                  const progName =
                    (team as any).programs?.name || (team as any).program_name || null
                  const div = team.division || 'Unassigned'

                  if (progName) {
                    if (!programs.has(progName)) programs.set(progName, new Map())
                    const divMap = programs.get(progName)!
                    if (!divMap.has(div)) divMap.set(div, [])
                    divMap.get(div)!.push(team)
                  } else {
                    if (!unassigned.has(div)) unassigned.set(div, [])
                    unassigned.get(div)!.push(team)
                  }
                }

                const renderTeam = (team: (typeof state.teams)[0]) => {
                  const isFollowed = followedSet.has(team.id)
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleFollowTeam(team.id)}
                      className={cn(
                        'w-full flex items-center gap-2 pl-6 pr-3 py-1 text-left font-cond text-[11px] font-bold transition-colors',
                        isFollowed ? 'bg-blue-900/30 text-blue-300' : 'hover:bg-white/5 text-white'
                      )}
                    >
                      <Star
                        size={9}
                        className={cn(
                          isFollowed ? 'text-yellow-400 fill-yellow-400' : 'text-muted'
                        )}
                      />
                      {team.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logo_url}
                          alt=""
                          className="w-4 h-4 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <span className="truncate">{team.name}</span>
                    </button>
                  )
                }

                return (
                  <>
                    {[...programs.entries()]
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([progName, divMap]) => (
                        <div key={progName}>
                          <div className="font-cond text-[9px] font-black tracking-widest text-muted px-3 pt-2 pb-0.5 bg-navy/30 border-b border-border/30 uppercase">
                            {progName}
                          </div>
                          {[...divMap.entries()]
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([div, teams]) => (
                              <div key={div}>
                                <div className="font-cond text-[8px] font-bold tracking-wider text-muted/70 pl-4 pt-1.5 pb-0.5 uppercase">
                                  {div}
                                </div>
                                {teams.sort((a, b) => a.name.localeCompare(b.name)).map(renderTeam)}
                              </div>
                            ))}
                        </div>
                      ))}
                    {unassigned.size > 0 && (
                      <div>
                        <div className="font-cond text-[9px] font-black tracking-widest text-muted px-3 pt-2 pb-0.5 bg-navy/30 border-b border-border/30 uppercase">
                          Unassigned
                        </div>
                        {[...unassigned.entries()]
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([div, teams]) => (
                            <div key={div}>
                              <div className="font-cond text-[8px] font-bold tracking-wider text-muted/70 pl-4 pt-1.5 pb-0.5 uppercase">
                                {div}
                              </div>
                              {teams.sort((a, b) => a.name.localeCompare(b.name)).map(renderTeam)}
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )
              })()}
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
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => compareFileRef.current?.click()}
          disabled={filtered.length === 0}
        >
          <GitCompareArrows size={11} className="inline mr-1" /> COMPARE CSV
        </Btn>
        <button
          onClick={downloadScheduleTemplate}
          className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <Download size={10} /> Template
        </button>
        {userRole?.role === 'admin' && (
          <Btn
            size="sm"
            variant={selectionMode ? 'danger' : 'ghost'}
            onClick={() => {
              if (selectionMode) exitSelectionMode()
              else setSelectionMode(true)
            }}
          >
            <CheckSquare size={11} className="inline mr-1" />
            {selectionMode ? 'EXIT SELECT' : 'SELECT'}
          </Btn>
        )}
        {selectionMode && (
          <>
            <Btn size="sm" variant="ghost" onClick={selectAllGames}>
              SELECT ALL
            </Btn>
            <Btn size="sm" variant="ghost" onClick={deselectAllGames}>
              DESELECT ALL
            </Btn>
          </>
        )}
        <input
          ref={scheduleFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleScheduleCSVFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        <input
          ref={compareFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleCompareCSV(e.target.files[0])
            e.target.value = ''
          }}
        />

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
            <div className="flex gap-2 items-center">
              <button
                onClick={dismissAllConflicts}
                className="font-cond text-[10px] font-bold tracking-wider px-2.5 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors"
              >
                DISMISS ALL
              </button>
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

      {/* Generation Log */}
      {lastRunId && (
        <div className="mb-4">
          <button
            onClick={() => {
              if (auditExpanded) {
                setAuditExpanded(false)
              } else {
                loadAuditLog()
              }
            }}
            className={cn(
              'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5',
              auditExpanded
                ? 'bg-navy/60 border-border text-white'
                : 'bg-surface-card border-border text-muted hover:text-white'
            )}
          >
            <Shield size={11} />
            {auditExpanded ? 'HIDE GENERATION LOG' : 'VIEW GENERATION LOG'}
          </button>

          {auditExpanded && auditLog.length > 0 && (
            <div className="mt-2 bg-surface-card border border-border rounded-lg overflow-hidden">
              <div className="bg-navy/60 px-4 py-2 border-b border-border">
                <span className="font-cond font-black text-[12px] tracking-wide text-white">
                  GENERATION LOG — Run {lastRunId}
                </span>
              </div>
              <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
                {auditLog.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px]">
                    <span
                      className={cn(
                        'font-cond font-bold tracking-wider px-1.5 py-0.5 rounded text-[9px] uppercase flex-shrink-0 mt-0.5',
                        entry.run_type === 'error'
                          ? 'bg-red-900/40 text-red-400'
                          : entry.run_type === 'warning'
                            ? 'bg-yellow-900/40 text-yellow-400'
                            : entry.run_type === 'generate'
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-gray-800 text-gray-400'
                      )}
                    >
                      {entry.run_type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-300">
                        {entry.games_created != null && (
                          <span className="text-white font-bold">
                            {entry.games_created} games created
                          </span>
                        )}
                        {entry.validation_errors > 0 && (
                          <span className="text-red-400 ml-2">
                            {entry.validation_errors} errors
                          </span>
                        )}
                        {entry.validation_warnings > 0 && (
                          <span className="text-yellow-400 ml-2">
                            {entry.validation_warnings} warnings
                          </span>
                        )}
                      </div>
                      {entry.summary && (
                        <div className="text-gray-500 text-[10px]">
                          {entry.summary.totalGames} total games, {entry.summary.totalTeams} teams,
                          games/team: {entry.summary.gamesPerTeamMin}–
                          {entry.summary.gamesPerTeamMax}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-600 text-[10px] flex-shrink-0">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {auditExpanded && auditLog.length === 0 && (
            <div className="mt-2 bg-surface-card border border-border rounded-lg p-4 text-center text-muted font-cond text-[12px]">
              No audit log entries found for this run.
            </div>
          )}
        </div>
      )}

      {/* Alert: games outside event dates (All Dates mode) */}
      {state.currentDateIdx === -1 &&
        (() => {
          const dateIds = new Set(state.eventDates.map((d) => d.id))
          const orphaned = state.games.filter((g) => !dateIds.has(g.event_date_id))
          if (orphaned.length === 0) return null
          return (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-4 py-2 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
              <span className="font-cond text-[12px] text-yellow-300">
                {orphaned.length} game{orphaned.length !== 1 ? 's' : ''} scheduled outside defined
                event dates
              </span>
            </div>
          )
        })()}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-navy">
                {selectionMode && (
                  <th className="font-cond text-[10px] font-black tracking-widest text-muted px-2 py-2 text-center border-b-2 border-border w-8">
                    <button
                      onClick={() =>
                        selectedGameIds.size === filtered.length
                          ? deselectAllGames()
                          : selectAllGames()
                      }
                      className="text-muted hover:text-white transition-colors"
                    >
                      {selectedGameIds.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare size={14} className="text-blue-400" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                )}
                {state.currentDateIdx === -1 && (
                  <th className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border">
                    DATE
                  </th>
                )}
                <th className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border sticky left-0 z-10 bg-navy">
                  TIME
                </th>
                {['FIELD', 'HOME', 'AWAY', 'DIV', 'STATUS', 'SCORE', 'ACTIONS'].map((h) => (
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
                      game.status === 'Cancelled'
                        ? 'opacity-50'
                        : game.status === 'Live'
                          ? 'bg-green-900/10'
                          : game.status === 'Delayed'
                            ? 'bg-red-900/10'
                            : hasConflict
                              ? 'bg-yellow-900/8'
                              : isFollowedGame
                                ? 'bg-blue-900/8'
                                : '',
                      isFollowedGame && 'border-l-2 border-l-blue-500',
                      selectionMode && selectedGameIds.has(game.id) && 'bg-blue-900/20'
                    )}
                  >
                    {selectionMode && (
                      <td className="px-2 py-2 text-center w-8">
                        <button
                          onClick={() => toggleGameSelection(game.id)}
                          className="text-muted hover:text-white transition-colors"
                        >
                          {selectedGameIds.has(game.id) ? (
                            <CheckSquare size={14} className="text-blue-400" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>
                    )}
                    {state.currentDateIdx === -1 && (
                      <td className="font-cond text-[10px] text-muted px-3 py-2 whitespace-nowrap">
                        {game.event_date?.label ?? '—'}
                      </td>
                    )}
                    <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap sticky left-0 z-10 bg-surface">
                      {game.display_id && (
                        <span className="text-[9px] text-muted mr-1.5">{game.display_id}</span>
                      )}
                      <span className={game.status === 'Cancelled' ? 'line-through' : undefined}>
                        {game.scheduled_time}
                      </span>
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
                      <div className="flex items-center gap-1.5">
                        {teamLogoMap[game.home_team_id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={teamLogoMap[game.home_team_id]!}
                            alt=""
                            className="w-4 h-4 rounded object-cover flex-shrink-0"
                          />
                        )}
                        {followedSet.has(game.home_team_id) && (
                          <Star size={9} className="text-yellow-400 fill-yellow-400" />
                        )}
                        {game.home_team?.name ?? '?'}
                      </div>
                    </td>
                    <td className="font-cond font-bold text-white px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {teamLogoMap[game.away_team_id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={teamLogoMap[game.away_team_id]!}
                            alt=""
                            className="w-4 h-4 rounded object-cover flex-shrink-0"
                          />
                        )}
                        {followedSet.has(game.away_team_id) && (
                          <Star size={9} className="text-yellow-400 fill-yellow-400" />
                        )}
                        {game.away_team?.name ?? '?'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                        {game.division}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusBadge status={game.status} />
                        {scrRequests.some((r) => r.games?.some((g) => g.game_id === game.id)) && (
                          <span
                            className={`badge-request-${
                              scrRequests
                                .flatMap((r) => r.games ?? [])
                                .find((g) => g.game_id === game.id)?.status ?? 'pending'
                            }`}
                            title={`Change request ${
                              scrRequests
                                .flatMap((r) => r.games ?? [])
                                .find((g) => g.game_id === game.id)?.status ?? 'pending'
                            }`}
                          >
                            {(
                              scrRequests
                                .flatMap((r) => r.games ?? [])
                                .find((g) => g.game_id === game.id)?.status ?? 'pending'
                            ).replace('_', ' ')}
                          </span>
                        )}
                      </div>
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
                      <div className="flex gap-1 items-center flex-wrap">
                        {game.status !== 'Final' && (
                          <button
                            onClick={() => cycleStatus(game.id, game.status)}
                            className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-navy hover:bg-navy-light text-white transition-colors"
                          >
                            {nextStatusLabel(game.status)}
                          </button>
                        )}
                        <QuickRescheduleBtn game={game} onRescheduled={loadConflicts} />
                        {userRole?.role === 'admin' && (
                          <button
                            onClick={() => openEditGame(game)}
                            className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-surface-card border border-border text-muted hover:text-white hover:border-blue-400 transition-colors"
                            title="Edit game"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                        {userRole?.role === 'admin' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete game #${game.id}?`))
                                handleDeleteGame(game.id)
                            }}
                            className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-surface-card border border-border text-muted hover:text-red-400 hover:border-red-400 transition-colors"
                            title="Delete game"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                        {(userRole?.role === 'coach' || userRole?.role === 'program_leader') &&
                          game.status !== 'Cancelled' && (
                            <Btn
                              variant="outline"
                              size="sm"
                              disabled={pendingRequestGameIds.has(game.id)}
                              title={
                                pendingRequestGameIds.has(game.id) ? 'Request pending' : undefined
                              }
                              aria-label="Request a schedule change for this game"
                              onClick={() => {
                                setScrPreSelectedGameId(game.id)
                                setScrModalOpen(true)
                              }}
                            >
                              <CalendarX size={12} className="inline mr-1" />
                              Request Change
                            </Btn>
                          )}
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

      {/* ── OUT-OF-RANGE WARNING ── */}
      {outOfRangeGames.length > 0 && userRole?.role === 'admin' && (
        <div className="mb-4 rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
            <span className="font-cond text-[12px] font-bold text-yellow-300">
              {outOfRangeGames.length} game{outOfRangeGames.length > 1 ? 's' : ''} scheduled outside
              allowed dates
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {outOfRangeGames.slice(0, 5).map((g) => {
              const ed = state.eventDates.find((d) => d.id === g.event_date_id)
              return (
                <div key={g.id} className="text-[11px] text-yellow-200/70 pl-5">
                  Game #{g.id}: {g.home_team?.name ?? 'TBD'} vs {g.away_team?.name ?? 'TBD'}
                  {ed ? ` — ${ed.date} (${ed.label})` : ' — unknown date'}
                </div>
              )
            })}
            {outOfRangeGames.length > 5 && (
              <div className="text-[11px] text-yellow-200/50 pl-5">
                + {outOfRangeGames.length - 5} more
              </div>
            )}
          </div>
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
          pendingRequestGameIds={pendingRequestGameIds}
          scheduleChangeRequests={scrRequests}
          userRole={userRole}
          onRequestChange={(gameId) => {
            setScrPreSelectedGameId(gameId)
            setScrModalOpen(true)
          }}
          unscheduledGames={unscheduledGames}
          onUnschedule={userRole?.role === 'admin' ? handleUnschedule : undefined}
          onDelete={userRole?.role === 'admin' ? handleDeleteGame : undefined}
          onEdit={userRole?.role === 'admin' ? openEditGame : undefined}
          selectionMode={selectionMode}
          selectedGameIds={selectedGameIds}
          onToggleSelect={toggleGameSelection}
          teamLogoMap={teamLogoMap}
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
          <FormField label="Division">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agDiv}
              onChange={(e) => {
                setAgDiv(e.target.value)
                setAgHome('')
                setAgAway('')
                setAgField('')
              }}
            >
              <option value="">Select division…</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Field">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agField}
              onChange={(e) => setAgField(e.target.value)}
            >
              <option value="">Select field…</option>
              {state.fields
                .filter((f) => !agDiv || !f.division || f.division === agDiv)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.division ? ` (${f.division})` : ''}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Time">
            <div className="flex gap-1">
              <select
                className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 flex-1"
                value={agTime}
                onChange={(e) => setAgTime(e.target.value)}
              >
                {(() => {
                  const fa =
                    agField && currentDate
                      ? fieldAvailability.find(
                          (a) =>
                            a.field_id === Number(agField) && a.event_date_id === currentDate.id
                        )
                      : null
                  const startMin = fa ? timeToMin(fa.available_from) : 7 * 60
                  const endMin = fa ? timeToMin(fa.available_to) : 21 * 60
                  const slots: { label: string; value: string }[] = []
                  for (let m = startMin; m <= endMin; m += 15) {
                    const hh = Math.floor(m / 60)
                    const mm = m % 60
                    const label = `${hh > 12 ? hh - 12 : hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`
                    const value = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
                    slots.push({ label, value })
                  }
                  return slots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))
                })()}
              </select>
              <input
                type="time"
                value={agTime}
                onChange={(e) => setAgTime(e.target.value)}
                className="bg-surface-card border border-border text-white px-1.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 w-[100px]"
                title="Custom time"
              />
            </div>
          </FormField>
          <div />
          <FormField label="Home Team">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agHome}
              onChange={(e) => setAgHome(e.target.value)}
            >
              <option value="">Select team…</option>
              {state.teams
                .filter((t) => !agDiv || t.division === agDiv)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
                .filter((t) => (!agDiv || t.division === agDiv) && String(t.id) !== agHome)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Edit game modal */}
      <Modal
        open={editGameOpen}
        onClose={() => setEditGameOpen(false)}
        title={`EDIT GAME #${editGame?.id ?? ''}`}
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setEditGameOpen(false)}>
              CANCEL
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleEditGameSave} disabled={editSaving}>
              {editSaving ? 'SAVING...' : 'SAVE CHANGES'}
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Division">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={editDiv}
              onChange={(e) => setEditDiv(e.target.value)}
            >
              <option value="">No division</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Field">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={editField}
              onChange={(e) => setEditField(e.target.value)}
            >
              <option value="">Select field…</option>
              {state.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.division ? ` (${f.division})` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Time">
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 w-full"
            />
          </FormField>
          <div />
          <FormField label="Home Team">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={editHome}
              onChange={(e) => setEditHome(e.target.value)}
            >
              <option value="">Select team…</option>
              {state.teams
                .filter((t) => !editDiv || t.division === editDiv)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Away Team">
            <select
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={editAway}
              onChange={(e) => setEditAway(e.target.value)}
            >
              <option value="">Select team…</option>
              {state.teams
                .filter((t) => (!editDiv || t.division === editDiv) && String(t.id) !== editHome)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </FormField>
        </div>

        {/* No-Show Section */}
        {editGame && editGame.status !== 'Final' && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="font-cond text-[10px] font-black tracking-[.12em] text-red-400 uppercase mb-2">
              NO-SHOW / FORFEIT
            </div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setNoShowTeam(noShowTeam === 'home' ? null : 'home')}
                className={cn(
                  'flex-1 font-cond text-[11px] font-bold py-1.5 rounded border transition-colors',
                  noShowTeam === 'home'
                    ? 'bg-red-900/50 border-red-700 text-red-300'
                    : 'bg-surface border-border text-muted hover:text-white hover:border-red-700'
                )}
              >
                {editGame.home_team?.name ??
                  state.teams.find((t) => String(t.id) === editHome)?.name ??
                  'Home'}{' '}
                NO-SHOW
              </button>
              <button
                onClick={() => setNoShowTeam(noShowTeam === 'away' ? null : 'away')}
                className={cn(
                  'flex-1 font-cond text-[11px] font-bold py-1.5 rounded border transition-colors',
                  noShowTeam === 'away'
                    ? 'bg-red-900/50 border-red-700 text-red-300'
                    : 'bg-surface border-border text-muted hover:text-white hover:border-red-700'
                )}
              >
                {editGame.away_team?.name ??
                  state.teams.find((t) => String(t.id) === editAway)?.name ??
                  'Away'}{' '}
                NO-SHOW
              </button>
            </div>
            {noShowTeam && (
              <div className="space-y-2 bg-red-900/10 border border-red-900/30 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Penalty Points">
                    <input
                      type="number"
                      min="0"
                      value={noShowPenalty}
                      onChange={(e) => setNoShowPenalty(e.target.value)}
                      className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-red-400 w-full"
                    />
                  </FormField>
                  <FormField label="Notes">
                    <input
                      type="text"
                      placeholder="Optional reason..."
                      value={noShowNotes}
                      onChange={(e) => setNoShowNotes(e.target.value)}
                      className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-red-400 w-full"
                    />
                  </FormField>
                </div>
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={handleNoShow}
                  disabled={editSaving}
                  className="w-full"
                >
                  {editSaving ? 'RECORDING...' : `RECORD NO-SHOW & FORFEIT GAME`}
                </Btn>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Generate schedule confirmation modal */}
      <Modal
        open={genOpen}
        onClose={() => {
          setGenOpen(false)
          setValidationResult(null)
        }}
        title="GENERATE SCHEDULE"
        footer={
          <>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                setGenOpen(false)
                setValidationResult(null)
              }}
            >
              CANCEL
            </Btn>
            {!validationResult ? (
              <Btn variant="primary" size="sm" onClick={handleDryRun} disabled={dryRunning}>
                {dryRunning ? 'VALIDATING...' : 'VALIDATE & PREVIEW'}
              </Btn>
            ) : validationResult.errors.length === 0 ? (
              <Btn
                variant="primary"
                size="sm"
                onClick={handleGenerateSchedule}
                disabled={generating}
              >
                {generating ? 'GENERATING...' : 'ACCEPT & GENERATE'}
              </Btn>
            ) : (
              <Btn variant="ghost" size="sm" onClick={() => setValidationResult(null)}>
                RETRY
              </Btn>
            )}
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
              {state.games.length} existing games will not be removed. New games will be added
              alongside them.
            </div>
          )}
          {!validationResult && (
            <p className="text-[11px] text-muted">
              Games are generated using round-robin within each division and assigned to available
              time slots across all event dates and fields. Click "Validate & Preview" to run a dry
              run first.
            </p>
          )}

          {/* Validation results */}
          {validationResult && (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-cond tracking-wider text-gray-400">
                VALIDATION RESULTS — {validationResult.summary.totalGames} games,{' '}
                {validationResult.summary.totalTeams} teams
              </div>

              {validationResult.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/50 rounded p-3">
                  <div className="text-red-400 font-cond text-sm font-bold mb-1">
                    {validationResult.errors.length} ERROR
                    {validationResult.errors.length !== 1 ? 'S' : ''}
                  </div>
                  {validationResult.errors.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} className="text-xs text-red-300 py-0.5">
                      {e.message}
                    </div>
                  ))}
                  {validationResult.errors.length > 10 && (
                    <div className="text-xs text-red-400 pt-1">
                      ...and {validationResult.errors.length - 10} more
                    </div>
                  )}
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-3">
                  <div className="text-yellow-400 font-cond text-sm font-bold mb-1">
                    {validationResult.warnings.length} WARNING
                    {validationResult.warnings.length !== 1 ? 'S' : ''}
                  </div>
                  {validationResult.warnings.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} className="text-xs text-yellow-300 py-0.5">
                      {e.message}
                    </div>
                  ))}
                  {validationResult.warnings.length > 10 && (
                    <div className="text-xs text-yellow-400 pt-1">
                      ...and {validationResult.warnings.length - 10} more
                    </div>
                  )}
                </div>
              )}

              {validationResult.errors.length === 0 && (
                <div className="bg-green-900/20 border border-green-700/50 rounded p-3 text-green-400 text-sm flex items-center gap-2">
                  <CheckCircle size={14} /> Schedule passed validation
                </div>
              )}

              {/* Team metrics summary */}
              <div className="text-xs text-gray-400">
                Games per team: {validationResult.summary.gamesPerTeamMin}–
                {validationResult.summary.gamesPerTeamMax}
                {validationResult.summary.hardViolations > 0 && (
                  <span className="text-red-400 ml-2">
                    {validationResult.summary.hardViolations} hard violations
                  </span>
                )}
                {validationResult.summary.softViolations > 0 && (
                  <span className="text-yellow-400 ml-2">
                    {validationResult.summary.softViolations} soft violations
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* CSV Compare Results */}
      {compareResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex justify-between items-center">
              <span className="font-cond text-[13px] font-black tracking-[.12em] text-white uppercase">
                CSV Comparison Results
              </span>
              <Btn size="sm" variant="ghost" onClick={() => setCompareResult(null)}>
                ✕
              </Btn>
            </div>
            <div className="p-5 overflow-auto space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'MATCHED', value: compareResult.matched, color: '#34d399' },
                  {
                    label: 'IN CSV ONLY',
                    value: compareResult.missingInApp.length,
                    color: '#f59e0b',
                  },
                  {
                    label: 'IN APP ONLY',
                    value: compareResult.missingInCsv.length,
                    color: '#f59e0b',
                  },
                  {
                    label: 'FIELD/DIV DIFF',
                    value: compareResult.differences.length,
                    color: '#ef4444',
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-[#1a2d50] px-3 py-2"
                    style={{ background: '#081428' }}
                  >
                    <div className="font-cond text-[9px] font-black tracking-[.15em] text-muted uppercase">
                      {s.label}
                    </div>
                    <div className="font-mono text-[24px] font-bold" style={{ color: s.color }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Games in CSV but not in app */}
              {compareResult.missingInApp.length > 0 && (
                <div>
                  <div className="font-cond text-[11px] font-black tracking-[.12em] text-yellow-400 uppercase mb-2">
                    In Spreadsheet Only ({compareResult.missingInApp.length})
                  </div>
                  <div className="rounded-lg border border-[#1a2d50] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#081428' }}>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Time
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Home
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Away
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Division
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Field
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareResult.missingInApp.map((g, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                            <td className="px-3 py-1 font-mono text-[11px] text-white">{g.time}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-white">{g.home}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-white">{g.away}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-muted">
                              {g.division}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-muted">
                              {g.field}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Games in app but not in CSV */}
              {compareResult.missingInCsv.length > 0 && (
                <div>
                  <div className="font-cond text-[11px] font-black tracking-[.12em] text-yellow-400 uppercase mb-2">
                    In App Only ({compareResult.missingInCsv.length})
                  </div>
                  <div className="rounded-lg border border-[#1a2d50] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#081428' }}>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Time
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Home
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Away
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Division
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Field
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareResult.missingInCsv.map((g, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                            <td className="px-3 py-1 font-mono text-[11px] text-white">{g.time}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-white">{g.home}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-white">{g.away}</td>
                            <td className="px-3 py-1 font-cond text-[11px] text-muted">
                              {g.division}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-muted">
                              {g.field}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Field/Division differences */}
              {compareResult.differences.length > 0 && (
                <div>
                  <div className="font-cond text-[11px] font-black tracking-[.12em] text-red-400 uppercase mb-2">
                    Field / Division Differences ({compareResult.differences.length})
                  </div>
                  <div className="rounded-lg border border-[#1a2d50] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#081428' }}>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            Teams
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            CSV Field
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            App Field
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            CSV Div
                          </th>
                          <th className="px-3 py-1.5 text-left font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                            App Div
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareResult.differences.map((d, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                            <td className="px-3 py-1 font-cond text-[11px] text-white">
                              {d.home} vs {d.away}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-yellow-400">
                              {d.csvField || '—'}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-blue-400">
                              {d.appField || '—'}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-yellow-400">
                              {d.csvDiv || '—'}
                            </td>
                            <td className="px-3 py-1 font-cond text-[11px] text-blue-400">
                              {d.appDiv || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {compareResult.matched > 0 &&
                compareResult.missingInApp.length === 0 &&
                compareResult.missingInCsv.length === 0 &&
                compareResult.differences.length === 0 && (
                  <div className="text-center py-6">
                    <div className="font-cond text-[14px] font-bold text-green-400">
                      ✓ Schedules match perfectly
                    </div>
                    <div className="font-cond text-[11px] text-muted mt-1">
                      {compareResult.matched} games verified
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule CSV Preview Modal */}
      {scheduleCsvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-cond font-black text-[14px] text-white tracking-wider">
                IMPORT SCHEDULE — {scheduleCsvPreview.rows.length} game
                {scheduleCsvPreview.rows.length !== 1 ? 's' : ''}
              </div>
              <button
                onClick={() => {
                  setScheduleCsvPreview(null)
                  setCsvMismatches([])
                  setResolverEntries([])
                }}
                className="text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {scheduleCsvPreview.warnings.length > 0 && (
                <div className="px-5 py-2 bg-yellow-900/20 border-b border-yellow-800/30">
                  <div className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-yellow-400 mb-1">
                    <AlertTriangle size={12} /> WARNINGS
                  </div>
                  {scheduleCsvPreview.warnings.map((w, i) => (
                    <div key={i} className="font-cond text-[11px] text-yellow-300/80">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Field/Division Mismatch Resolver (old style) */}
              {csvMismatches.length > 0 && (
                <div className="px-5 py-3 bg-yellow-900/20 border-b border-yellow-700/50">
                  <div className="text-yellow-400 font-cond text-sm font-bold mb-2">
                    {csvMismatches.length} UNMATCHED FIELD/DIVISION NAME
                    {csvMismatches.length !== 1 ? 'S' : ''}
                  </div>
                  {csvMismatches.map((mismatch, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#1a2d50] text-muted uppercase">
                        {mismatch.column}
                      </span>
                      <span className="text-red-400 text-xs font-mono">{mismatch.csvValue}</span>
                      <span className="text-gray-500 text-xs">&rarr;</span>
                      <select
                        className="bg-surface-card border border-border text-white px-2 py-0.5 rounded text-xs outline-none focus:border-blue-400 transition-colors"
                        value={mismatch.resolvedTo ?? ''}
                        onChange={(e) => resolveCsvMismatch(i, e.target.value)}
                      >
                        <option value="">-- Select match --</option>
                        <option value="__skip__">Skip rows with this value</option>
                        {mismatch.suggestions.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.name} {s.score < 1 ? `(${Math.round(s.score * 100)}% match)` : ''}
                          </option>
                        ))}
                      </select>
                      {mismatch.resolvedTo === '__skip__' && (
                        <XCircle size={12} className="text-red-400" />
                      )}
                      {mismatch.resolvedTo && mismatch.resolvedTo !== '__skip__' && (
                        <CheckCircle size={12} className="text-green-400" />
                      )}
                      {!mismatch.resolvedTo && (
                        <AlertTriangle size={12} className="text-yellow-400" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Enhanced Team Resolver */}
              {resolverEntries.length > 0 && (
                <div className="px-5 py-3 border-b border-border bg-navy/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-cond font-black text-[13px] text-white tracking-wider">
                      {resolverEntries.length} UNMATCHED TEAM
                      {resolverEntries.length !== 1 ? 'S' : ''}
                      <span className="text-muted font-normal ml-2">
                        Resolved: {resolvedTeamCount}/{resolverEntries.length}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={bulkAutoCreateAll}
                        className="font-cond text-[10px] font-black tracking-wider px-3 py-1.5 rounded border border-green-700/50 bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors"
                      >
                        <Plus size={10} className="inline mr-1" />
                        AUTO-CREATE ALL
                      </button>
                      <button
                        onClick={bulkBestMatchAll}
                        className="font-cond text-[10px] font-black tracking-wider px-3 py-1.5 rounded border border-blue-700/50 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors"
                      >
                        BEST MATCH ALL
                      </button>
                      <button
                        onClick={bulkSkipAll}
                        className="font-cond text-[10px] font-black tracking-wider px-3 py-1.5 rounded border border-border bg-surface-card text-muted hover:text-white transition-colors"
                      >
                        SKIP ALL
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {resolverEntries.map((entry, i) => {
                      const divisionNames = [
                        ...new Set(state.teams.map((t) => t.division).filter(Boolean)),
                      ]
                      return (
                        <div
                          key={i}
                          className={cn(
                            'rounded-lg border p-3',
                            entry.action === 'create'
                              ? 'border-green-700/40 bg-green-900/10'
                              : entry.action === 'map'
                                ? 'border-blue-700/40 bg-blue-900/10'
                                : entry.action === 'skip'
                                  ? 'border-border/50 bg-surface-card/50 opacity-60'
                                  : 'border-yellow-700/40 bg-yellow-900/10'
                          )}
                        >
                          <div className="font-cond text-[12px] font-black text-white tracking-wider mb-2">
                            {entry.csvValue}
                            {entry.action === null && (
                              <AlertTriangle size={11} className="inline ml-2 text-yellow-400" />
                            )}
                            {entry.action === 'create' && (
                              <CheckCircle size={11} className="inline ml-2 text-green-400" />
                            )}
                            {entry.action === 'map' && (
                              <CheckCircle size={11} className="inline ml-2 text-blue-400" />
                            )}
                            {entry.action === 'skip' && (
                              <XCircle size={11} className="inline ml-2 text-muted" />
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            {/* Option 1: Create */}
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolver-${i}`}
                                checked={entry.action === 'create'}
                                onChange={() => setResolverAction(i, 'create')}
                                className="mt-0.5 accent-green-500"
                              />
                              <div className="flex-1">
                                <span className="font-cond text-[11px] font-bold text-green-400">
                                  CREATE NEW TEAM
                                </span>
                                {entry.action === 'create' && (
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="font-cond text-[9px] text-muted tracking-wider">
                                        DIVISION:
                                      </span>
                                      <select
                                        className="bg-surface-card border border-border text-white px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-green-400"
                                        value={entry.detectedDivision ?? ''}
                                        onChange={(e) => setResolverDivision(i, e.target.value)}
                                      >
                                        <option value="">-- None --</option>
                                        {divisionNames.map((d) => (
                                          <option key={d} value={d}>
                                            {d}
                                          </option>
                                        ))}
                                      </select>
                                      {entry.detectedDivision && (
                                        <span className="font-cond text-[9px] text-green-400/70">
                                          (auto-detected)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-cond text-[9px] text-muted tracking-wider">
                                        PROGRAM:
                                      </span>
                                      <select
                                        className="bg-surface-card border border-border text-white px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-green-400"
                                        value={
                                          entry.detectedProgram
                                            ? String(entry.detectedProgram.id)
                                            : ''
                                        }
                                        onChange={(e) => setResolverProgram(i, e.target.value)}
                                      >
                                        <option value="">-- None --</option>
                                        {csvPrograms.map((p) => (
                                          <option key={p.id} value={String(p.id)}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                      {entry.detectedProgram && (
                                        <span className="font-cond text-[9px] text-green-400/70">
                                          (auto-detected)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </label>

                            {/* Option 2: Map */}
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolver-${i}`}
                                checked={entry.action === 'map'}
                                onChange={() =>
                                  setResolverAction(
                                    i,
                                    'map',
                                    entry.suggestions[0]
                                      ? String(entry.suggestions[0].id)
                                      : undefined
                                  )
                                }
                                className="mt-0.5 accent-blue-500"
                              />
                              <div className="flex-1 flex items-center gap-2">
                                <span className="font-cond text-[11px] font-bold text-blue-400">
                                  MAP TO EXISTING:
                                </span>
                                <select
                                  className="bg-surface-card border border-border text-white px-1.5 py-0.5 rounded text-[10px] outline-none focus:border-blue-400 max-w-[220px]"
                                  value={entry.mapToId ?? ''}
                                  onChange={(e) => setResolverMapId(i, e.target.value)}
                                  disabled={entry.action !== 'map'}
                                >
                                  <option value="">-- Select team --</option>
                                  {entry.suggestions.length > 0 && (
                                    <optgroup label="Best matches">
                                      {entry.suggestions.map((s) => (
                                        <option key={s.id} value={String(s.id)}>
                                          {s.name} ({Math.round(s.score * 100)}%)
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="All teams">
                                    {state.teams
                                      .slice()
                                      .sort((a, b) => a.name.localeCompare(b.name))
                                      .map((t) => (
                                        <option key={t.id} value={String(t.id)}>
                                          {t.name} — {t.division}
                                        </option>
                                      ))}
                                  </optgroup>
                                </select>
                              </div>
                            </label>

                            {/* Option 3: Skip */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolver-${i}`}
                                checked={entry.action === 'skip'}
                                onChange={() => setResolverAction(i, 'skip')}
                                className="accent-gray-500"
                              />
                              <span className="font-cond text-[11px] font-bold text-muted">
                                SKIP
                              </span>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Data table - only show if no resolver entries or all resolved */}
              {(resolverEntries.length === 0 || resolvedTeamCount === resolverEntries.length) && (
                <div className="flex-1 overflow-auto px-5 py-3">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="font-cond font-bold text-muted text-left py-1.5 pr-3">#</th>
                        {Object.keys(scheduleCsvPreview.rows[0] || {}).map((col) => (
                          <th
                            key={col}
                            className="font-cond font-bold text-muted text-left py-1.5 pr-3"
                          >
                            {col.toUpperCase().replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleCsvPreview.rows.map((row, i) => {
                        const isSkipped =
                          skippedCsvValues.has(row.home_team?.toLowerCase().trim()) ||
                          skippedCsvValues.has(row.away_team?.toLowerCase().trim())
                        return (
                          <tr
                            key={i}
                            className={cn(
                              'border-b border-border/50',
                              isSkipped ? 'bg-red-900/10 opacity-50' : 'hover:bg-navy/20'
                            )}
                          >
                            <td className="font-cond text-muted py-1.5 pr-3">{i + 1}</td>
                            {Object.entries(row).map(([col, val], j) => {
                              const valLower = (val || '').toLowerCase().trim()
                              const isTeamCreate = resolverEntries.some(
                                (e) =>
                                  e.csvValue.toLowerCase().trim() === valLower &&
                                  e.action === 'create'
                              )
                              const isTeamMap = resolverEntries.some(
                                (e) =>
                                  e.csvValue.toLowerCase().trim() === valLower && e.action === 'map'
                              )
                              const isTeamSkip = resolverEntries.some(
                                (e) =>
                                  e.csvValue.toLowerCase().trim() === valLower &&
                                  e.action === 'skip'
                              )
                              const hasMismatch = csvMismatches.some(
                                (m) => m.csvValue.toLowerCase().trim() === valLower && !m.resolvedTo
                              )
                              const isResolved = csvMismatches.some(
                                (m) =>
                                  m.csvValue.toLowerCase().trim() === valLower &&
                                  m.resolvedTo &&
                                  m.resolvedTo !== '__skip__'
                              )
                              return (
                                <td
                                  key={j}
                                  className={cn(
                                    'font-cond py-1.5 pr-3',
                                    isTeamCreate
                                      ? 'text-green-400'
                                      : isTeamMap
                                        ? 'text-blue-400'
                                        : isTeamSkip
                                          ? 'text-muted line-through'
                                          : hasMismatch
                                            ? 'text-yellow-400'
                                            : isResolved
                                              ? 'text-green-400'
                                              : 'text-white'
                                  )}
                                >
                                  {val || <span className="text-muted italic">&mdash;</span>}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* end scrollable body */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
              <span className="font-cond text-[11px] text-muted">
                {scheduleCsvPreview.rows.length - skippedCsvValues.size} game
                {scheduleCsvPreview.rows.length - skippedCsvValues.size !== 1 ? 's' : ''} will be
                imported
                {teamsToCreate.length > 0 && (
                  <span className="text-green-400 ml-2">
                    {teamsToCreate.length} team{teamsToCreate.length !== 1 ? 's' : ''} will be
                    created
                  </span>
                )}
                {skippedCsvValues.size > 0 && (
                  <span className="text-red-400 ml-2">({skippedCsvValues.size} skipped)</span>
                )}
              </span>
              <div className="flex gap-2">
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setScheduleCsvPreview(null)
                    setCsvMismatches([])
                    setResolverEntries([])
                  }}
                >
                  CANCEL
                </Btn>
                <Btn
                  size="sm"
                  variant="success"
                  onClick={importScheduleCSV}
                  disabled={importingSchedule || hasUnresolved}
                >
                  {hasUnresolved
                    ? `RESOLVE ${unresolvedTeamEntries.length + unresolvedOldMismatches.length} UNMATCHED`
                    : importingSchedule
                      ? 'IMPORTING...'
                      : `IMPORT ${scheduleCsvPreview.rows.length - skippedCsvValues.size} GAME${scheduleCsvPreview.rows.length - skippedCsvValues.size !== 1 ? 'S' : ''}${teamsToCreate.length > 0 ? ` + CREATE ${teamsToCreate.length} TEAM${teamsToCreate.length !== 1 ? 'S' : ''}` : ''}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Change Request modal */}
      {teamId && (
        <ScheduleChangeRequestModal
          open={scrModalOpen}
          onClose={() => {
            setScrModalOpen(false)
            setScrPreSelectedGameId(undefined)
          }}
          preSelectedGameId={scrPreSelectedGameId}
          teamId={teamId}
          teamGames={teamGames}
          eventId={eventId}
        />
      )}

      {/* ── BULK ACTION BAR ── */}
      {selectionMode && selectedGameIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-surface-card border border-red-700/50 rounded-xl px-6 py-3 shadow-2xl z-50 flex items-center gap-4">
          <span className="font-cond text-[12px] font-bold text-white">
            {selectedGameIds.size} game{selectedGameIds.size !== 1 ? 's' : ''} selected
          </span>
          <Btn variant="danger" size="sm" onClick={bulkDeleteGames} disabled={bulkDeleting}>
            <Trash2 size={12} className="inline mr-1" />
            {bulkDeleting ? 'DELETING...' : 'DELETE SELECTED'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={exitSelectionMode}>
            CANCEL
          </Btn>
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
  pendingRequestGameIds,
  scheduleChangeRequests,
  userRole,
  onRequestChange,
  unscheduledGames,
  onUnschedule,
  onDelete,
  onEdit,
  selectionMode,
  selectedGameIds,
  onToggleSelect,
  teamLogoMap,
}: {
  fieldColumns: Array<{ field: any; games: any[] }>
  conflicts: any[]
  conflictGameIds: Set<number>
  onCycleStatus: (id: number, status: GameStatus) => void
  onRescheduled: () => void
  followedSet: Set<number>
  pendingRequestGameIds: Set<number>
  scheduleChangeRequests: ScheduleChangeRequest[]
  userRole: import('@/lib/auth').UserRole | null
  onRequestChange: (gameId: number) => void
  unscheduledGames: any[]
  onUnschedule?: (gameId: number) => void
  onDelete?: (gameId: number) => void
  onEdit?: (game: any) => void
  selectionMode: boolean
  selectedGameIds: Set<number>
  onToggleSelect: (gameId: number) => void
  teamLogoMap: Record<number, string | null>
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
                    pendingRequestGameIds={pendingRequestGameIds}
                    scheduleChangeRequests={scheduleChangeRequests}
                    userRole={userRole}
                    onRequestChange={onRequestChange}
                    onUnschedule={onUnschedule}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    selectionMode={selectionMode}
                    isSelected={selectedGameIds.has(game.id)}
                    onToggleSelect={onToggleSelect}
                    teamLogoMap={teamLogoMap}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Unscheduled column */}
        {unscheduledGames.length > 0 && (
          <div className="flex-shrink-0" style={{ width: 220 }}>
            <div className="rounded-lg border-2 border-dashed border-border mb-3 overflow-hidden">
              <div className="px-3 py-2.5 bg-[#0f1520]">
                <div className="font-cond font-black text-[15px] tracking-wide text-muted">
                  Unscheduled
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-cond text-[10px] text-muted">
                    {unscheduledGames.length} games
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {unscheduledGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  hasConflict={false}
                  conflict={undefined}
                  onCycleStatus={onCycleStatus}
                  onRescheduled={onRescheduled}
                  followedSet={followedSet}
                  pendingRequestGameIds={pendingRequestGameIds}
                  scheduleChangeRequests={scheduleChangeRequests}
                  userRole={userRole}
                  onRequestChange={onRequestChange}
                  onUnschedule={onUnschedule}
                  onDelete={onDelete}
                  selectionMode={selectionMode}
                  isSelected={selectedGameIds.has(game.id)}
                  onToggleSelect={onToggleSelect}
                  teamLogoMap={teamLogoMap}
                />
              ))}
            </div>
          </div>
        )}
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
  pendingRequestGameIds,
  scheduleChangeRequests,
  userRole,
  onRequestChange,
  onUnschedule,
  onDelete,
  onEdit,
  selectionMode,
  isSelected,
  onToggleSelect,
  teamLogoMap,
}: {
  game: any
  hasConflict: boolean
  conflict: any
  onCycleStatus: (id: number, status: GameStatus) => void
  onRescheduled: () => void
  followedSet: Set<number>
  pendingRequestGameIds: Set<number>
  scheduleChangeRequests: ScheduleChangeRequest[]
  userRole: import('@/lib/auth').UserRole | null
  onRequestChange: (gameId: number) => void
  onUnschedule?: (gameId: number) => void
  onDelete?: (gameId: number) => void
  onEdit?: (game: any) => void
  selectionMode: boolean
  isSelected: boolean
  onToggleSelect: (gameId: number) => void
  teamLogoMap: Record<number, string | null>
}) {
  const [expanded, setExpanded] = useState(false)
  const isLive = game.status === 'Live' || game.status === 'Halftime'
  const isFinal = game.status === 'Final'
  const isCancelled = game.status === 'Cancelled'
  const isDelayed = game.status === 'Delayed'
  const isStarting = game.status === 'Starting'
  const isUnscheduled = game.status === 'Unscheduled'
  const isFollowedGame =
    followedSet.size > 0 &&
    (followedSet.has(game.home_team_id) || followedSet.has(game.away_team_id))

  const borderColor = isCancelled
    ? 'border-border/30'
    : hasConflict && conflict?.severity === 'critical'
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

  const bgColor = isCancelled
    ? 'bg-surface-card/30'
    : isLive
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
        'rounded-lg border overflow-hidden transition-all relative',
        borderColor,
        bgColor,
        (isFinal || isCancelled || isUnscheduled) && 'opacity-50',
        selectionMode && isSelected && 'ring-2 ring-blue-500/60'
      )}
      onClick={selectionMode ? () => onToggleSelect(game.id) : undefined}
    >
      {/* Selection checkbox overlay */}
      {selectionMode && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect(game.id)
            }}
            className="text-muted hover:text-white transition-colors"
          >
            {isSelected ? (
              <CheckSquare size={16} className="text-blue-400" />
            ) : (
              <Square size={16} />
            )}
          </button>
        </div>
      )}
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
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {teamLogoMap[game.home_team_id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogoMap[game.home_team_id]!}
                  alt=""
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              )}
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
            <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
              <div className="font-cond font-black text-[13px] leading-tight truncate text-right">
                {game.away_team?.name ?? '?'}
                {followedSet.has(game.away_team_id) && (
                  <Star size={9} className="inline ml-1 text-yellow-400 fill-yellow-400" />
                )}
              </div>
              {teamLogoMap[game.away_team_id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogoMap[game.away_team_id]!}
                  alt=""
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 font-cond font-black text-[13px] leading-tight mb-0.5">
              {teamLogoMap[game.home_team_id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogoMap[game.home_team_id]!}
                  alt=""
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              )}
              {followedSet.has(game.home_team_id) && (
                <Star size={9} className="text-yellow-400 fill-yellow-400" />
              )}
              {game.home_team?.name ?? '?'}
            </div>
            <div className="font-cond text-[10px] text-muted mb-0.5 pl-5">vs</div>
            <div className="flex items-center gap-1.5 font-cond font-black text-[13px] leading-tight">
              {teamLogoMap[game.away_team_id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogoMap[game.away_team_id]!}
                  alt=""
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              )}
              {followedSet.has(game.away_team_id) && (
                <Star size={9} className="text-yellow-400 fill-yellow-400" />
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

        {/* Request status badge */}
        {scheduleChangeRequests.some((r) => r.games?.some((g) => g.game_id === game.id)) && (
          <div className="mb-2">
            <span
              className={`badge-request-${
                scheduleChangeRequests
                  .flatMap((r) => r.games ?? [])
                  .find((g) => g.game_id === game.id)?.status ?? 'pending'
              }`}
              title={`Change request ${
                scheduleChangeRequests
                  .flatMap((r) => r.games ?? [])
                  .find((g) => g.game_id === game.id)?.status ?? 'pending'
              }`}
            >
              {(
                scheduleChangeRequests
                  .flatMap((r) => r.games ?? [])
                  .find((g) => g.game_id === game.id)?.status ?? 'pending'
              ).replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {!isFinal && !isCancelled && !isUnscheduled && (
          <div className="flex gap-1 flex-wrap">
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
            {onEdit && (
              <button
                onClick={() => onEdit(game)}
                className="px-2 py-1 bg-surface-card hover:bg-blue-900/30 text-muted hover:text-blue-300 border border-border rounded transition-colors"
                title="Edit game"
              >
                <Pencil size={12} />
              </button>
            )}
            {onUnschedule && (
              <button
                onClick={() => onUnschedule(game.id)}
                className="px-2 py-1 bg-surface-card hover:bg-red-900/30 text-muted hover:text-red-300 border border-border rounded transition-colors"
                title="Unschedule game"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Delete button for unscheduled games */}
        {game.status === 'Unscheduled' && onDelete && (
          <div className="flex gap-1 mt-1">
            <QuickRescheduleBtn game={game} onRescheduled={onRescheduled} />
            {onUnschedule && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete Game #${game.id}? This cannot be undone.`)) {
                    onDelete(game.id)
                  }
                }}
                className="flex-1 font-cond text-[10px] font-bold tracking-wider py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Request Change button — visible to coaches and program leaders */}
        {(userRole?.role === 'coach' || userRole?.role === 'program_leader') && !isCancelled && (
          <div className="mt-1.5">
            <Btn
              variant="outline"
              size="sm"
              disabled={pendingRequestGameIds.has(game.id)}
              title={pendingRequestGameIds.has(game.id) ? 'Request pending' : undefined}
              aria-label="Request a schedule change for this game"
              onClick={() => onRequestChange(game.id)}
              className="w-full"
            >
              <CalendarX size={11} className="inline mr-1" />
              Request Change
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
