'use client'

import { RegistrationConfig } from '@/components/programs/RegistrationConfig'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/store'
import { cn, findCsvMismatches, type CsvMismatch } from '@/lib/utils'
import {
  Btn,
  SectionHeader,
  Input,
  Select,
  FormField,
  Card,
  Pill,
  Modal,
  Textarea,
} from '@/components/ui'
import toast from 'react-hot-toast'
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Building2,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  X,
  AlertTriangle,
  Trash2,
  ChevronRight,
  Pencil,
  Mail,
  GripVertical,
  CheckSquare,
  Square,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { LogoUpload } from '@/components/ui/LogoUpload'

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
  display_id: string | null
  logo_url: string | null
}

interface TeamRow {
  id: number
  event_id: number
  name: string
  division: string
  association: string | null
  color: string | null
  program_id: number | null
  display_id: string | null
  logo_url: string | null
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
  const { eventId, state } = useApp()
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

  // Coach conflict badges
  const [conflictsByTeam, setConflictsByTeam] = useState<
    Map<number, { coachName: string; otherTeamIds: number[] }[]>
  >(new Map())
  const [expandedConflict, setExpandedConflict] = useState<Set<number>>(new Set())

  // Collapsed programs
  const [collapsedPrograms, setCollapsedPrograms] = useState<Set<number>>(new Set())

  // Create Program state
  const [showCreateProgram, setShowCreateProgram] = useState(false)
  const [newProgram, setNewProgram] = useState({
    name: '',
    short_name: '',
    city: '',
    state: '',
    contact_name: '',
    contact_email: '',
  })
  const [creatingProgram, setCreatingProgram] = useState(false)

