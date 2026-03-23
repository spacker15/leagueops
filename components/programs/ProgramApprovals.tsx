'use client'

import { RegistrationConfig } from '@/components/programs/RegistrationConfig'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Btn, SectionHeader, Input, Select, FormField, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, Users, Building2, RefreshCw, Plus, ChevronDown, ChevronUp, Upload, Download, X, AlertTriangle, Trash2 } from 'lucide-react'
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
  created_at: string
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
  const [activeTab, setActiveTab] = useState<'programs' | 'teams' | 'config'>('programs')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Create Program state
  const [showCreateProgram, setShowCreateProgram] = useState(false)
  const [newProgram, setNewProgram] = useState({ name: '', short_name: '', city: '', state: '', contact_name: '', contact_email: '' })
  const [creatingProgram, setCreatingProgram] = useState(false)

  // Create Team state
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', division: '', association: '', color: '#0B3D91' })
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [divisions, setDivisions] = useState<string[]>([])

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<{ type: 'programs' | 'teams'; rows: Record<string, string>[]; warnings: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const programFileRef = useRef<HTMLInputElement>(null)
  const teamFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    setLoading(true)
    const [{ data: progs }, { data: teamsData }, { data: regs }, { data: divs }] = await Promise.all([
      sb.from('programs').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      sb.from('teams').select('*').eq('event_id', eventId!).order('name'),
      sb
        .from('team_registrations')
        .select('*, program:programs(name)')
        .order('created_at', { ascending: false }),
      eventId
        ? sb.from('registration_divisions').select('name').eq('event_id', eventId).eq('is_active', true).order('sort_order')
        : Promise.resolve({ data: [] }),
    ])
    setPrograms((progs as Program[]) ?? [])
    setTeams((teamsData as TeamRow[]) ?? [])
    setTeamRegs((regs as unknown as TeamReg[]) ?? [])
    setDivisions((divs ?? []).map((d: any) => d.name))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  if (!eventId) return null

  // --- Delete program (cascade-deletes teams with matching program_id via program_teams) ---
  async function deleteProgram(prog: Program) {
    if (!confirm(`Delete program "${prog.name}" and ALL its linked teams? This cannot be undone.`)) return
    setDeletingId(prog.id)
    const sb = createClient()

    // Find all team IDs linked to this program for this event
    const { data: linkedTeams } = await sb
      .from('program_teams')
      .select('team_id')
      .eq('program_id', prog.id)
      .eq('event_id', eventId)

    const teamIds = (linkedTeams ?? []).map((t: any) => t.team_id)

    // Delete program_teams links
    await sb.from('program_teams').delete().eq('program_id', prog.id).eq('event_id', eventId)

    // Delete team_registrations for this program
    await sb.from('team_registrations').delete().eq('program_id', prog.id)

    // Delete the linked teams
    if (teamIds.length > 0) {
      await sb.from('teams').delete().in('id', teamIds)
    }

    // Delete the program itself
    const { error } = await sb.from('programs').delete().eq('id', prog.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Program "${prog.name}" deleted (${teamIds.length} team${teamIds.length !== 1 ? 's' : ''} removed)`)
    }
    setDeletingId(null)
    load()
  }

  // --- Delete team ---
  async function deleteTeam(team: TeamRow) {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return
    setDeletingId(team.id)
    const sb = createClient()

    // Remove from program_teams
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
      // Create the actual team record
      const { data: team, error: teamErr } = await sb
        .from('teams')
        .insert({
          event_id: eventId,
          name: reg.team_name,
          division: reg.division,
        })
        .select()
        .single()

      if (teamErr || !team) continue

      // Link team to program
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

    // Create the actual team record
    const { data: team, error } = await sb
      .from('teams')
      .insert({
        event_id: eventId,
        name: reg.team_name,
        division: reg.division,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setActionId(null)
      return
    }

    // Link team to program
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
    setCreatingTeam(true)
    const sb = createClient()
    const { error } = await sb.from('teams').insert({
      event_id: eventId,
      name: newTeam.name,
      division: newTeam.division,
      association: newTeam.association || null,
      color: newTeam.color || '#0B3D91',
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Team "${newTeam.name}" created`)
      setNewTeam({ name: '', division: '', association: '', color: '#0B3D91' })
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
      : 'name,division'
    const example = type === 'programs'
      ? '\nMetro FC,MFC,Springfield,IL,John Smith,john@metro.com'
      : '\nMetro FC Blue,U12 Boys'
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
    const headers = ['name', 'division', 'association', 'color']
    const csvRows = [headers.join(',')]
    for (const t of teams) {
      csvRows.push(headers.map(h => {
        const val = (t as any)[h] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(','))
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
      setCsvPreview({ type, rows, warnings })
    }
    reader.readAsText(file)
  }

  async function importCSV() {
    if (!csvPreview) return
    setImporting(true)
    const sb = createClient()

    try {
      if (csvPreview.type === 'programs') {
        const inserts = csvPreview.rows.map(r => ({
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
        const { error } = await sb.from('programs').insert(inserts)
        if (error) throw error
        toast.success(`${inserts.length} program${inserts.length !== 1 ? 's' : ''} imported`)
      } else {
        const inserts = csvPreview.rows.map(r => ({
          event_id: eventId!,
          name: r.name,
          division: r.division || '',
        }))
        const { error } = await sb.from('teams').insert(inserts)
        if (error) throw error
        toast.success(`${inserts.length} team${inserts.length !== 1 ? 's' : ''} imported`)
      }
      setCsvPreview(null)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Import failed')
    }
    setImporting(false)
  }

  const filteredPrograms = programs.filter((p) => filter === 'all' || p.status === filter)
  const filteredTeams = filter === 'all' ? teams : teams // teams table has no status filter
  const pendingPrograms = programs.filter((p) => p.status === 'pending').length

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
          Programs ({programs.length})
          {pendingPrograms > 0 && (
            <span className="ml-1 text-yellow-400">({pendingPrograms} pending)</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={cn(
            'font-cond text-[12px] font-bold px-4 py-2 rounded-lg border transition-colors',
            activeTab === 'teams'
              ? 'bg-navy border-blue-400 text-white'
              : 'bg-surface-card border-border text-muted hover:text-white'
          )}
        >
          Teams ({teams.length})
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
          {/* Programs list */}
          {activeTab === 'programs' && (
            <div className="space-y-3">
              {/* Create Program + Actions */}
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <Btn
                    size="sm"
                    variant={showCreateProgram ? 'ghost' : 'primary'}
                    onClick={() => setShowCreateProgram(!showCreateProgram)}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD PROGRAM
                    {showCreateProgram ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => programFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT CSV
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={exportProgramsCSV} disabled={programs.length === 0}>
                    <Download size={11} className="inline mr-1" /> DOWNLOAD CSV
                  </Btn>
                  <button onClick={() => downloadTemplate('programs')} className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Download size={10} /> Template
                  </button>
                  <input ref={programFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'programs'); e.target.value = '' }} />
                </div>
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
              </div>

              {filteredPrograms.length === 0 && (
                <div className="text-center py-12 text-muted font-cond">
                  No programs matching filter
                </div>
              )}
              {filteredPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className={cn(
                    'bg-surface-card border rounded-xl p-4',
                    prog.status === 'pending'
                      ? 'border-yellow-700/50'
                      : prog.status === 'approved'
                        ? 'border-green-700/40'
                        : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Building2 size={16} className="text-muted flex-shrink-0" />
                        <div className="font-cond font-black text-[16px] text-white">
                          {prog.name}
                        </div>
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
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-[11px] mt-2">
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
                        {prog.association && (
                          <div>
                            <span className="text-muted">Association: </span>
                            <span className="text-white">{prog.association}</span>
                          </div>
                        )}
                        {prog.contact_phone && (
                          <div>
                            <span className="text-muted">Phone: </span>
                            <span className="text-white">{prog.contact_phone}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted">Submitted: </span>
                          <span className="text-white">
                            {new Date(prog.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {prog.notes && (
                        <div className="mt-2 text-[11px] bg-navy/30 rounded px-3 py-2 text-muted italic">
                          &ldquo;{prog.notes}&rdquo;
                        </div>
                      )}
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
              ))}
            </div>
          )}

          {/* Teams list - actual teams from teams table */}
          {activeTab === 'teams' && (
            <div className="space-y-3">
              {/* Create Team + Actions */}
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <Btn
                    size="sm"
                    variant={showCreateTeam ? 'ghost' : 'primary'}
                    onClick={() => setShowCreateTeam(!showCreateTeam)}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD TEAM
                    {showCreateTeam ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => teamFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT CSV
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={exportTeamsCSV} disabled={teams.length === 0}>
                    <Download size={11} className="inline mr-1" /> DOWNLOAD CSV
                  </Btn>
                  <button onClick={() => downloadTemplate('teams')} className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Download size={10} /> Template
                  </button>
                  <input ref={teamFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'teams'); e.target.value = '' }} />
                </div>
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

              {/* Teams table */}
              {filteredTeams.length === 0 ? (
                <div className="text-center py-12 text-muted font-cond">
                  No teams for this event
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-navy">
                        {['NAME', 'DIVISION', 'ASSOCIATION', 'COLOR', 'CREATED', 'ACTIONS'].map((h) => (
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
                      {filteredTeams.map((team) => (
                        <tr
                          key={team.id}
                          className="border-b border-border/50 hover:bg-white/5 transition-colors"
                        >
                          <td className="font-cond font-bold text-white px-3 py-2">{team.name}</td>
                          <td className="px-3 py-2">
                            <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                              {team.division}
                            </span>
                          </td>
                          <td className="font-cond text-[11px] text-muted px-3 py-2">{team.association || '—'}</td>
                          <td className="px-3 py-2">
                            {team.color && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: team.color }} />
                                <span className="font-mono text-[10px] text-muted">{team.color}</span>
                              </div>
                            )}
                          </td>
                          <td className="font-cond text-[11px] text-muted px-3 py-2">
                            {new Date(team.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => deleteTeam(team)}
                              disabled={deletingId === team.id}
                              className="flex items-center gap-1 font-cond text-[10px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={11} /> DELETE
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 font-cond text-[10px] text-muted">{filteredTeams.length} teams</div>
                </div>
              )}
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
                  {csvPreview.rows.map((row, i) => (
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

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="font-cond text-[11px] text-muted">
                {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''} will be imported
                {csvPreview.type === 'programs' ? ' with status=approved' : ` into current event`}
              </span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setCsvPreview(null)}>CANCEL</Btn>
                <Btn size="sm" variant="success" onClick={importCSV} disabled={importing}>
                  {importing ? 'IMPORTING...' : `IMPORT ${csvPreview.rows.length} ${csvPreview.type === 'programs' ? 'PROGRAM' : 'TEAM'}${csvPreview.rows.length !== 1 ? 'S' : ''}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
