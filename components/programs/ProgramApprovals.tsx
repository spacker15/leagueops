'use client'

import { RegistrationConfig } from '@/components/programs/RegistrationConfig'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/store'
import { cn, findCsvMismatches, type CsvMismatch } from '@/lib/utils'
import { Btn, SectionHeader, Input, Select, FormField, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, Users, Building2, RefreshCw, Plus, ChevronDown, ChevronUp, Upload, Download, X, AlertTriangle, Trash2, ChevronRight } from 'lucide-react'
import { useRef } from 'react'

interface Program {
  id: number
  name: string
  short_name: string | null
  association: string | null
  city: string | null
  state: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  status: string
  notes: string | null
  created_at: string
  website: string | null
  event_id: number | null
}

interface TeamRow {
  id: number
  event_id: number
  name: string
  division: string
  association: string | null
  color: string | null
  program_id: number | null
  created_at: string
  programs?: { name: string } | null
}

interface TeamReg {
  id: number
  program_id: number
  team_name: string
  division: string
  head_coach_name: string | null
  head_coach_email: string | null
  player_count: number | null
  status: string
  notes: string | null
  program?: { name: string }
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

export function ProgramApprovals() {
  const { user } = useAuth()
  const { eventId } = useApp()
  const [programs, setPrograms] = useState<Program[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamRegs, setTeamRegs] = useState<TeamReg[]>([])
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'programs' | 'config'>('programs')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Collapsed programs
  const [collapsedPrograms, setCollapsedPrograms] = useState<Set<number>>(new Set())

  // Create Program state
  const [showCreateProgram, setShowCreateProgram] = useState(false)
  const [newProgram, setNewProgram] = useState({ name: '', short_name: '', city: '', state: '', contact_name: '', contact_email: '' })
  const [creatingProgram, setCreatingProgram] = useState(false)

  // Create Team state
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', division: '', association: '', color: '#0B3D91', program_id: '' as string })
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [divisions, setDivisions] = useState<string[]>([])

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<{ type: 'programs' | 'teams'; rows: Record<string, string>[]; warnings: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [csvMismatches, setCsvMismatches] = useState<CsvMismatch[]>([])
  const unresolvedMismatches = csvMismatches.filter(m => m.resolvedTo === null)
  const skippedCsvValues = new Set(csvMismatches.filter(m => m.resolvedTo === '__skip__').map(m => m.csvValue.toLowerCase().trim()))
  const programFileRef = useRef<HTMLInputElement>(null)
  const teamFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    setLoading(true)
    const [{ data: progs }, { data: teamsData }, { data: regs }, { data: divs }] = await Promise.all([
      sb.from('programs').select('*').eq('event_id', eventId).order('name'),
      sb.from('teams').select('*, programs(name)').eq('event_id', eventId!).order('division').order('name'),
      sb
        .from('team_registrations')
        .select('*, program:programs(name)')
        .order('created_at', { ascending: false }),
      eventId
        ? sb.from('registration_divisions').select('name').eq('event_id', eventId).eq('is_active', true).order('sort_order')
        : Promise.resolve({ data: [] }),
    ])
    setPrograms((progs as Program[]) ?? [])
    setTeams((teamsData as unknown as TeamRow[]) ?? [])
    setTeamRegs((regs as unknown as TeamReg[]) ?? [])
    setDivisions((divs ?? []).map((d: any) => d.name))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  if (!eventId) return null

  // Toggle program collapse
  function toggleProgram(id: number) {
    setCollapsedPrograms(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group teams by program, then by division
  function groupTeamsByProgram() {
    const byProgram = new Map<number | null, TeamRow[]>()
    for (const team of teams) {
      const key = team.program_id ?? null
      if (!byProgram.has(key)) byProgram.set(key, [])
      byProgram.get(key)!.push(team)
    }
    return byProgram
  }

  function groupByDivision(teamList: TeamRow[]) {
    const byDiv = new Map<string, TeamRow[]>()
    for (const t of teamList) {
      const div = t.division || 'Unassigned'
      if (!byDiv.has(div)) byDiv.set(div, [])
      byDiv.get(div)!.push(t)
    }
    return byDiv
  }

  // --- Delete program (cascade-deletes teams) ---
  async function deleteProgram(prog: Program) {
    if (!confirm(`Delete program "${prog.name}" and ALL its teams? This cannot be undone.`)) return
    setDeletingId(prog.id)
    const sb = createClient()

    // Delete teams with this program_id
    await sb.from('teams').delete().eq('program_id', prog.id)

    // Delete program_teams links (backwards compat)
    await sb.from('program_teams').delete().eq('program_id', prog.id).eq('event_id', eventId)

    // Delete team_registrations for this program
    await sb.from('team_registrations').delete().eq('program_id', prog.id)

    // Delete the program itself
    const { error } = await sb.from('programs').delete().eq('id', prog.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Program "${prog.name}" deleted`)
    }
    setDeletingId(null)
    load()
  }

  // --- Delete team ---
  async function deleteTeam(team: TeamRow) {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return
    setDeletingId(team.id)
    const sb = createClient()

    // Remove from program_teams (backwards compat)
    await sb.from('program_teams').delete().eq('team_id', team.id)

    // Delete team
    const { error } = await sb.from('teams').delete().eq('id', team.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Team "${team.name}" deleted`)
    }
    setDeletingId(null)
    load()
  }

  async function approveProgram(prog: Program) {
    setActionId(prog.id)
    const sb = createClient()

    // Approve program
    await sb
      .from('programs')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', prog.id)

    // Activate the program leader's account
    await sb
      .from('user_roles')
      .update({ is_active: true })
      .eq('program_id', prog.id)
      .eq('role', 'program_leader')

    // Auto-approve all pending teams for this program
    const { data: pendingTeams } = await sb
      .from('team_registrations')
      .select('*')
      .eq('program_id', prog.id)
      .eq('status', 'pending')

    let teamsCreated = 0
    for (const reg of pendingTeams ?? []) {
      // Create the actual team record with program_id
      const { data: team, error: teamErr } = await sb
        .from('teams')
        .insert({
          event_id: eventId,
          name: reg.team_name,
          division: reg.division,
          program_id: prog.id,
        })
        .select()
        .single()

      if (teamErr || !team) continue

      // Link team to program (backwards compat)
      await sb.from('program_teams').insert({
        program_id: prog.id,
        team_id: (team as any).id,
        event_id: eventId,
        division: reg.division,
      })

      // Mark registration approved
      await sb
        .from('team_registrations')
        .update({
          status: 'approved',
          team_id: (team as any).id,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reg.id)

      teamsCreated++
    }

    await sb.from('ops_log').insert({
      event_id: eventId,
      message: `Program approved: ${prog.name} — ${teamsCreated} team(s) auto-created`,
      log_type: 'ok',
      occurred_at: new Date().toISOString(),
    })

    toast.success(
      `${prog.name} approved — ${teamsCreated} team${teamsCreated !== 1 ? 's' : ''} created`
    )
    setActionId(null)
    load()
  }

  async function rejectProgram(prog: Program) {
    setActionId(prog.id)
    const sb = createClient()
    await sb
      .from('programs')
      .update({
        status: 'rejected',
        rejection_note: rejectNote || null,
      })
      .eq('id', prog.id)
    toast(`${prog.name} rejected`)
    setRejectingId(null)
    setRejectNote('')
    setActionId(null)
    load()
  }

  async function approveTeam(reg: TeamReg) {
    setActionId(reg.id)
    const sb = createClient()

    // Create the actual team record with program_id
    const { data: team, error } = await sb
      .from('teams')
      .insert({
        event_id: eventId,
        name: reg.team_name,
        division: reg.division,
        program_id: reg.program_id,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setActionId(null)
      return
    }

    // Link team to program (backwards compat)
    await sb.from('program_teams').insert({
      program_id: reg.program_id,
      team_id: team.id,
      event_id: eventId,
      division: reg.division,
    })

    // Update registration status
    await sb
      .from('team_registrations')
      .update({
        status: 'approved',
        team_id: team.id,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reg.id)

    await sb.from('ops_log').insert({
      event_id: eventId,
      message: `Team approved: ${reg.team_name} (${reg.division}) — Team #${team.id} created`,
      log_type: 'ok',
      occurred_at: new Date().toISOString(),
    })

    toast.success(`${reg.team_name} approved — Team #${team.id} created`)
    setActionId(null)
    load()
  }

  async function rejectTeam(reg: TeamReg) {
    setActionId(reg.id)
    const sb = createClient()
    await sb
      .from('team_registrations')
      .update({
        status: 'rejected',
        rejection_note: rejectNote || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reg.id)
    toast(`${reg.team_name} rejected`)
    setRejectingId(null)
    setRejectNote('')
    setActionId(null)
    load()
  }

  async function createProgram() {
    if (!newProgram.name || !newProgram.contact_name || !newProgram.contact_email) {
      toast.error('Name, contact name, and contact email are required')
      return
    }
    if (programs.some(p => p.name.toLowerCase() === newProgram.name.trim().toLowerCase())) {
      toast.error(`Program "${newProgram.name}" already exists`)
      return
    }
    setCreatingProgram(true)
    const sb = createClient()
    const { error } = await sb.from('programs').insert({
      event_id: eventId,
      name: newProgram.name,
      short_name: newProgram.short_name || null,
      city: newProgram.city || null,
      state: newProgram.state || null,
      contact_name: newProgram.contact_name,
      contact_email: newProgram.contact_email,
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Program "${newProgram.name}" created`)
      setNewProgram({ name: '', short_name: '', city: '', state: '', contact_name: '', contact_email: '' })
      setShowCreateProgram(false)
      load()
    }
    setCreatingProgram(false)
  }

  async function createTeam() {
    if (!newTeam.name || !newTeam.division) {
      toast.error('Team name and division are required')
      return
    }
    if (teams.some(t => t.name.toLowerCase() === newTeam.name.trim().toLowerCase() && t.division.toLowerCase() === newTeam.division.trim().toLowerCase())) {
      toast.error(`Team "${newTeam.name}" already exists in division "${newTeam.division}"`)
      return
    }
    setCreatingTeam(true)
    const sb = createClient()
    const programId = newTeam.program_id ? Number(newTeam.program_id) : null
    const { data: insertedTeam, error } = await sb.from('teams').insert({
      event_id: eventId,
      name: newTeam.name,
      division: newTeam.division,
      association: newTeam.association || null,
      color: newTeam.color || '#0B3D91',
      program_id: programId,
    }).select().single()
    if (error) {
      toast.error(error.message)
    } else {
      // Also insert into program_teams for backwards compat
      if (programId && insertedTeam) {
        await sb.from('program_teams').insert({
          event_id: eventId,
          program_id: programId,
          team_id: (insertedTeam as any).id,
          division: newTeam.division,
        })
      }
      toast.success(`Team "${newTeam.name}" created`)
      setNewTeam({ name: '', division: '', association: '', color: '#0B3D91', program_id: '' })
      setShowCreateTeam(false)
      load()
    }
    setCreatingTeam(false)
  }

  // --- CSV helpers ---
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

  function downloadTemplate(type: 'programs' | 'teams') {
    const headers = type === 'programs'
      ? 'name,short_name,city,state,contact_name,contact_email'
      : 'name,division,program,color'
    const example = type === 'programs'
      ? '\nMetro FC,MFC,Springfield,IL,John Smith,john@metro.com'
      : '\nMetro FC Blue,U12 Boys,Metro FC,#0B3D91'
    const blob = new Blob([headers + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${type}_template.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // --- CSV Export ---
  function exportProgramsCSV() {
    const headers = ['name', 'short_name', 'city', 'state', 'contact_name', 'contact_email', 'status']
    const csvRows = [headers.join(',')]
    for (const p of programs) {
      csvRows.push(headers.map(h => {
        const val = (p as any)[h] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `programs_export.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportTeamsCSV() {
    const headers = ['name', 'division', 'program', 'association', 'color']
    const csvRows = [headers.join(',')]
    for (const t of teams) {
      const progName = t.programs?.name ?? ''
      csvRows.push([
        `"${String(t.name).replace(/"/g, '""')}"`,
        `"${String(t.division).replace(/"/g, '""')}"`,
        `"${String(progName).replace(/"/g, '""')}"`,
        `"${String(t.association ?? '').replace(/"/g, '""')}"`,
        `"${String(t.color ?? '').replace(/"/g, '""')}"`,
      ].join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `teams_export.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleCSVFile(file: File, type: 'programs' | 'teams') {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) { toast.error('CSV must have a header row and at least one data row'); return }

      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const expectedCols = type === 'programs'
        ? ['name', 'short_name', 'city', 'state', 'contact_name', 'contact_email']
        : ['name', 'division']

      const rows: Record<string, string>[] = []
      const warnings: string[] = []

      // Check header match
      const missing = expectedCols.filter(c => !headers.includes(c))
      if (missing.length > 0) warnings.push(`Missing columns: ${missing.join(', ')} — those fields will be empty`)

      for (let i = 1; i < parsed.length; i++) {
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => { obj[h] = parsed[i][idx] || '' })
        // Validate required fields
        if (!obj.name) { warnings.push(`Row ${i}: missing name — will skip`); continue }
        if (type === 'programs' && !obj.contact_name && !obj.contact_email) {
          warnings.push(`Row ${i} (${obj.name}): missing contact_name and contact_email`)
        }
        if (type === 'teams' && !obj.division) {
          warnings.push(`Row ${i} (${obj.name}): missing division`)
        }
        rows.push(obj)
      }

      if (rows.length === 0) { toast.error('No valid rows found in CSV'); return }

      // Fuzzy match divisions for teams CSV
      if (type === 'teams') {
        const divCandidates = divisions.map(d => ({ id: d, name: d }))
        const divVals = rows.map(r => r.division).filter(Boolean)
        const mismatches = findCsvMismatches(divVals, divCandidates, 'division')
        setCsvMismatches(mismatches)
      } else {
        setCsvMismatches([])
      }

      setCsvPreview({ type, rows, warnings })
    }
    reader.readAsText(file)
  }

  function resolveCsvMismatch(idx: number, value: string) {
    setCsvMismatches(prev => prev.map((m, i) => i === idx ? { ...m, resolvedTo: value || null } : m))
  }

  async function importCSV() {
    if (!csvPreview) return
    if (unresolvedMismatches.length > 0) { toast.error('Resolve all mismatches before importing'); return }
    setImporting(true)
    const sb = createClient()

    // Build resolved division map from mismatches
    const resolvedDivMap = new Map<string, string>()
    for (const m of csvMismatches) {
      if (m.resolvedTo && m.resolvedTo !== '__skip__') {
        resolvedDivMap.set(m.csvValue.toLowerCase().trim(), m.resolvedTo)
      }
    }

    try {
      if (csvPreview.type === 'programs') {
        const existingNames = new Set(programs.map(p => p.name.toLowerCase()))
        const seen = new Set<string>()
        const inserts = csvPreview.rows.filter(r => {
          const key = r.name.trim().toLowerCase()
          if (existingNames.has(key) || seen.has(key)) return false
          seen.add(key)
          return true
        }).map(r => ({
          event_id: eventId!,
          name: r.name,
          short_name: r.short_name || null,
          city: r.city || null,
          state: r.state || null,
          contact_name: r.contact_name || r.name,
          contact_email: r.contact_email || '',
          status: 'approved' as const,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        }))
        const skipped = csvPreview.rows.length - inserts.length
        if (inserts.length === 0) { toast.error('All programs already exist'); setImporting(false); return }
        const { error } = await sb.from('programs').insert(inserts)
        if (error) throw error
        toast.success(`${inserts.length} program${inserts.length !== 1 ? 's' : ''} imported${skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}`)
      } else {
        // Build program name -> id lookup for fuzzy matching
        const progNameMap = new Map<string, number>()
        for (const p of programs) {
          progNameMap.set(p.name.toLowerCase().trim(), p.id)
          if (p.short_name) progNameMap.set(p.short_name.toLowerCase().trim(), p.id)
        }

        const existingKeys = new Set(teams.map(t => `${t.name.toLowerCase()}|${t.division.toLowerCase()}`))
        const seen = new Set<string>()
        const rowsToImport = csvPreview.rows.filter(r => !skippedCsvValues.has((r.division || '').toLowerCase().trim()))
        const inserts = rowsToImport.filter(r => {
          const resolvedDiv = resolvedDivMap.get((r.division || '').toLowerCase().trim()) || r.division || ''
          const key = `${r.name.trim().toLowerCase()}|${resolvedDiv.toLowerCase()}`
          if (existingKeys.has(key) || seen.has(key)) return false
          seen.add(key)
          return true
        }).map(r => {
          const resolvedDiv = resolvedDivMap.get((r.division || '').toLowerCase().trim()) || r.division || ''
          // Fuzzy match program column
          const csvProgName = (r.program || '').toLowerCase().trim()
          const matchedProgramId = csvProgName ? (progNameMap.get(csvProgName) ?? null) : null
          return {
            event_id: eventId!,
            name: r.name,
            division: resolvedDiv,
            program_id: matchedProgramId,
            color: r.color || null,
          }
        })
        const skipped = csvPreview.rows.length - inserts.length
        if (inserts.length === 0) { toast.error('All teams already exist'); setImporting(false); return }

        // Insert teams
        const { data: insertedTeams, error } = await sb.from('teams').insert(inserts).select('id, program_id, division')
        if (error) throw error

        // Backwards compat: also insert into program_teams
        const ptInserts = (insertedTeams ?? [])
          .filter((t: any) => t.program_id)
          .map((t: any) => ({
            event_id: eventId!,
            program_id: t.program_id,
            team_id: t.id,
            division: t.division,
          }))
        if (ptInserts.length > 0) {
          await sb.from('program_teams').insert(ptInserts)
        }

        toast.success(`${inserts.length} team${inserts.length !== 1 ? 's' : ''} imported${skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}`)
      }
      setCsvPreview(null)
      setCsvMismatches([])
      load()
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    }
    setImporting(false)
  }

  const filteredPrograms = programs.filter((p) => filter === 'all' || p.status === filter)
  const pendingPrograms = programs.filter((p) => p.status === 'pending').length
  const teamsByProgram = groupTeamsByProgram()
  const unassignedTeams = teamsByProgram.get(null) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader>PROGRAM & TEAM MANAGEMENT</SectionHeader>
        <Btn size="sm" variant="ghost" onClick={load}>
          <RefreshCw size={11} className="inline mr-1" /> REFRESH
        </Btn>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('programs')}
          className={cn(
            'font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'programs'
              ? 'bg-navy border-blue-400 text-white'
              : 'bg-surface-card border-border text-muted hover:text-white'
          )}
        >
          Programs & Teams ({programs.length} programs, {teams.length} teams)
          {pendingPrograms > 0 && (
            <span className="ml-1 text-yellow-400">({pendingPrograms} pending)</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={cn(
            'font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'config'
              ? 'bg-navy border-blue-400 text-white'
              : 'bg-surface-card border-border text-muted hover:text-white'
          )}
        >
          Config
        </button>

        {activeTab === 'programs' && (
          <div className="ml-auto flex gap-1">
            {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'font-cond text-[11px] font-bold px-3 py-1.5 rounded transition-colors',
                  filter === f
                    ? 'bg-navy text-white'
                    : 'bg-surface-card border border-border text-muted hover:text-white'
                )}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted font-cond">LOADING...</div>
      ) : (
        <>
          {activeTab === 'programs' && (
            <div className="space-y-3">
              {/* Action bar */}
              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Btn
                    size="sm"
                    variant={showCreateProgram ? 'ghost' : 'primary'}
                    onClick={() => { setShowCreateProgram(!showCreateProgram); setShowCreateTeam(false) }}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD PROGRAM
                  </Btn>
                  <Btn
                    size="sm"
                    variant={showCreateTeam ? 'ghost' : 'primary'}
                    onClick={() => { setShowCreateTeam(!showCreateTeam); setShowCreateProgram(false) }}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD TEAM
                  </Btn>
                  <div className="border-l border-border h-5 mx-1" />
                  <Btn size="sm" variant="ghost" onClick={() => programFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT PROGRAMS
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => teamFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT TEAMS
                  </Btn>
                  <div className="border-l border-border h-5 mx-1" />
                  <Btn size="sm" variant="ghost" onClick={exportProgramsCSV} disabled={programs.length === 0}>
                    <Download size={11} className="inline mr-1" /> PROGRAMS CSV
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={exportTeamsCSV} disabled={teams.length === 0}>
                    <Download size={11} className="inline mr-1" /> TEAMS CSV
                  </Btn>
                  <button onClick={() => downloadTemplate('programs')} className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Download size={10} /> Prog Template
                  </button>
                  <button onClick={() => downloadTemplate('teams')} className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Download size={10} /> Team Template
                  </button>
                  <input ref={programFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'programs'); e.target.value = '' }} />
                  <input ref={teamFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'teams'); e.target.value = '' }} />
                </div>

                {/* Create Program Form */}
                {showCreateProgram && (
                  <Card className="mt-2 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Program Name *">
                        <Input
                          value={newProgram.name}
                          onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                          placeholder="e.g. Metro FC"
                        />
                      </FormField>
                      <FormField label="Short Name">
                        <Input
                          value={newProgram.short_name}
                          onChange={(e) => setNewProgram({ ...newProgram, short_name: e.target.value })}
                          placeholder="e.g. MFC"
                        />
                      </FormField>
                      <FormField label="City">
                        <Input
                          value={newProgram.city}
                          onChange={(e) => setNewProgram({ ...newProgram, city: e.target.value })}
                        />
                      </FormField>
                      <FormField label="State">
                        <Input
                          value={newProgram.state}
                          onChange={(e) => setNewProgram({ ...newProgram, state: e.target.value })}
                          placeholder="e.g. CA"
                        />
                      </FormField>
                      <FormField label="Contact Name *">
                        <Input
                          value={newProgram.contact_name}
                          onChange={(e) => setNewProgram({ ...newProgram, contact_name: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Contact Email *">
                        <Input
                          type="email"
                          value={newProgram.contact_email}
                          onChange={(e) => setNewProgram({ ...newProgram, contact_email: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Btn size="sm" variant="success" onClick={createProgram} disabled={creatingProgram}>
                        {creatingProgram ? 'CREATING...' : 'CREATE PROGRAM'}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setShowCreateProgram(false)}>
                        CANCEL
                      </Btn>
                    </div>
                  </Card>
                )}

                {/* Create Team Form */}
                {showCreateTeam && (
                  <Card className="mt-2 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Team Name *">
                        <Input
                          value={newTeam.name}
                          onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                          placeholder="e.g. Metro FC Blue"
                        />
                      </FormField>
                      <FormField label="Division *">
                        {divisions.length > 0 ? (
                          <Select
                            value={newTeam.division}
                            onChange={(e) => setNewTeam({ ...newTeam, division: e.target.value })}
                          >
                            <option value="">Select division...</option>
                            {divisions.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            value={newTeam.division}
                            onChange={(e) => setNewTeam({ ...newTeam, division: e.target.value })}
                            placeholder="e.g. U12 Boys"
                          />
                        )}
                      </FormField>
                      <FormField label="Program">
                        <Select
                          value={newTeam.program_id}
                          onChange={(e) => setNewTeam({ ...newTeam, program_id: e.target.value })}
                        >
                          <option value="">No Program (Unassigned)</option>
                          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      </FormField>
                      <FormField label="Association">
                        <Input
                          value={newTeam.association}
                          onChange={(e) => setNewTeam({ ...newTeam, association: e.target.value })}
                          placeholder="Optional"
                        />
                      </FormField>
                      <FormField label="Color">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newTeam.color}
                            onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                            className="w-8 h-8 rounded border border-[#1e3060] bg-transparent cursor-pointer"
                          />
                          <Input
                            value={newTeam.color}
                            onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </FormField>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Btn size="sm" variant="success" onClick={createTeam} disabled={creatingTeam}>
                        {creatingTeam ? 'CREATING...' : 'CREATE TEAM'}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setShowCreateTeam(false)}>
                        CANCEL
                      </Btn>
                    </div>
                  </Card>
                )}
              </div>

              {/* Programs with nested teams */}
              {filteredPrograms.length === 0 && unassignedTeams.length === 0 && (
                <div className="text-center py-12 text-muted font-cond">
                  No programs or teams yet
                </div>
              )}

              {filteredPrograms.map((prog) => {
                const progTeams = teamsByProgram.get(prog.id) ?? []
                const divGroups = groupByDivision(progTeams)
                const isCollapsed = collapsedPrograms.has(prog.id)

                return (
                  <div
                    key={prog.id}
                    className={cn(
                      'bg-surface-card border rounded-xl overflow-hidden',
                      prog.status === 'pending'
                        ? 'border-yellow-700/50'
                        : prog.status === 'approved'
                          ? 'border-green-700/40'
                          : 'border-border'
                    )}
                  >
                    {/* Program header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <button
                              onClick={() => toggleProgram(prog.id)}
                              className="text-muted hover:text-white transition-colors"
                            >
                              <ChevronRight
                                size={16}
                                className={cn('transition-transform', !isCollapsed && 'rotate-90')}
                              />
                            </button>
                            <Building2 size={16} className="text-muted flex-shrink-0" />
                            <button
                              onClick={() => toggleProgram(prog.id)}
                              className="font-cond font-black text-[16px] text-white hover:text-blue-300 transition-colors text-left"
                            >
                              {prog.name}
                            </button>
                            {prog.short_name && (
                              <span className="font-cond text-[11px] text-blue-300">
                                {prog.short_name}
                              </span>
                            )}
                            <span
                              className={cn(
                                'font-cond text-[10px] font-black px-2 py-0.5 rounded tracking-wider',
                                prog.status === 'approved'
                                  ? 'bg-green-900/40 text-green-400'
                                  : prog.status === 'pending'
                                    ? 'bg-yellow-900/30 text-yellow-400'
                                    : 'bg-red-900/30 text-red-400'
                              )}
                            >
                              {prog.status.toUpperCase()}
                            </span>
                            <span className="font-cond text-[10px] text-muted">
                              {progTeams.length} team{progTeams.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-[11px] mt-2 ml-7">
                            <div>
                              <span className="text-muted">Contact: </span>
                              <span className="text-white">{prog.contact_name}</span>
                            </div>
                            <div>
                              <span className="text-muted">Email: </span>
                              <span className="text-blue-300">{prog.contact_email}</span>
                            </div>
                            <div>
                              <span className="text-muted">Location: </span>
                              <span className="text-white">
                                {[prog.city, prog.state].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {prog.status === 'pending' && (
                            <>
                              {rejectingId === prog.id ? (
                                <div className="flex flex-col gap-1.5">
                                  <input
                                    className="bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none w-48"
                                    placeholder="Rejection reason (optional)"
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => rejectProgram(prog)}
                                      disabled={actionId === prog.id}
                                      className="flex-1 font-cond text-[11px] font-bold bg-red-800 hover:bg-red-700 text-white py-1.5 rounded transition-colors"
                                    >
                                      CONFIRM
                                    </button>
                                    <button
                                      onClick={() => setRejectingId(null)}
                                      className="font-cond text-[11px] text-muted px-2 py-1.5 rounded border border-border hover:text-white"
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => approveProgram(prog)}
                                    disabled={actionId === prog.id}
                                    className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle size={13} /> APPROVE
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(prog.id)}
                                    className="flex items-center gap-1.5 font-cond text-[12px] font-bold bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors"
                                  >
                                    <XCircle size={13} /> REJECT
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => deleteProgram(prog)}
                            disabled={deletingId === prog.id}
                            className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} /> DELETE
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Nested teams by division */}
                    {!isCollapsed && progTeams.length > 0 && (
                      <div className="border-t border-border/50 bg-navy/20">
                        {Array.from(divGroups.entries()).map(([div, divTeams]) => (
                          <div key={div}>
                            <div className="px-4 py-1.5 bg-navy/30 border-b border-border/30 flex items-center gap-2">
                              <span className="font-cond text-[10px] font-black tracking-widest text-blue-300 uppercase">
                                {div}
                              </span>
                              <span className="font-cond text-[10px] text-muted">
                                {divTeams.length} team{divTeams.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {divTeams.map((team) => (
                              <div
                                key={team.id}
                                className="flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-white/5 transition-colors"
                              >
                                <div className="w-7" />
                                {team.color && (
                                  <div className="w-3.5 h-3.5 rounded-sm border border-border flex-shrink-0" style={{ backgroundColor: team.color }} />
                                )}
                                <span className="font-cond font-bold text-[12px] text-white flex-1">{team.name}</span>
                                <span className="font-cond text-[10px] text-muted">{team.association || ''}</span>
                                <button
                                  onClick={() => deleteTeam(team)}
                                  disabled={deletingId === team.id}
                                  className="flex items-center gap-1 font-cond text-[10px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isCollapsed && progTeams.length === 0 && (
                      <div className="border-t border-border/50 bg-navy/20 px-4 py-3">
                        <span className="font-cond text-[11px] text-muted italic">No teams yet</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Unassigned Teams */}
              {unassignedTeams.length > 0 && (
                <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <Users size={16} className="text-muted" />
                      <span className="font-cond font-black text-[16px] text-white">
                        Unassigned Teams
                      </span>
                      <span className="font-cond text-[10px] text-muted">
                        {unassignedTeams.length} team{unassignedTeams.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border/50 bg-navy/20">
                    {Array.from(groupByDivision(unassignedTeams).entries()).map(([div, divTeams]) => (
                      <div key={div}>
                        <div className="px-4 py-1.5 bg-navy/30 border-b border-border/30 flex items-center gap-2">
                          <span className="font-cond text-[10px] font-black tracking-widest text-blue-300 uppercase">
                            {div}
                          </span>
                          <span className="font-cond text-[10px] text-muted">
                            {divTeams.length} team{divTeams.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {divTeams.map((team) => (
                          <div
                            key={team.id}
                            className="flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-white/5 transition-colors"
                          >
                            <div className="w-7" />
                            {team.color && (
                              <div className="w-3.5 h-3.5 rounded-sm border border-border flex-shrink-0" style={{ backgroundColor: team.color }} />
                            )}
                            <span className="font-cond font-bold text-[12px] text-white flex-1">{team.name}</span>
                            <span className="font-cond text-[10px] text-muted">{team.association || ''}</span>
                            <button
                              onClick={() => deleteTeam(team)}
                              disabled={deletingId === team.id}
                              className="flex items-center gap-1 font-cond text-[10px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2 font-cond text-[10px] text-muted">
                {programs.length} programs, {teams.length} teams total ({unassignedTeams.length} unassigned)
              </div>
            </div>
          )}
          {activeTab === 'config' && <RegistrationConfig />}
        </>
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-cond font-black text-[14px] text-white tracking-wider">
                IMPORT {csvPreview.type === 'programs' ? 'PROGRAMS' : 'TEAMS'} — {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''}
              </div>
              <button onClick={() => setCsvPreview(null)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Warnings */}
            {csvPreview.warnings.length > 0 && (
              <div className="px-5 py-2 bg-yellow-900/20 border-b border-yellow-800/30">
                <div className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-yellow-400 mb-1">
                  <AlertTriangle size={12} /> WARNINGS
                </div>
                {csvPreview.warnings.map((w, i) => (
                  <div key={i} className="font-cond text-[11px] text-yellow-300/80">{w}</div>
                ))}
              </div>
            )}

            {/* Mismatch Resolver */}
            {csvMismatches.length > 0 && (
              <div className="px-5 py-3 bg-yellow-900/20 border-b border-yellow-700/50">
                <div className="text-yellow-400 font-cond text-sm font-bold mb-2">
                  {csvMismatches.length} UNMATCHED {csvMismatches[0]?.column?.toUpperCase() ?? 'VALUE'}{csvMismatches.length !== 1 ? 'S' : ''} — RESOLVE BEFORE IMPORTING
                </div>
                {csvMismatches.map((mismatch, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#1a2d50] text-muted uppercase">{mismatch.column}</span>
                    <span className="text-red-400 text-xs font-mono">{mismatch.csvValue}</span>
                    <span className="text-gray-500 text-xs">&rarr;</span>
                    <select
                      className="bg-[#081428] border border-[#1a2d50] text-white px-2 py-0.5 rounded text-xs outline-none focus:border-blue-400 transition-colors"
                      value={mismatch.resolvedTo ?? ''}
                      onChange={e => resolveCsvMismatch(i, e.target.value)}
                    >
                      <option value="">-- Select match --</option>
                      <option value="__skip__">Skip rows with this value</option>
                      {mismatch.suggestions.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name} {s.score < 1 ? `(${Math.round(s.score * 100)}% match)` : ''}</option>
                      ))}
                    </select>
                    {mismatch.resolvedTo === '__skip__' && <XCircle size={12} className="text-red-400" />}
                    {mismatch.resolvedTo && mismatch.resolvedTo !== '__skip__' && <CheckCircle size={12} className="text-green-400" />}
                    {!mismatch.resolvedTo && <AlertTriangle size={12} className="text-yellow-400" />}
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-cond font-bold text-muted text-left py-1.5 pr-3">#</th>
                    {Object.keys(csvPreview.rows[0] || {}).map(col => (
                      <th key={col} className="font-cond font-bold text-muted text-left py-1.5 pr-3">
                        {col.toUpperCase().replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.map((row, i) => {
                    const divSkipped = csvPreview.type === 'teams' && skippedCsvValues.has((row.division || '').toLowerCase().trim())
                    return (
                      <tr key={i} className={cn('border-b border-border/50', divSkipped ? 'bg-red-900/10 opacity-50' : 'hover:bg-navy/20')}>
                        <td className="font-cond text-muted py-1.5 pr-3">{i + 1}</td>
                        {Object.entries(row).map(([col, val], j) => {
                          const valLower = (val || '').toLowerCase().trim()
                          const hasMismatch = csvMismatches.some(m => m.csvValue.toLowerCase().trim() === valLower && !m.resolvedTo)
                          const isResolved = csvMismatches.some(m => m.csvValue.toLowerCase().trim() === valLower && m.resolvedTo && m.resolvedTo !== '__skip__')
                          return (
                            <td key={j} className={cn('font-cond py-1.5 pr-3', hasMismatch ? 'text-yellow-400' : isResolved ? 'text-green-400' : 'text-white')}>
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

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="font-cond text-[11px] text-muted">
                {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''} will be imported
                {csvPreview.type === 'programs' ? ' with status=approved' : ` into current event`}
                {skippedCsvValues.size > 0 && <span className="text-red-400 ml-1">({skippedCsvValues.size} values will be skipped)</span>}
              </span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => { setCsvPreview(null); setCsvMismatches([]) }}>CANCEL</Btn>
                <Btn size="sm" variant="success" onClick={importCSV} disabled={importing || unresolvedMismatches.length > 0}>
                  {unresolvedMismatches.length > 0
                    ? `RESOLVE ${unresolvedMismatches.length} MISMATCH${unresolvedMismatches.length !== 1 ? 'ES' : ''}`
                    : importing ? 'IMPORTING...' : `IMPORT ${csvPreview.rows.length} ${csvPreview.type === 'programs' ? 'PROGRAM' : 'TEAM'}${csvPreview.rows.length !== 1 ? 'S' : ''}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