  // Create Team state
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({
    name: '',
    division: '',
    association: '',
    color: '#0B3D91',
    program_id: '' as string,
  })
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [divisions, setDivisions] = useState<string[]>([])

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<{
    type: 'programs' | 'teams'
    rows: Record<string, string>[]
    warnings: string[]
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [csvMismatches, setCsvMismatches] = useState<CsvMismatch[]>([])
  const unresolvedMismatches = csvMismatches.filter((m) => m.resolvedTo === null)
  const skippedCsvValues = new Set(
    csvMismatches
      .filter((m) => m.resolvedTo === '__skip__')
      .map((m) => m.csvValue.toLowerCase().trim())
  )
  const divsToCreate = csvMismatches.filter((m) => m.resolvedTo === '__create__')
  const programFileRef = useRef<HTMLInputElement>(null)
  const teamFileRef = useRef<HTMLInputElement>(null)

  // Edit Program state
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    short_name: '',
    city: '',
    state: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    notes: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Bulk delete state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set())
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // DnD state
  const [draggedTeam, setDraggedTeam] = useState<TeamRow | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const load = useCallback(async () => {
    const sb = createClient()
    setLoading(true)
    const [
      { data: progs },
      { data: teamsData },
      { data: regs },
      { data: divs },
      { data: conflictRows },
    ] = await Promise.all([
      sb.from('programs').select('*').eq('event_id', eventId).order('name'),
      sb
        .from('teams')
        .select('*, programs(name)')
        .eq('event_id', eventId!)
        .order('division')
        .order('name'),
      sb
        .from('team_registrations')
        .select('*, program:programs(name)')
        .order('created_at', { ascending: false }),
      eventId
        ? sb
            .from('registration_divisions')
            .select('name')
            .eq('event_id', eventId)
            .eq('is_active', true)
            .order('sort_order')
        : Promise.resolve({ data: [] }),
      eventId
        ? sb
            .from('coach_conflicts')
            .select('id, coach_id, team_ids, resolved, coaches(name)')
            .eq('event_id', eventId)
            .eq('resolved', false)
        : Promise.resolve({ data: [] }),
    ])
    setPrograms((progs as Program[]) ?? [])
    setTeams((teamsData as unknown as TeamRow[]) ?? [])
    setTeamRegs((regs as unknown as TeamReg[]) ?? [])
    setDivisions((divs ?? []).map((d: any) => d.name))

    // Build conflictsByTeam lookup map
    const byTeam = new Map<number, { coachName: string; otherTeamIds: number[] }[]>()
    for (const conflict of (conflictRows ?? []) as any[]) {
      const coachName = conflict.coaches?.name ?? 'Unknown Coach'
      const teamIds: number[] = conflict.team_ids ?? []
      for (const teamId of teamIds) {
        const otherTeamIds = teamIds.filter((id: number) => id !== teamId)
        if (!byTeam.has(teamId)) byTeam.set(teamId, [])
        byTeam.get(teamId)!.push({ coachName, otherTeamIds })
      }
    }
    setConflictsByTeam(byTeam)

    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  if (!eventId) return null

  // Toggle program collapse
  function toggleProgram(id: number) {
    setCollapsedPrograms((prev) => {
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

  // --- Bulk delete ---
  function toggleTeamSelection(id: number) {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleProgramSelection(id: number) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelectedTeamIds(new Set())
    setSelectedProgramIds(new Set())
    setShowBulkConfirm(false)
  }

  async function bulkDelete() {
    setBulkDeleting(true)
    const sb = createClient()

    try {
      // Delete selected teams first
      const teamIds = Array.from(selectedTeamIds)
      if (teamIds.length > 0) {
        await sb.from('program_teams').delete().in('team_id', teamIds)
        await sb.from('teams').delete().in('id', teamIds)
      }

      // Delete selected programs (cascade: teams, program_teams, team_registrations)
      for (const progId of selectedProgramIds) {
        await sb.from('teams').delete().eq('program_id', progId)
        await sb.from('program_teams').delete().eq('program_id', progId).eq('event_id', eventId)
        await sb.from('team_registrations').delete().eq('program_id', progId)
        await sb.from('programs').delete().eq('id', progId)
      }

      const totalDeleted = teamIds.length + selectedProgramIds.size
      toast.success(`Deleted ${totalDeleted} item${totalDeleted !== 1 ? 's' : ''}`)
    } catch (err: any) {
      toast.error(err.message || 'Bulk delete failed')
    }

    setBulkDeleting(false)
    exitBulkMode()
    load()
  }

  // --- DnD handlers ---
  function handleDragStart(event: DragStartEvent) {
    const teamId = Number(event.active.id)
    const team = teams.find((t) => t.id === teamId)
    if (team) setDraggedTeam(team)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggedTeam(null)
    if (!over) return

    const teamId = Number(active.id)
    const team = teams.find((t) => t.id === teamId)
    if (!team) return

    const overId = String(over.id)

    // Dropped on a division target: "div-{programId}-{divisionName}"
    if (overId.startsWith('div-')) {
      const parts = overId.split('-')
      const targetProgId = parts[1] === 'null' ? null : Number(parts[1])
      const targetDiv = parts.slice(2).join('-')

      // Skip if same location
      if (team.division === targetDiv && team.program_id === targetProgId) return

      const sb = createClient()
      const updates: Record<string, unknown> = {}

      if (team.division !== targetDiv) updates.division = targetDiv
      if (team.program_id !== targetProgId) updates.program_id = targetProgId

      const { error } = await sb.from('teams').update(updates).eq('id', teamId)
      if (error) {
        toast.error(error.message)
        return
      }

      // Update program_teams for backwards compat
      if (team.program_id !== targetProgId) {
        await sb.from('program_teams').delete().eq('team_id', teamId)
        if (targetProgId) {
          await sb.from('program_teams').insert({
            event_id: eventId,
            program_id: targetProgId,
            team_id: teamId,
            division: targetDiv,
          })
        }
      }

      const movedDesc: string[] = []
      if (team.division !== targetDiv) movedDesc.push(`division → ${targetDiv}`)
      if (team.program_id !== targetProgId) {
        const progName = targetProgId
          ? (programs.find((p) => p.id === targetProgId)?.name ?? 'Unknown')
          : 'Unassigned'
        movedDesc.push(`program → ${progName}`)
      }
      toast.success(`${team.name} moved: ${movedDesc.join(', ')}`)
      load()
      return
    }

    // Dropped on a program target: "prog-{programId}"
    if (overId.startsWith('prog-')) {
      const targetProgId = overId === 'prog-null' ? null : Number(overId.split('-')[1])
      if (team.program_id === targetProgId) return

      const sb = createClient()
      const { error } = await sb.from('teams').update({ program_id: targetProgId }).eq('id', teamId)
      if (error) {
        toast.error(error.message)
        return
      }

      // Update program_teams
      await sb.from('program_teams').delete().eq('team_id', teamId)
      if (targetProgId) {
        await sb.from('program_teams').insert({
          event_id: eventId,
          program_id: targetProgId,
          team_id: teamId,
          division: team.division,
        })
      }

      const progName = targetProgId
        ? (programs.find((p) => p.id === targetProgId)?.name ?? 'Unknown')
        : 'Unassigned'
      toast.success(`${team.name} moved to ${progName}`)
      load()
    }
  }

  function openEditProgram(prog: Program) {
    setEditForm({
      name: prog.name,
      short_name: prog.short_name ?? '',
      city: prog.city ?? '',
      state: prog.state ?? '',
      contact_name: prog.contact_name,
      contact_email: prog.contact_email,
      contact_phone: prog.contact_phone ?? '',
      website: prog.website ?? '',
      notes: prog.notes ?? '',
    })
    setEditingProgram(prog)
  }

  async function updateProgram() {
    if (!editingProgram) return
    if (!editForm.name || !editForm.contact_name || !editForm.contact_email) {
      toast.error('Name, contact name, and contact email are required')
      return
    }
    setSavingEdit(true)
    const sb = createClient()
    const { error, data: updated } = await sb
      .from('programs')
      .update({
        name: editForm.name,
        short_name: editForm.short_name || null,
        city: editForm.city || null,
        state: editForm.state || null,
        contact_name: editForm.contact_name,
        contact_email: editForm.contact_email,
        contact_phone: editForm.contact_phone || null,
        website: editForm.website || null,
        notes: editForm.notes || null,
      })
      .eq('id', editingProgram.id)
      .select()
    if (error) {
      toast.error(error.message)
    } else if (!updated || updated.length === 0) {
      toast.error('Update failed — you may not have permission to edit this program')
    } else {
      toast.success(`Program "${editForm.name}" updated`)
      setEditingProgram(null)
      load()
    }
    setSavingEdit(false)
  }

  async function sendRegistrationLink(prog: Program) {
    const eventName = state.event?.name ?? 'our event'
    if (!prog.contact_email) {
      toast.error('No contact email set for this program')
      return
    }
    if (!eventId) {
      toast.error('No event selected')
      return
    }

    // Generate or retrieve a program invite token
    const res = await fetch('/api/program-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: prog.id, event_id: eventId }),
    })
    if (!res.ok) {
      toast.error('Failed to generate registration link')
      return
    }
    const { token } = await res.json()
    const portalUrl = `${window.location.origin}/program/${token}`
    const subject = encodeURIComponent(`${eventName} — Your Program Portal`)
    const body = encodeURIComponent(
      `Hi ${prog.contact_name || 'there'},\n\nHere is your program management link for ${eventName}:\n\n${portalUrl}\n\nWith this link you can:\n• View and edit your program details\n• Add or remove teams\n• Create a Program Leader account for full access in LeagueOps\n\nThank you!`
    )
    window.open(`mailto:${prog.contact_email}?subject=${subject}&body=${body}`, '_blank')
    toast.success('Registration link generated — email window opened')
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
    if (programs.some((p) => p.name.toLowerCase() === newProgram.name.trim().toLowerCase())) {
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
      setNewProgram({
        name: '',
        short_name: '',
        city: '',
        state: '',
        contact_name: '',
        contact_email: '',
      })
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
    if (
      teams.some(
        (t) =>
          t.name.toLowerCase() === newTeam.name.trim().toLowerCase() &&
          t.division.toLowerCase() === newTeam.division.trim().toLowerCase()
      )
    ) {
      toast.error(`Team "${newTeam.name}" already exists in division "${newTeam.division}"`)
      return
    }
    setCreatingTeam(true)
    const sb = createClient()
    const programId = newTeam.program_id ? Number(newTeam.program_id) : null
    const { data: insertedTeam, error } = await sb
      .from('teams')
      .insert({
        event_id: eventId,
        name: newTeam.name,
        division: newTeam.division,
        association: newTeam.association || null,
        color: newTeam.color || '#0B3D91',
        program_id: programId,
      })
      .select()
      .single()
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

  function downloadTemplate(type: 'programs' | 'teams') {
    const headers =
      type === 'programs'
        ? 'name,short_name,city,state,contact_name,contact_email'
        : 'name,division,program,color'
    const example =
      type === 'programs'
        ? '\nMetro FC,MFC,Springfield,IL,John Smith,john@metro.com'
        : '\nMetro FC Blue,U12 Boys,Metro FC,#0B3D91'
    const blob = new Blob([headers + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- CSV Export ---
  function exportProgramsCSV() {
    const headers = [
      'display_id',
      'name',
      'short_name',
      'city',
      'state',
      'contact_name',
      'contact_email',
      'status',
    ]
    const csvRows = [headers.join(',')]
    for (const p of programs) {
      csvRows.push(
        headers
          .map((h) => {
            const val = (p as any)[h] ?? ''
            return `"${String(val).replace(/"/g, '""')}"`
          })
          .join(',')
      )
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `programs_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportTeamsCSV() {
    const headers = ['display_id', 'name', 'division', 'program', 'association', 'color']
    const csvRows = [headers.join(',')]
    for (const t of teams) {
      const progName = t.programs?.name ?? ''
      csvRows.push(
        [
          `"${String(t.display_id ?? '').replace(/"/g, '""')}"`,
          `"${String(t.name).replace(/"/g, '""')}"`,
          `"${String(t.division).replace(/"/g, '""')}"`,
          `"${String(progName).replace(/"/g, '""')}"`,
          `"${String(t.association ?? '').replace(/"/g, '""')}"`,
          `"${String(t.color ?? '').replace(/"/g, '""')}"`,
        ].join(',')
      )
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teams_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCSVFile(file: File, type: 'programs' | 'teams') {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) {
        toast.error('CSV must have a header row and at least one data row')
        return
      }

      const headers = parsed[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'))
      const expectedCols =
        type === 'programs'
          ? ['name', 'short_name', 'city', 'state', 'contact_name', 'contact_email']
          : ['name', 'division']

      const rows: Record<string, string>[] = []
      const warnings: string[] = []

      // Check header match
      const missing = expectedCols.filter((c) => !headers.includes(c))
      if (missing.length > 0)
        warnings.push(`Missing columns: ${missing.join(', ')} — those fields will be empty`)

      for (let i = 1; i < parsed.length; i++) {
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => {
          obj[h] = parsed[i][idx] || ''
        })
        // Validate required fields
        if (!obj.name) {
          warnings.push(`Row ${i}: missing name — will skip`)
          continue
        }
        if (type === 'programs' && !obj.contact_name && !obj.contact_email) {
          warnings.push(`Row ${i} (${obj.name}): missing contact_name and contact_email`)
        }
        if (type === 'teams' && !obj.division) {
          warnings.push(`Row ${i} (${obj.name}): missing division`)
        }
        rows.push(obj)
      }

      if (rows.length === 0) {
        toast.error('No valid rows found in CSV')
        return
      }

      // Fuzzy match divisions for teams CSV
      if (type === 'teams') {
        const divCandidates = divisions.map((d) => ({ id: d, name: d }))
        const divVals = rows.map((r) => r.division).filter(Boolean)
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
    setCsvMismatches((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, resolvedTo: value || null } : m))
    )
  }

  async function importCSV() {
    if (!csvPreview) return
    if (unresolvedMismatches.length > 0) {
      toast.error('Resolve all mismatches before importing')
      return
    }
    setImporting(true)
    const sb = createClient()

    // Create new divisions first
    if (divsToCreate.length > 0 && eventId) {
      const maxSort = divisions.length > 0 ? divisions.length + 1 : 1
      const divInserts = divsToCreate.map((m, idx) => ({
        event_id: eventId,
        name: m.csvValue,
        is_active: true,
        sort_order: maxSort + idx,
      }))
      const { error: divErr } = await sb
        .from('registration_divisions')
        .upsert(divInserts, { onConflict: 'event_id,name' })
      if (divErr) {
        toast.error(`Failed to create divisions: ${divErr.message}`)
        setImporting(false)
        return
      }
      toast.success(`${divInserts.length} division${divInserts.length !== 1 ? 's' : ''} created`)
    }

    // Build resolved division map from mismatches
    const resolvedDivMap = new Map<string, string>()
    for (const m of csvMismatches) {
      if (m.resolvedTo && m.resolvedTo !== '__skip__' && m.resolvedTo !== '__create__') {
        resolvedDivMap.set(m.csvValue.toLowerCase().trim(), m.resolvedTo)
      }
      // For __create__, use the original CSV value as the division name
      if (m.resolvedTo === '__create__') {
        resolvedDivMap.set(m.csvValue.toLowerCase().trim(), m.csvValue)
      }
    }

    try {
      if (csvPreview.type === 'programs') {
        const existingNames = new Set(programs.map((p) => p.name.toLowerCase()))
        const seen = new Set<string>()
        const inserts = csvPreview.rows
          .filter((r) => {
            const key = r.name.trim().toLowerCase()
            if (existingNames.has(key) || seen.has(key)) return false
            seen.add(key)
            return true
          })
          .map((r) => ({
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
        if (inserts.length === 0) {
          toast.error('All programs already exist')
          setImporting(false)
          return
        }
        const { error } = await sb.from('programs').insert(inserts)
        if (error) throw error
        toast.success(
          `${inserts.length} program${inserts.length !== 1 ? 's' : ''} imported${skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}`
        )
      } else {
        // Build program name -> id lookup for fuzzy matching
        const progNameMap = new Map<string, number>()
        for (const p of programs) {
          progNameMap.set(p.name.toLowerCase().trim(), p.id)
          if (p.short_name) progNameMap.set(p.short_name.toLowerCase().trim(), p.id)
        }

        const existingKeys = new Set(
          teams.map((t) => `${t.name.toLowerCase()}|${t.division.toLowerCase()}`)
        )
        const seen = new Set<string>()
        const rowsToImport = csvPreview.rows.filter(
          (r) => !skippedCsvValues.has((r.division || '').toLowerCase().trim())
        )
        const inserts = rowsToImport
          .filter((r) => {
            const resolvedDiv =
              resolvedDivMap.get((r.division || '').toLowerCase().trim()) || r.division || ''
            const key = `${r.name.trim().toLowerCase()}|${resolvedDiv.toLowerCase()}`
            if (existingKeys.has(key) || seen.has(key)) return false
            seen.add(key)
            return true
          })
          .map((r) => {
            const resolvedDiv =
              resolvedDivMap.get((r.division || '').toLowerCase().trim()) || r.division || ''
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
        if (inserts.length === 0) {
          toast.error('All teams already exist')
          setImporting(false)
          return
        }

        // Insert teams
        const { data: insertedTeams, error } = await sb
          .from('teams')
          .insert(inserts)
          .select('id, program_id, division')
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

        toast.success(
          `${inserts.length} team${inserts.length !== 1 ? 's' : ''} imported${skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}`
        )
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
  const totalSelected = selectedTeamIds.size + selectedProgramIds.size

  // --- Inline sub-components for DnD ---
  function DraggableTeamRow({ team, children }: { team: TeamRow; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: team.id })
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-white/5 transition-colors',
          isDragging && 'opacity-40'
        )}
      >
        {bulkMode ? (
          <button
            onClick={() => toggleTeamSelection(team.id)}
            className="flex-shrink-0 text-muted hover:text-white"
          >
            {selectedTeamIds.has(team.id) ? (
              <CheckSquare size={14} className="text-blue-400" />
            ) : (
              <Square size={14} />
            )}
          </button>
        ) : (
          <div
            {...listeners}
            {...attributes}
            className="flex-shrink-0 text-muted hover:text-white cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={14} />
          </div>
        )}
        {children}
      </div>
    )
  }

  function DroppableZone({
    id,
    children,
    className,
  }: {
    id: string
    children: React.ReactNode
    className?: string
  }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
      <div
        ref={setNodeRef}
        className={cn(
          className,
          isOver && draggedTeam && 'border-2 border-dashed border-blue-500/50 bg-blue-900/10'
        )}
      >
        {children}
      </div>
    )
  }

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
                    onClick={() => {
                      setShowCreateProgram(!showCreateProgram)
                      setShowCreateTeam(false)
                    }}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD PROGRAM
                  </Btn>
                  <Btn
                    size="sm"
                    variant={showCreateTeam ? 'ghost' : 'primary'}
                    onClick={() => {
                      setShowCreateTeam(!showCreateTeam)
                      setShowCreateProgram(false)
                    }}
                  >
                    <Plus size={11} className="inline mr-1" />
                    ADD TEAM
                  </Btn>
                  <Btn
                    size="sm"
                    variant={bulkMode ? 'danger' : 'ghost'}
                    onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
                  >
                    <Trash2 size={11} className="inline mr-1" />
                    {bulkMode ? 'EXIT BULK' : 'BULK DELETE'}
                  </Btn>
                  <div className="border-l border-border h-5 mx-1" />
                  <Btn size="sm" variant="ghost" onClick={() => programFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT PROGRAMS
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => teamFileRef.current?.click()}>
                    <Upload size={11} className="inline mr-1" /> IMPORT TEAMS
                  </Btn>
                  <div className="border-l border-border h-5 mx-1" />
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={exportProgramsCSV}
                    disabled={programs.length === 0}
                  >
                    <Download size={11} className="inline mr-1" /> PROGRAMS CSV
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={exportTeamsCSV}
                    disabled={teams.length === 0}
                  >
                    <Download size={11} className="inline mr-1" /> TEAMS CSV
                  </Btn>
                  <button
                    onClick={() => downloadTemplate('programs')}
                    className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Download size={10} /> Prog Template
                  </button>
                  <button
                    onClick={() => downloadTemplate('teams')}
                    className="font-cond text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Download size={10} /> Team Template
                  </button>
                  <input
                    ref={programFileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'programs')
                      e.target.value = ''
                    }}
                  />
                  <input
                    ref={teamFileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleCSVFile(e.target.files[0], 'teams')
                      e.target.value = ''
                    }}
                  />
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
                          onChange={(e) =>
                            setNewProgram({ ...newProgram, short_name: e.target.value })
                          }
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
                          onChange={(e) =>
                            setNewProgram({ ...newProgram, contact_name: e.target.value })
                          }
                        />
                      </FormField>
                      <FormField label="Contact Email *">
                        <Input
                          type="email"
                          value={newProgram.contact_email}
                          onChange={(e) =>
                            setNewProgram({ ...newProgram, contact_email: e.target.value })
                          }
                        />
                      </FormField>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Btn
                        size="sm"
                        variant="success"
                        onClick={createProgram}
                        disabled={creatingProgram}
                      >
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
                              <option key={d} value={d}>
                                {d}
                              </option>
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
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
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
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                    <DroppableZone
                      id={`prog-${prog.id}`}
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
                          {bulkMode && (
                            <button
                              onClick={() => toggleProgramSelection(prog.id)}
                              className="flex-shrink-0 mt-1 text-muted hover:text-white"
                            >
                              {selectedProgramIds.has(prog.id) ? (
                                <CheckSquare size={16} className="text-blue-400" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <button
                                onClick={() => toggleProgram(prog.id)}
                                className="text-muted hover:text-white transition-colors"
                              >
                                <ChevronRight
                                  size={16}
                                  className={cn(
                                    'transition-transform',
                                    !isCollapsed && 'rotate-90'
                                  )}
                                />
                              </button>
                              <ProgramLogoCell
                                programId={prog.id}
                                logoUrl={prog.logo_url}
                                onUploaded={load}
                              />
                              {prog.display_id && (
                                <span className="font-mono text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
                                  {prog.display_id}
                                </span>
                              )}
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
                              onClick={() => openEditProgram(prog)}
                              className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-blue-300/70 hover:text-blue-300 hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Pencil size={12} /> EDIT
                            </button>
                            <button
                              onClick={() => sendRegistrationLink(prog)}
                              className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-green-400/70 hover:text-green-400 hover:bg-green-900/20 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Mail size={12} /> SEND REG LINK
                            </button>
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
                            <DroppableZone id={`div-${prog.id}-${div}`} key={div}>
                              <div className="px-4 py-1.5 bg-navy/30 border-b border-border/30 flex items-center gap-2">
                                <span className="font-cond text-[10px] font-black tracking-widest text-blue-300 uppercase">
                                  {div}
                                </span>
                                <span className="font-cond text-[10px] text-muted">
                                  {divTeams.length} team{divTeams.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {divTeams.map((team) => (
                                <DraggableTeamRow key={team.id} team={team}>
                                  <TeamLogoCell
                                    teamId={team.id}
                                    teamLogoUrl={team.logo_url}
                                    programLogoUrl={prog.logo_url}
                                    color={team.color}
                                    onUploaded={load}
                                  />
                                  {team.display_id && (
                                    <span className="font-mono text-[9px] text-muted">
                                      {team.display_id}
                                    </span>
                                  )}
                                  <span className="font-cond font-bold text-[12px] text-white flex-1">
                                    {team.name}
                                  </span>
                                  {conflictsByTeam.has(team.id) && (
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        onClick={() =>
                                          setExpandedConflict((prev) => {
                                            const n = new Set(prev)
                                            n.has(team.id) ? n.delete(team.id) : n.add(team.id)
                                            return n
                                          })
                                        }
                                        aria-label={`Coach conflict: ${conflictsByTeam
                                          .get(team.id)
                                          ?.map((c) => c.coachName)
                                          .join(', ')} also assigned to other teams`}
                                      >
                                        <Pill variant="yellow">COACH CONFLICT</Pill>
                                      </button>
                                      {expandedConflict.has(team.id) &&
                                        conflictsByTeam.get(team.id)?.map((c, i) => (
                                          <span key={i} className="text-[11px] text-[#5a6e9a]">
                                            Coach {c.coachName} is also assigned to other teams
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                  <span className="font-cond text-[10px] text-muted">
                                    {team.association || ''}
                                  </span>
                                  {!bulkMode && (
                                    <button
                                      onClick={() => deleteTeam(team)}
                                      disabled={deletingId === team.id}
                                      className="flex items-center gap-1 font-cond text-[10px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </DraggableTeamRow>
                              ))}
                            </DroppableZone>
                          ))}
                        </div>
                      )}

                      {!isCollapsed && progTeams.length === 0 && (
                        <div className="border-t border-border/50 bg-navy/20 px-4 py-3">
                          <span className="font-cond text-[11px] text-muted italic">
                            No teams yet — drag teams here
                          </span>
                        </div>
                      )}
                    </DroppableZone>
                  )
                })}

                {/* Unassigned Teams */}
                {unassignedTeams.length > 0 && (
                  <DroppableZone
                    id="prog-null"
                    className="bg-surface-card border border-border rounded-xl overflow-hidden"
                  >
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
                      {Array.from(groupByDivision(unassignedTeams).entries()).map(
                        ([div, divTeams]) => (
                          <DroppableZone id={`div-null-${div}`} key={div}>
                            <div className="px-4 py-1.5 bg-navy/30 border-b border-border/30 flex items-center gap-2">
                              <span className="font-cond text-[10px] font-black tracking-widest text-blue-300 uppercase">
                                {div}
                              </span>
                              <span className="font-cond text-[10px] text-muted">
                                {divTeams.length} team{divTeams.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {divTeams.map((team) => (
                              <DraggableTeamRow key={team.id} team={team}>
                                <TeamLogoCell
                                  teamId={team.id}
                                  teamLogoUrl={team.logo_url}
                                  programLogoUrl={null}
                                  color={team.color}
                                  onUploaded={load}
                                />
                                <span className="font-cond font-bold text-[12px] text-white flex-1">
                                  {team.name}
                                </span>
                                {conflictsByTeam.has(team.id) && (
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() =>
                                        setExpandedConflict((prev) => {
                                          const n = new Set(prev)
                                          n.has(team.id) ? n.delete(team.id) : n.add(team.id)
                                          return n
                                        })
                                      }
                                      aria-label={`Coach conflict: ${conflictsByTeam
                                        .get(team.id)
                                        ?.map((c) => c.coachName)
                                        .join(', ')} also assigned to other teams`}
                                    >
                                      <Pill variant="yellow">COACH CONFLICT</Pill>
                                    </button>
                                    {expandedConflict.has(team.id) &&
                                      conflictsByTeam.get(team.id)?.map((c, i) => (
                                        <span key={i} className="text-[11px] text-[#5a6e9a]">
                                          Coach {c.coachName} is also assigned to other teams
                                        </span>
                                      ))}
                                  </div>
                                )}
                                <span className="font-cond text-[10px] text-muted">
                                  {team.association || ''}
                                </span>
                                {!bulkMode && (
                                  <button
                                    onClick={() => deleteTeam(team)}
                                    disabled={deletingId === team.id}
                                    className="flex items-center gap-1 font-cond text-[10px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </DraggableTeamRow>
                            ))}
                          </DroppableZone>
                        )
                      )}
                    </div>
                  </DroppableZone>
                )}

                {/* Also show unassigned drop target when no unassigned teams exist but dragging */}
                {unassignedTeams.length === 0 && draggedTeam && (
                  <DroppableZone
                    id="prog-null"
                    className="bg-surface-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-muted" />
                        <span className="font-cond font-black text-[14px] text-muted italic">
                          Drop here to unassign from program
                        </span>
                      </div>
                    </div>
                  </DroppableZone>
                )}

                {/* DragOverlay */}
                <DragOverlay>
                  {draggedTeam && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-surface-card border border-blue-500 rounded-lg shadow-xl shadow-blue-500/20">
                      <GripVertical size={14} className="text-blue-400" />
                      {draggedTeam.color && (
                        <div
                          className="w-3.5 h-3.5 rounded-sm border border-border flex-shrink-0"
                          style={{ backgroundColor: draggedTeam.color }}
                        />
                      )}
                      <span className="font-cond font-bold text-[12px] text-white">
                        {draggedTeam.name}
                      </span>
                      <span className="font-cond text-[10px] text-muted">
                        {draggedTeam.division}
                      </span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

              <div className="mt-2 font-cond text-[10px] text-muted">
                {programs.length} programs, {teams.length} teams total ({unassignedTeams.length}{' '}
                unassigned)
              </div>
            </div>
          )}
          {activeTab === 'config' && <RegistrationConfig />}
        </>
      )}

      {/* Bulk Delete Floating Bar */}
      {bulkMode && totalSelected > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-surface-card border border-border rounded-xl px-6 py-3 shadow-2xl shadow-black/50">
          <span className="font-cond font-bold text-[13px] text-white">
            {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
          </span>
          <Btn size="sm" variant="danger" onClick={() => setShowBulkConfirm(true)}>
            <Trash2 size={12} className="inline mr-1" /> DELETE SELECTED
          </Btn>
          <Btn size="sm" variant="ghost" onClick={exitBulkMode}>
            CANCEL
          </Btn>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <Modal
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        title="Confirm Bulk Delete"
        footer={
          <div className="flex justify-end gap-2">
            <Btn size="sm" variant="ghost" onClick={() => setShowBulkConfirm(false)}>
              CANCEL
            </Btn>
            <Btn size="sm" variant="danger" onClick={bulkDelete} disabled={bulkDeleting}>
              {bulkDeleting
                ? 'DELETING...'
                : `DELETE ${totalSelected} ITEM${totalSelected !== 1 ? 'S' : ''}`}
            </Btn>
          </div>
        }
      >
        <div className="space-y-2 text-[13px]">
          <p className="text-white font-cond">This action cannot be undone.</p>
          {selectedProgramIds.size > 0 && (
            <p className="text-red-400 font-cond">
              {selectedProgramIds.size} program{selectedProgramIds.size !== 1 ? 's' : ''} and all
              their teams will be permanently deleted.
            </p>
          )}
          {selectedTeamIds.size > 0 && (
            <p className="text-red-400 font-cond">
              {selectedTeamIds.size} team{selectedTeamIds.size !== 1 ? 's' : ''} will be permanently
              deleted.
            </p>
          )}
        </div>
      </Modal>

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-cond font-black text-[14px] text-white tracking-wider">
                IMPORT {csvPreview.type === 'programs' ? 'PROGRAMS' : 'TEAMS'} —{' '}
                {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''}
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
                  <div key={i} className="font-cond text-[11px] text-yellow-300/80">
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Mismatch Resolver */}
            {csvMismatches.length > 0 && (
              <div className="px-5 py-3 bg-yellow-900/20 border-b border-yellow-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-yellow-400 font-cond text-sm font-bold">
                    {csvMismatches.length} UNMATCHED{' '}
                    {csvMismatches[0]?.column?.toUpperCase() ?? 'VALUE'}
                    {csvMismatches.length !== 1 ? 'S' : ''}
                    <span className="text-muted font-normal ml-2">
                      Resolved: {csvMismatches.filter((m) => m.resolvedTo !== null).length}/
                      {csvMismatches.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCsvMismatches((prev) =>
                          prev.map((m) => ({ ...m, resolvedTo: '__create__' }))
                        )
                      }
                      className="font-cond text-[10px] font-black tracking-wider px-3 py-1 rounded border border-green-700/50 bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors"
                    >
                      AUTO-CREATE ALL
                    </button>
                    <button
                      onClick={() =>
                        setCsvMismatches((prev) =>
                          prev.map((m) => ({
                            ...m,
                            resolvedTo:
                              m.suggestions.length > 0 ? String(m.suggestions[0].id) : '__create__',
                          }))
                        )
                      }
                      className="font-cond text-[10px] font-black tracking-wider px-3 py-1 rounded border border-blue-700/50 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors"
                    >
                      BEST MATCH ALL
                    </button>
                    <button
                      onClick={() =>
                        setCsvMismatches((prev) =>
                          prev.map((m) => ({ ...m, resolvedTo: '__skip__' }))
                        )
                      }
                      className="font-cond text-[10px] font-black tracking-wider px-3 py-1 rounded border border-border bg-surface-card text-muted hover:text-white transition-colors"
                    >
                      SKIP ALL
                    </button>
                  </div>
                </div>
                {csvMismatches.map((mismatch, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 py-1.5 px-2 rounded mb-1',
                      mismatch.resolvedTo === '__create__'
                        ? 'bg-green-900/10'
                        : mismatch.resolvedTo === '__skip__'
                          ? 'bg-surface-card/30 opacity-60'
                          : mismatch.resolvedTo
                            ? 'bg-blue-900/10'
                            : ''
                    )}
                  >
                    <span className="font-cond text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#1a2d50] text-muted uppercase">
                      {mismatch.column}
                    </span>
                    <span className="text-red-400 text-xs font-mono min-w-[100px]">
                      {mismatch.csvValue}
                    </span>
                    <span className="text-gray-500 text-xs">&rarr;</span>

                    {/* Radio: Create */}
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`mismatch-${i}`}
                        checked={mismatch.resolvedTo === '__create__'}
                        onChange={() => resolveCsvMismatch(i, '__create__')}
                        className="accent-green-500"
                      />
                      <span className="font-cond text-[10px] font-bold text-green-400">CREATE</span>
                    </label>

                    {/* Radio: Map */}
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`mismatch-${i}`}
                        checked={
                          mismatch.resolvedTo !== null &&
                          mismatch.resolvedTo !== '__skip__' &&
                          mismatch.resolvedTo !== '__create__'
                        }
                        onChange={() =>
                          resolveCsvMismatch(
                            i,
                            mismatch.suggestions[0] ? String(mismatch.suggestions[0].id) : ''
                          )
                        }
                        className="accent-blue-500"
                      />
                      <span className="font-cond text-[10px] font-bold text-blue-400">MAP:</span>
                    </label>
                    <select
                      className="bg-[#081428] border border-[#1a2d50] text-white px-2 py-0.5 rounded text-xs outline-none focus:border-blue-400 transition-colors max-w-[180px]"
                      value={
                        mismatch.resolvedTo !== '__skip__' && mismatch.resolvedTo !== '__create__'
                          ? (mismatch.resolvedTo ?? '')
                          : ''
                      }
                      onChange={(e) => resolveCsvMismatch(i, e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {mismatch.suggestions.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name} {s.score < 1 ? `(${Math.round(s.score * 100)}%)` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Radio: Skip */}
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`mismatch-${i}`}
                        checked={mismatch.resolvedTo === '__skip__'}
                        onChange={() => resolveCsvMismatch(i, '__skip__')}
                        className="accent-gray-500"
                      />
                      <span className="font-cond text-[10px] font-bold text-muted">SKIP</span>
                    </label>

                    {mismatch.resolvedTo === '__create__' && (
                      <CheckCircle size={12} className="text-green-400" />
                    )}
                    {mismatch.resolvedTo === '__skip__' && (
                      <XCircle size={12} className="text-muted" />
                    )}
                    {mismatch.resolvedTo &&
                      mismatch.resolvedTo !== '__skip__' &&
                      mismatch.resolvedTo !== '__create__' && (
                        <CheckCircle size={12} className="text-blue-400" />
                      )}
                    {!mismatch.resolvedTo && (
                      <AlertTriangle size={12} className="text-yellow-400" />
                    )}
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
                    {Object.keys(csvPreview.rows[0] || {}).map((col) => (
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
                  {csvPreview.rows.map((row, i) => {
                    const divSkipped =
                      csvPreview.type === 'teams' &&
                      skippedCsvValues.has((row.division || '').toLowerCase().trim())
                    return (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-border/50',
                          divSkipped ? 'bg-red-900/10 opacity-50' : 'hover:bg-navy/20'
                        )}
                      >
                        <td className="font-cond text-muted py-1.5 pr-3">{i + 1}</td>
                        {Object.entries(row).map(([col, val], j) => {
                          const valLower = (val || '').toLowerCase().trim()
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
                                hasMismatch
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

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="font-cond text-[11px] text-muted">
                {csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''} will be
                imported
                {csvPreview.type === 'programs' ? ' with status=approved' : ` into current event`}
                {divsToCreate.length > 0 && (
                  <span className="text-green-400 ml-1">
                    ({divsToCreate.length} division{divsToCreate.length !== 1 ? 's' : ''} will be
                    created)
                  </span>
                )}
                {skippedCsvValues.size > 0 && (
                  <span className="text-red-400 ml-1">({skippedCsvValues.size} skipped)</span>
                )}
              </span>
              <div className="flex gap-2">
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCsvPreview(null)
                    setCsvMismatches([])
                  }}
                >
                  CANCEL
                </Btn>
                <Btn
                  size="sm"
                  variant="success"
                  onClick={importCSV}
                  disabled={importing || unresolvedMismatches.length > 0}
                >
                  {unresolvedMismatches.length > 0
                    ? `RESOLVE ${unresolvedMismatches.length} MISMATCH${unresolvedMismatches.length !== 1 ? 'ES' : ''}`
                    : importing
                      ? 'IMPORTING...'
                      : `IMPORT ${csvPreview.rows.length} ${csvPreview.type === 'programs' ? 'PROGRAM' : 'TEAM'}${csvPreview.rows.length !== 1 ? 'S' : ''}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      <Modal
        open={!!editingProgram}
        onClose={() => setEditingProgram(null)}
        title={`Edit Program — ${editingProgram?.name ?? ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Btn size="sm" variant="ghost" onClick={() => setEditingProgram(null)}>
              CANCEL
            </Btn>
            <Btn size="sm" onClick={updateProgram} disabled={savingEdit}>
              {savingEdit ? 'SAVING...' : 'SAVE CHANGES'}
            </Btn>
          </div>
        }
      >
        <div className="mb-3">
          <FormField label="Program Logo">
            <LogoUpload
              currentUrl={editingProgram?.logo_url ?? null}
              storagePath={`programs/${editingProgram?.id}/logo`}
              onUploaded={(url) => {
                if (editingProgram) {
                  const sb = createClient()
                  sb.from('programs').update({ logo_url: url }).eq('id', editingProgram.id)
                }
              }}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Program Name">
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Program name"
            />
          </FormField>
          <FormField label="Short Name">
            <Input
              value={editForm.short_name}
              onChange={(e) => setEditForm((f) => ({ ...f, short_name: e.target.value }))}
              placeholder="Abbreviation"
            />
          </FormField>
          <FormField label="City">
            <Input
              value={editForm.city}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="City"
            />
          </FormField>
          <FormField label="State">
            <Input
              value={editForm.state}
              onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
              placeholder="State"
            />
          </FormField>
          <FormField label="Contact Name">
            <Input
              value={editForm.contact_name}
              onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
              placeholder="Contact name"
            />
          </FormField>
          <FormField label="Contact Email">
            <Input
              value={editForm.contact_email}
              onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label="Contact Phone">
            <Input
              value={editForm.contact_phone}
              onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: e.target.value }))}
              placeholder="Phone number"
            />
          </FormField>
          <FormField label="Website">
            <Input
              value={editForm.website}
              onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://..."
            />
          </FormField>
        </div>
        <FormField label="Notes" className="mt-3">
          <Textarea
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes..."
          />
        </FormField>
      </Modal>
    </div>
  )
}

function ProgramLogoCell({
  programId,
  logoUrl,
  onUploaded,
}: {
  programId: number
  logoUrl: string | null
  onUploaded: () => void
}) {
  async function handleFile(file: File) {
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      toast.error('Image file under 2MB required')
      return
    }
    const sb = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `programs/${programId}/logo.${ext}`
    const { error } = await sb.storage
      .from('program-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      toast.error('Upload failed')
      return
    }
    const { data } = sb.storage.from('program-assets').getPublicUrl(path)
    await sb.from('programs').update({ logo_url: data.publicUrl }).eq('id', programId)
    toast.success('Program logo updated')
    onUploaded()
  }

  const uid = `prog-logo-${programId}`
  return (
    <>
      <input
        id={uid}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <label
        htmlFor={uid}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-border hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-center group"
        title="Click to upload program logo"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full bg-surface-card group-hover:bg-navy/40 transition-colors">
            <Upload size={11} className="text-muted group-hover:text-blue-300 transition-colors" />
          </div>
        )}
      </label>
    </>
  )
}

function TeamLogoCell({
  teamId,
  teamLogoUrl,
  programLogoUrl,
  color,
  onUploaded,
}: {
  teamId: number
  teamLogoUrl: string | null
  programLogoUrl: string | null
  color: string | null
  onUploaded: () => void
}) {
  async function handleFile(file: File) {
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      toast.error('Image file under 2MB required')
      return
    }
    const sb = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `teams/${teamId}/logo.${ext}`
    const { error } = await sb.storage
      .from('program-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      toast.error('Upload failed')
      return
    }
    const { data } = sb.storage.from('program-assets').getPublicUrl(path)
    await sb.from('teams').update({ logo_url: data.publicUrl }).eq('id', teamId)
    toast.success('Team logo updated')
    onUploaded()
  }

  const logoSrc = teamLogoUrl || programLogoUrl
  const uid = `team-logo-${teamId}`
  return (
    <>
      <input
        id={uid}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <label
        htmlFor={uid}
        className="flex-shrink-0 w-7 h-7 rounded overflow-hidden border border-border hover:border-blue-400 transition-colors cursor-pointer"
        title="Click to upload team logo"
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: color ?? '#0B3D91' }} />
        )}
      </label>
    </>
  )
}
