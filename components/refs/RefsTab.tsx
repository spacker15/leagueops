'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { Avatar, Pill, Modal, Btn, FormField } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { OperationalConflict, Referee, Volunteer, Game, RefereeAvailability } from '@/types'
import { createClient } from '@/supabase/client'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Shield,
  UserPlus,
  Trash2,
  Users,
  Calendar,
  Link2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type SubTab = 'board' | 'referees' | 'volunteers' | 'conflicts' | 'availability'
type PersonType = 'ref' | 'vol'

interface Assignment {
  id: number
  game_id: number
  referee_id?: number
  volunteer_id?: number
  role: string
  person_name: string
  person_type: PersonType
}

interface BlockAssignment {
  id: string
  person_id: number
  person_type: PersonType
  person_name: string
  field_id: number
  field_name: string
  from_time: string
  to_time: string
  role: string
  game_count: number
}

// ─── Draggable person chip ───────────────────────────────────
function DraggablePerson({
  id,
  name,
  role,
  type,
  checkedIn,
  small = false,
}: {
  id: string
  name: string
  role?: string
  type: PersonType
  checkedIn?: boolean
  small?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-1.5 rounded border cursor-grab active:cursor-grabbing select-none transition-all',
        small ? 'px-2 py-1' : 'px-2.5 py-1.5',
        type === 'ref'
          ? 'bg-red-900/20 border-red-800/50 text-red-200 hover:border-red-500/70'
          : 'bg-blue-900/20 border-blue-800/50 text-blue-200 hover:border-blue-500/70',
        isDragging && 'opacity-40',
        checkedIn && 'ring-1 ring-green-500/40'
      )}
      style={{ touchAction: 'none' }}
    >
      <div
        className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0',
          type === 'ref' ? 'bg-red-800/60 text-red-200' : 'bg-blue-800/60 text-blue-200'
        )}
      >
        {name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'font-cond font-bold leading-none truncate',
            small ? 'text-[10px]' : 'text-[11px]'
          )}
        >
          {name.split(' ')[0]} {name.split(' ')[1]?.[0]}.
        </div>
        {role && !small && (
          <div className="font-cond text-[9px] opacity-60 leading-none mt-0.5">{role}</div>
        )}
      </div>
      {checkedIn && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
    </div>
  )
}

// ─── Droppable game card ─────────────────────────────────────
function DroppableGameCard({
  game,
  assignments,
  onRemove,
  isOver,
}: {
  game: Game
  assignments: Assignment[]
  onRemove: (a: Assignment) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `game-${game.id}` })
  const refs = assignments.filter((a) => a.person_type === 'ref')
  const vols = assignments.filter((a) => a.person_type === 'vol')
  const noRef = refs.length === 0 && game.status !== 'Final'

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border transition-all mb-2',
        isOver
          ? 'border-blue-400 bg-blue-900/20 ring-1 ring-blue-400/50'
          : noRef
            ? 'border-red-800/50 bg-surface-card'
            : 'border-border bg-surface-card',
        game.status === 'Live' && 'border-green-700/60 bg-green-900/10',
        game.status === 'Final' && 'opacity-60',
        game.status === 'Delayed' && 'border-red-600/60'
      )}
    >
      {/* Card header */}
      <div
        className={cn(
          'px-2.5 py-1.5 flex justify-between items-center border-b border-border/50 rounded-t-md',
          game.status === 'Live' ? 'bg-green-900/20' : 'bg-navy/60'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-muted">#{game.id}</span>
          <span className="font-mono text-[10px] text-blue-300 font-bold">
            {game.scheduled_time}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-cond text-[9px] font-bold tracking-wider bg-blue-900/30 text-blue-300 px-1 py-0.5 rounded">
            {game.division}
          </span>
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
                      : 'badge-scheduled'
            )}
          >
            {game.status === 'Halftime' ? 'HALF' : game.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Matchup */}
      <div className="px-2.5 py-1.5">
        <div className="font-cond font-black text-[12px] text-white leading-tight mb-1.5">
          {game.home_team?.name ?? '?'}{' '}
          <span className="text-muted font-normal text-[10px]">vs</span>{' '}
          {game.away_team?.name ?? '?'}
        </div>

        {/* Drop zone hint */}
        {isOver && (
          <div className="text-center text-[10px] font-cond font-bold text-blue-300 py-1 border border-dashed border-blue-400/50 rounded mb-1.5">
            DROP TO ASSIGN
          </div>
        )}

        {/* Assigned refs */}
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {refs.map((a) => (
              <AssignedChip key={a.id} assignment={a} onRemove={onRemove} />
            ))}
          </div>
        )}

        {/* No ref warning */}
        {noRef && !isOver && (
          <div className="text-[9px] font-cond font-bold text-red-400/70 mb-1">⚠ NO REF</div>
        )}

        {/* Assigned vols */}
        {vols.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {vols.map((a) => (
              <AssignedChip key={a.id} assignment={a} onRemove={onRemove} />
            ))}
          </div>
        )}

        {/* Drop hint when empty */}
        {refs.length === 0 && vols.length === 0 && !isOver && game.status !== 'Final' && (
          <div className="text-[9px] text-muted font-cond text-center py-1 border border-dashed border-border/40 rounded">
            drag ref or volunteer here
          </div>
        )}
      </div>
    </div>
  )
}

function AssignedChip({
  assignment,
  onRemove,
}: {
  assignment: Assignment
  onRemove: (a: Assignment) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-cond font-bold border',
        assignment.person_type === 'ref'
          ? 'bg-red-900/25 border-red-800/50 text-red-200'
          : 'bg-blue-900/25 border-blue-800/50 text-blue-200'
      )}
    >
      <span>{assignment.person_name.split(' ')[0]}</span>
      <span className="opacity-60 text-[9px]">{assignment.role}</span>
      <button
        onClick={() => onRemove(assignment)}
        className="hover:text-white ml-0.5 opacity-60 hover:opacity-100"
      >
        <XCircle size={10} />
      </button>
    </div>
  )
}

// ─── Droppable field column header (block assignment) ────────
function DroppableFieldHeader({
  fieldId,
  fieldName,
  isOver,
}: {
  fieldId: number
  fieldName: string
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `field-${fieldId}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'text-center py-2 px-3 rounded-md mb-3 border-2 transition-all',
        isOver ? 'border-blue-400 bg-blue-900/30 text-white' : 'border-border bg-navy text-white'
      )}
    >
      <div className="font-cond font-black text-[13px] tracking-wide">{fieldName}</div>
      {isOver && (
        <div className="font-cond text-[9px] font-bold text-blue-300 mt-0.5 tracking-wide">
          DROP FOR BLOCK ASSIGN
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export function RefsTab() {
  const { state, toggleRefCheckin, toggleVolCheckin, currentDate, eventId } = useApp()
  if (!eventId) return null
  const [subTab, setSubTab] = useState<SubTab>('board')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [blockAssignments, setBlockAssignments] = useState<BlockAssignment[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIds, setOverIds] = useState<Set<string>>(new Set())
  const [conflicts, setConflicts] = useState<OperationalConflict[]>([])
  const [running, setRunning] = useState(false)
  const [engineResult, setEngineResult] = useState<string | null>(null)
  const [copyingInvite, setCopyingInvite] = useState<'referee' | 'volunteer' | null>(null)
  const [roleModal, setRoleModal] = useState<{
    personId: number
    personType: PersonType
    personName: string
    targetType: 'game' | 'field'
    targetId: number
    targetName: string
  } | null>(null)
  const [selectedRole, setSelectedRole] = useState('Center')
  const [blockFrom, setBlockFrom] = useState('08:00 AM')
  const [blockTo, setBlockTo] = useState('05:00 PM')
  const [blockGames, setBlockGames] = useState<number>(0)
  const [availModal, setAvailModal] = useState(false)
  const [selectedRef, setSelectedRef] = useState<Referee | null>(null)
  const [availability, setAvailability] = useState<RefereeAvailability[]>([])
  const [newDate, setNewDate] = useState('')
  const [newFrom, setNewFrom] = useState('07:30')
  const [newTo, setNewTo] = useState('17:00')

  // Load all assignments for today's games
  const loadAssignments = useCallback(async () => {
    if (!state.games.length) return
    const sb = createClient()
    const gameIds = state.games.map((g) => g.id)

    const [{ data: refs }, { data: vols }] = await Promise.all([
      sb.from('ref_assignments').select('*, referee:referees(*)').in('game_id', gameIds),
      sb.from('vol_assignments').select('*, volunteer:volunteers(*)').in('game_id', gameIds),
    ])

    const refAssigns: Assignment[] = (refs ?? []).map((r: any) => ({
      id: r.id,
      game_id: r.game_id,
      referee_id: r.referee_id,
      role: r.role,
      person_name: r.referee?.name ?? 'Unknown',
      person_type: 'ref',
    }))

    const volAssigns: Assignment[] = (vols ?? []).map((v: any) => ({
      id: v.id,
      game_id: v.game_id,
      volunteer_id: v.volunteer_id,
      role: v.volunteer?.role ?? 'Volunteer',
      person_name: v.volunteer?.name ?? 'Unknown',
      person_type: 'vol',
    }))

    setAssignments([...refAssigns, ...volAssigns])
  }, [state.games])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const loadConflicts = useCallback(async () => {
    if (!state.event?.id) return
    const sb = createClient()
    const { data } = await sb
      .from('operational_conflicts')
      .select('*')
      .eq('event_id', state.event.id)
      .eq('resolved', false)
      .order('severity', { ascending: false })
    setConflicts((data as OperationalConflict[]) ?? [])
  }, [state.event?.id])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  // Parse dragging id → person info
  function parseDragId(id: string) {
    const [type, idStr] = id.split('-')
    return { type: type as PersonType, id: Number(idStr) }
  }

  function getDraggingPerson(dragId: string) {
    const { type, id } = parseDragId(dragId)
    if (type === 'ref') {
      const ref = state.referees.find((r) => r.id === id)
      return ref ? { name: ref.name, type: 'ref' as PersonType, role: ref.grade_level } : null
    } else {
      const vol = state.volunteers.find((v) => v.id === id)
      return vol ? { name: vol.name, type: 'vol' as PersonType, role: vol.role } : null
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    setOverIds(new Set())
    const { over, active } = e
    if (!over) return

    const overId = String(over.id)
    const activeId = String(active.id)
    const { type: personType, id: personId } = parseDragId(activeId)
    const person = getDraggingPerson(activeId)
    if (!person) return

    if (overId.startsWith('game-')) {
      const gameId = Number(overId.replace('game-', ''))
      const game = state.games.find((g) => g.id === gameId)
      if (!game) return
      // Check not already assigned
      const already = assignments.find(
        (a) => a.game_id === gameId && (a.referee_id === personId || a.volunteer_id === personId)
      )
      if (already) {
        toast('Already assigned to this game')
        return
      }

      const defaultRole =
        personType === 'ref'
          ? assignments.filter((a) => a.game_id === gameId && a.person_type === 'ref').length === 0
            ? 'Center'
            : 'Trail'
          : (state.volunteers.find((v) => v.id === personId)?.role ?? 'Score Table')

      setRoleModal({
        personId,
        personType,
        personName: person.name,
        targetType: 'game',
        targetId: gameId,
        targetName: `Game #${gameId} — ${game.home_team?.name} vs ${game.away_team?.name}`,
      })
      setSelectedRole(defaultRole)
      // Set sensible block defaults
      setBlockGames(1)
    } else if (overId.startsWith('field-')) {
      const fieldId = Number(overId.replace('field-', ''))
      const field = state.fields.find((f) => f.id === fieldId)
      if (!field) return
      const fieldGames = state.games.filter((g) => g.field_id === fieldId && g.status !== 'Final')

      setRoleModal({
        personId,
        personType,
        personName: person.name,
        targetType: 'field',
        targetId: fieldId,
        targetName: `${field.name} (${fieldGames.length} games)`,
      })
      setSelectedRole(
        personType === 'ref'
          ? 'Center'
          : (state.volunteers.find((v) => v.id === personId)?.role ?? 'Score Table')
      )
      setBlockGames(fieldGames.length)
    }
  }

  async function confirmAssignment() {
    if (!roleModal) return
    const sb = createClient()
    const { personId, personType, personName, targetType, targetId } = roleModal

    if (targetType === 'game') {
      // Single game assignment
      if (personType === 'ref') {
        const { data, error } = await sb
          .from('ref_assignments')
          .upsert(
            { game_id: targetId, referee_id: personId, role: selectedRole },
            { onConflict: 'game_id,referee_id' }
          )
          .select()
          .single()
        if (error) {
          toast.error(error.message)
          return
        }
        setAssignments((prev) => [
          ...prev.filter((a) => !(a.game_id === targetId && a.referee_id === personId)),
          {
            id: (data as any).id,
            game_id: targetId,
            referee_id: personId,
            role: selectedRole,
            person_name: personName,
            person_type: 'ref',
          },
        ])
      } else {
        const { data, error } = await sb
          .from('vol_assignments')
          .upsert(
            { game_id: targetId, volunteer_id: personId },
            { onConflict: 'game_id,volunteer_id' }
          )
          .select()
          .single()
        if (error) {
          toast.error(error.message)
          return
        }
        setAssignments((prev) => [
          ...prev.filter((a) => !(a.game_id === targetId && a.volunteer_id === personId)),
          {
            id: (data as any).id,
            game_id: targetId,
            volunteer_id: personId,
            role: selectedRole,
            person_name: personName,
            person_type: 'vol',
          },
        ])
      }
      toast.success(`${personName} → Game #${targetId}`)
    } else {
      // Block assignment — assign to N games on this field
      const fieldGames = state.games
        .filter((g) => g.field_id === targetId && g.status !== 'Final')
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
        .slice(0, blockGames > 0 ? blockGames : undefined)

      let count = 0
      const newAssigns: Assignment[] = []
      for (const game of fieldGames) {
        const already = assignments.find(
          (a) =>
            a.game_id === game.id &&
            (personType === 'ref' ? a.referee_id === personId : a.volunteer_id === personId)
        )
        if (already) continue

        if (personType === 'ref') {
          const { data, error } = await sb
            .from('ref_assignments')
            .upsert(
              { game_id: game.id, referee_id: personId, role: selectedRole },
              { onConflict: 'game_id,referee_id' }
            )
            .select()
            .single()
          if (!error && data) {
            newAssigns.push({
              id: (data as any).id,
              game_id: game.id,
              referee_id: personId,
              role: selectedRole,
              person_name: personName,
              person_type: 'ref',
            })
            count++
          }
        } else {
          const { data, error } = await sb
            .from('vol_assignments')
            .upsert(
              { game_id: game.id, volunteer_id: personId },
              { onConflict: 'game_id,volunteer_id' }
            )
            .select()
            .single()
          if (!error && data) {
            newAssigns.push({
              id: (data as any).id,
              game_id: game.id,
              volunteer_id: personId,
              role: selectedRole,
              person_name: personName,
              person_type: 'vol',
            })
            count++
          }
        }
      }
      setAssignments((prev) => [...prev, ...newAssigns])

      // Save block assignment record for display
      const field = state.fields.find((f) => f.id === targetId)
      const blockId = `block-${Date.now()}`
      setBlockAssignments((prev) => [
        ...prev,
        {
          id: blockId,
          person_id: personId,
          person_type: personType,
          person_name: personName,
          field_id: targetId,
          field_name: field?.name ?? `Field ${targetId}`,
          from_time: fieldGames[0]?.scheduled_time ?? '',
          to_time: fieldGames[fieldGames.length - 1]?.scheduled_time ?? '',
          role: selectedRole,
          game_count: count,
        },
      ])

      toast.success(`${personName} assigned to ${count} games on ${field?.name}`)
    }

    // Log it
    await fetch('/api/ops-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        message: `${personName} (${selectedRole}) assigned → ${roleModal.targetName}`,
        log_type: 'ok',
      }),
    })

    setRoleModal(null)
  }

  async function removeAssignment(a: Assignment) {
    const sb = createClient()
    if (a.person_type === 'ref') {
      await sb.from('ref_assignments').delete().eq('id', a.id)
    } else {
      await sb.from('vol_assignments').delete().eq('id', a.id)
    }
    setAssignments((prev) => prev.filter((x) => x.id !== a.id))
    toast(`${a.person_name} removed`, { icon: '↩' })
  }

  async function removeBlockAssignment(block: BlockAssignment) {
    const sb = createClient()
    const gameIds = state.games.filter((g) => g.field_id === block.field_id).map((g) => g.id)
    if (block.person_type === 'ref') {
      await sb
        .from('ref_assignments')
        .delete()
        .in('game_id', gameIds)
        .eq('referee_id', block.person_id)
    } else {
      await sb
        .from('vol_assignments')
        .delete()
        .in('game_id', gameIds)
        .eq('volunteer_id', block.person_id)
    }
    setAssignments((prev) =>
      prev.filter(
        (a) =>
          !(
            gameIds.includes(a.game_id) &&
            (block.person_type === 'ref'
              ? a.referee_id === block.person_id
              : a.volunteer_id === block.person_id)
          )
      )
    )
    setBlockAssignments((prev) => prev.filter((b) => b.id !== block.id))
    toast(`${block.person_name} removed from ${block.field_name}`)
  }

  async function runEngine() {
    if (!currentDate) {
      toast.error('No event date selected')
      return
    }
    setRunning(true)
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
      if (data.clean) toast.success('✓ All assignments clear')
      else {
        toast(`${data.conflicts.length} conflicts`, { icon: '⚠️' })
        setSubTab('conflicts')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRunning(false)
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
      toast.success('Resolved')
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
    if (!selectedRef || !newDate) return
    const sb = createClient()
    await sb
      .from('referee_availability')
      .upsert(
        { referee_id: selectedRef.id, date: newDate, available_from: newFrom, available_to: newTo },
        { onConflict: 'referee_id,date' }
      )
    const { data } = await sb
      .from('referee_availability')
      .select('*')
      .eq('referee_id', selectedRef.id)
      .order('date')
    setAvailability((data as RefereeAvailability[]) ?? [])
    toast.success('Saved')
    setNewDate('')
  }

  async function copyInviteLink(type: 'referee' | 'volunteer') {
    setCopyingInvite(type)
    const sb = createClient()
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { error } = await sb
      .from('registration_invites')
      .insert({ event_id: eventId, type, token })
    if (error) {
      toast.error('Could not generate link')
      setCopyingInvite(null)
      return
    }
    const url = `${window.location.origin}/join/${token}`
    await navigator.clipboard.writeText(url)
    toast.success(`${type === 'referee' ? 'Referee' : 'Volunteer'} invite link copied!`)
    setCopyingInvite(null)
  }

  // Group games by field
  const fieldColumns = state.fields
    .map((field) => ({
      field,
      games: state.games
        .filter((g) => g.field_id === field.id)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
    }))
    .filter((fc) => fc.games.length > 0)

  const draggingPerson = draggingId ? getDraggingPerson(draggingId) : null
  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'board', label: 'Assignment Board' },
    { id: 'referees', label: 'Referees' },
    { id: 'volunteers', label: 'Volunteers' },
    {
      id: 'conflicts',
      label: conflicts.length > 0 ? `Conflicts (${conflicts.length})` : 'Conflicts',
    },
    { id: 'availability', label: 'Availability' },
  ]

  const REF_ROLES = ['Center', 'Trail', 'Lead', 'Table Official']
  const VOL_ROLES = ['Score Table', 'Clock', 'Field Marshal', 'Operations', 'Gate']

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 mb-3 border-b border-border">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              subTab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white',
              t.id === 'conflicts' && conflicts.length > 0 && subTab !== t.id && 'text-yellow-400'
            )}
          >
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

      {/* ═══ ASSIGNMENT BOARD ════════════════════════════════════ */}
      {subTab === 'board' && (
        <DndContext
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            if (e.over) setOverIds(new Set([String(e.over.id)]))
            else setOverIds(new Set())
          }}
        >
          <div className="flex gap-3 h-full" style={{ minHeight: 0 }}>
            {/* Left panel: refs + volunteers */}
            <div className="w-52 flex-shrink-0">
              {/* Instructions */}
              <div className="bg-navy/40 border border-border rounded-md p-2.5 mb-3 text-[10px] text-muted font-cond leading-relaxed">
                <div className="text-white font-bold mb-1">HOW TO ASSIGN</div>
                <div>
                  • Drag to a <span className="text-blue-300">game card</span> → single game
                </div>
                <div>
                  • Drag to a <span className="text-blue-300">field header</span> → all games on
                  that field
                </div>
                <div>• Set role + game count in the popup</div>
              </div>

              {/* Block assignments summary */}
              {blockAssignments.length > 0 && (
                <div className="mb-3">
                  <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-1.5">
                    BLOCK ASSIGNMENTS
                  </div>
                  {blockAssignments.map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        'flex items-start justify-between rounded border px-2 py-1.5 mb-1 text-[10px]',
                        b.person_type === 'ref'
                          ? 'bg-red-900/15 border-red-800/40'
                          : 'bg-blue-900/15 border-blue-800/40'
                      )}
                    >
                      <div>
                        <div className="font-cond font-bold text-[11px] text-white">
                          {b.person_name.split(' ')[0]}
                        </div>
                        <div className="text-muted">
                          {b.field_name} · {b.game_count} games
                        </div>
                        <div className="text-muted">{b.role}</div>
                      </div>
                      <button
                        onClick={() => removeBlockAssignment(b)}
                        className="text-muted hover:text-red-400 mt-0.5"
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Referees pool */}
              <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-1.5">
                REFEREES ({state.referees.filter((r) => r.checked_in).length}/
                {state.referees.length} IN)
              </div>
              <div className="flex flex-col gap-1 mb-4">
                {state.referees.map((ref) => (
                  <DraggablePerson
                    key={ref.id}
                    id={`ref-${ref.id}`}
                    name={ref.name}
                    role={ref.grade_level}
                    type="ref"
                    checkedIn={ref.checked_in}
                  />
                ))}
              </div>

              {/* Volunteers pool */}
              <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-1.5">
                VOLUNTEERS ({state.volunteers.filter((v) => v.checked_in).length}/
                {state.volunteers.length} IN)
              </div>
              <div className="flex flex-col gap-1">
                {state.volunteers.map((vol) => (
                  <DraggablePerson
                    key={vol.id}
                    id={`vol-${vol.id}`}
                    name={vol.name}
                    role={vol.role}
                    type="vol"
                    checkedIn={vol.checked_in}
                  />
                ))}
              </div>
            </div>

            {/* Field columns */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-3" style={{ minWidth: `${fieldColumns.length * 220}px` }}>
                {fieldColumns.map(({ field, games }) => (
                  <div key={field.id} className="flex-shrink-0" style={{ width: 210 }}>
                    {/* Field header — drop target for block assign */}
                    <DroppableFieldHeader
                      fieldId={field.id}
                      fieldName={field.name}
                      isOver={overIds.has(`field-${field.id}`)}
                    />

                    {/* Game cards */}
                    <div>
                      {games.map((game) => (
                        <DroppableGameCard
                          key={game.id}
                          game={game}
                          assignments={assignments.filter((a) => a.game_id === game.id)}
                          onRemove={removeAssignment}
                          isOver={overIds.has(`game-${game.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {draggingPerson && (
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded border shadow-2xl text-[11px] font-cond font-bold',
                  draggingPerson.type === 'ref'
                    ? 'bg-red-900/80 border-red-500 text-red-100'
                    : 'bg-blue-900/80 border-blue-500 text-blue-100'
                )}
              >
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black">
                  {draggingPerson.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                {draggingPerson.name.split(' ')[0]} {draggingPerson.name.split(' ')[1]?.[0]}.
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ═══ REFEREES TAB ════════════════════════════════════════ */}
      {subTab === 'referees' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="font-cond text-[11px] text-muted">
              {state.referees.length} referee{state.referees.length !== 1 ? 's' : ''} registered
            </div>
            <button
              onClick={() => copyInviteLink('referee')}
              disabled={!!copyingInvite}
              className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-wider px-3 py-1.5 rounded-lg bg-red/20 border border-red/40 text-red-300 hover:bg-red/30 transition-colors disabled:opacity-50"
            >
              <Link2 size={11} />
              {copyingInvite === 'referee' ? 'COPYING...' : 'COPY INVITE LINK'}
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
            {state.referees.map((ref) => {
              const rd = ref as any
              return (
                <div
                  key={ref.id}
                  className={cn(
                    'p-3 rounded-md border transition-all',
                    ref.checked_in
                      ? 'bg-green-900/10 border-green-800/40'
                      : 'bg-surface-card border-border'
                  )}
                >
                  <div className="flex gap-2 items-start mb-2">
                    <Avatar name={ref.name} variant="red" />
                    <div className="min-w-0 flex-1">
                      <div className="font-cond font-black text-[13px] truncate">{ref.name}</div>
                      <div className="font-cond text-[10px] text-muted">{ref.grade_level}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {ref.checked_in ? (
                      <Pill variant="green">CHECKED IN</Pill>
                    ) : (
                      <Pill variant="yellow">NOT IN</Pill>
                    )}
                    {rd.max_games_per_day && <Pill variant="gray">MAX {rd.max_games_per_day}</Pill>}
                  </div>
                  {rd.eligible_divisions?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(rd.eligible_divisions as string[]).map((d: string) => (
                        <span
                          key={d}
                          className="font-cond text-[9px] font-bold bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  {rd.certifications?.length > 0 && (
                    <div className="font-cond text-[9px] text-muted mb-2">
                      {(rd.certifications as string[]).join(' · ')}
                    </div>
                  )}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => toggleRefCheckin(ref.id)}
                      className="flex-1 font-cond text-[10px] font-bold tracking-wider py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors"
                    >
                      {ref.checked_in ? 'CHECK OUT' : 'CHECK IN'}
                    </button>
                    <button
                      onClick={() => openAvailability(ref)}
                      title="Availability"
                      className="font-cond text-[10px] font-bold px-2 py-1 rounded bg-surface border border-border text-muted hover:text-white hover:border-blue-400 transition-colors"
                    >
                      <Clock size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ VOLUNTEERS TAB ══════════════════════════════════════ */}
      {subTab === 'volunteers' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="font-cond text-[11px] text-muted">
              {state.volunteers.length} volunteer{state.volunteers.length !== 1 ? 's' : ''}{' '}
              registered
            </div>
            <button
              onClick={() => copyInviteLink('volunteer')}
              disabled={!!copyingInvite}
              className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-wider px-3 py-1.5 rounded-lg bg-blue-900/30 border border-blue-700/50 text-blue-300 hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            >
              <Link2 size={11} />
              {copyingInvite === 'volunteer' ? 'COPYING...' : 'COPY INVITE LINK'}
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 mb-6">
            {state.volunteers.map((vol) => (
              <div
                key={vol.id}
                onClick={() => toggleVolCheckin(vol.id)}
                className={cn(
                  'flex gap-2 items-start p-3 rounded-md border cursor-pointer transition-all',
                  vol.checked_in
                    ? 'bg-green-900/10 border-green-800/40'
                    : 'bg-surface-card border-border hover:border-blue-400'
                )}
              >
                <Avatar name={vol.name} variant="blue" />
                <div>
                  <div className="font-cond font-black text-[13px]">{vol.name}</div>
                  <div className="font-cond text-[10px] text-muted">{vol.role}</div>
                  <div className="mt-1.5">
                    {vol.checked_in ? (
                      <Pill variant="green">CHECKED IN</Pill>
                    ) : (
                      <Pill variant="yellow">NOT IN</Pill>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
            COVERAGE BY ROLE
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {['Score Table', 'Clock', 'Field Marshal', 'Operations', 'Gate'].map((role) => {
              const total = state.volunteers.filter((v) => v.role === role).length
              const checked = state.volunteers.filter((v) => v.role === role && v.checked_in).length
              if (total === 0) return null
              const pct = Math.round((checked / total) * 100)
              return (
                <div key={role} className="bg-surface-card border border-border rounded-md p-3">
                  <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-1">
                    {role}
                  </div>
                  <div
                    className={cn(
                      'font-mono text-xl font-bold',
                      pct === 100
                        ? 'text-green-400'
                        : pct >= 50
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    )}
                  >
                    {checked}/{total}
                  </div>
                  <div className="h-1 bg-white/10 rounded mt-2 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? '#22c55e' : pct >= 50 ? '#facc15' : '#f87171',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ CONFLICTS TAB ════════════════════════════════════════ */}
      {subTab === 'conflicts' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
              {conflicts.length === 0 ? (
                <span className="text-green-400">ALL CLEAR</span>
              ) : (
                <>
                  {criticalCount > 0 && (
                    <span className="text-red-400 mr-2">{criticalCount} CRITICAL</span>
                  )}
                  {conflicts.filter((c) => c.severity === 'warning').length > 0 && (
                    <span className="text-yellow-400">
                      {conflicts.filter((c) => c.severity === 'warning').length} WARNINGS
                    </span>
                  )}
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
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <ConflictCard key={c.id} conflict={c} onResolve={() => resolveConflict(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ AVAILABILITY TAB ════════════════════════════════════ */}
      {subTab === 'availability' && (
        <div>
          <div className="font-cond text-[11px] text-muted mb-4">
            Set availability windows per referee. The engine uses these to detect assignment
            conflicts.
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {state.referees.map((ref) => (
              <RefAvailCard key={ref.id} ref_={ref} onEdit={() => openAvailability(ref)} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ ROLE / BLOCK ASSIGNMENT MODAL ═══════════════════════ */}
      <Modal
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        title={roleModal?.targetType === 'field' ? 'BLOCK ASSIGN TO FIELD' : 'ASSIGN TO GAME'}
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setRoleModal(null)}>
              CANCEL
            </Btn>
            <Btn variant="primary" size="sm" onClick={confirmAssignment}>
              CONFIRM ASSIGNMENT
            </Btn>
          </>
        }
      >
        {roleModal && (
          <div>
            {/* Who → Where */}
            <div className="bg-surface-elevated rounded-md p-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-cond font-black text-sm flex-shrink-0',
                    roleModal.personType === 'ref'
                      ? 'bg-red-900/40 text-red-300'
                      : 'bg-blue-900/40 text-blue-300'
                  )}
                >
                  {roleModal.personName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="font-cond font-black text-[14px]">{roleModal.personName}</div>
                  <div className="font-cond text-[11px] text-muted">→ {roleModal.targetName}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Role">
                <select
                  className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {(roleModal.personType === 'ref' ? REF_ROLES : VOL_ROLES).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>

              {roleModal.targetType === 'field' && (
                <FormField label={`Games to cover (0 = all)`}>
                  <input
                    type="number"
                    min={0}
                    value={blockGames}
                    onChange={(e) => setBlockGames(Number(e.target.value))}
                    className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  />
                </FormField>
              )}
            </div>

            {roleModal.targetType === 'field' && (
              <div className="mt-3 text-[11px] text-muted font-cond">
                {blockGames === 0
                  ? `Will be assigned to ALL upcoming games on this field`
                  : `Will be assigned to the next ${blockGames} game${blockGames > 1 ? 's' : ''} on this field`}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ AVAILABILITY MODAL ══════════════════════════════════ */}
      <Modal
        open={availModal}
        onClose={() => setAvailModal(false)}
        title={`AVAILABILITY — ${selectedRef?.name ?? ''}`}
        footer={
          <Btn variant="ghost" size="sm" onClick={() => setAvailModal(false)}>
            CLOSE
          </Btn>
        }
      >
        {selectedRef && (
          <div>
            <div className="bg-surface-elevated rounded-md p-3 mb-4">
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                ADD / UPDATE WINDOW
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <FormField label="Date">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
                  />
                </FormField>
                <FormField label="From">
                  <input
                    type="time"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
                  />
                </FormField>
                <FormField label="To">
                  <input
                    type="time"
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    className="bg-surface-card border border-border text-white px-2 py-1.5 rounded text-[12px] outline-none focus:border-blue-400"
                  />
                </FormField>
              </div>
              <Btn variant="primary" size="sm" onClick={saveAvailability}>
                SAVE WINDOW
              </Btn>
            </div>
            {availability.length === 0 ? (
              <div className="text-center py-6 text-muted font-cond text-sm">No windows set</div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-navy">
                    {['DATE', 'FROM', 'TO', ''].map((h) => (
                      <th
                        key={h}
                        className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-1.5 text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availability.map((a) => (
                    <tr key={a.id} className="border-b border-border/40">
                      <td className="font-mono text-blue-300 text-[11px] px-3 py-2">{a.date}</td>
                      <td className="font-mono px-3 py-2">{a.available_from}</td>
                      <td className="font-mono px-3 py-2">{a.available_to}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={async () => {
                            const sb = createClient()
                            await sb.from('referee_availability').delete().eq('id', a.id)
                            setAvailability((prev) => prev.filter((x) => x.id !== a.id))
                          }}
                          className="text-muted hover:text-red-400"
                        >
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
function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: OperationalConflict
  onResolve: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const s = {
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
  const LABELS: Record<string, string> = {
    ref_double_booked: 'DOUBLE BOOKED',
    ref_unavailable: 'UNAVAILABLE',
    max_games_exceeded: 'MAX GAMES',
    missing_referee: 'MISSING REF',
    field_overlap: 'FIELD OVERLAP',
    weather_closure: 'WEATHER',
  }
  return (
    <div className={cn('border border-l-4 rounded-md p-3', s.border, s.bg)}>
      <div className="flex items-start gap-2">
        {s.icon}
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className={cn('font-cond font-black text-[11px] tracking-widest', s.text)}>
              {LABELS[conflict.conflict_type] ?? conflict.conflict_type.toUpperCase()}
            </span>
            <span className="font-mono text-[9px] text-muted">
              {new Date(conflict.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="text-[12px] text-gray-200 mb-2">{conflict.description}</div>
          {conflict.impacted_game_ids.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {conflict.impacted_game_ids.map((id) => (
                <span
                  key={id}
                  className="font-cond text-[10px] font-bold bg-white/10 text-muted px-1.5 py-0.5 rounded"
                >
                  Game #{id}
                </span>
              ))}
            </div>
          )}
          {conflict.resolution_options?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="font-cond text-[10px] font-bold text-blue-300 mb-1"
              >
                {expanded ? '▲ HIDE' : '▼ RESOLUTIONS'}
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {conflict.resolution_options.map((o, i) => (
                    <button
                      key={i}
                      className="font-cond text-[10px] font-bold px-2 py-1 rounded bg-navy hover:bg-navy-light text-white"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onResolve}
          className="shrink-0 font-cond text-[10px] font-bold px-2 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 ml-2"
        >
          RESOLVE
        </button>
      </div>
    </div>
  )
}

// ─── Ref Availability Card ───────────────────────────────────
function RefAvailCard({ ref_, onEdit }: { ref_: Referee; onEdit: () => void }) {
  const [windows, setWindows] = useState<RefereeAvailability[]>([])
  useEffect(() => {
    const sb = createClient()
    sb.from('referee_availability')
      .select('*')
      .eq('referee_id', ref_.id)
      .order('date')
      .then(({ data }) => setWindows((data as RefereeAvailability[]) ?? []))
  }, [ref_.id])
  return (
    <div className="bg-surface-card border border-border rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="font-cond font-black text-[13px]">{ref_.name}</div>
          <div className="font-cond text-[10px] text-muted">{ref_.grade_level}</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={onEdit}>
          EDIT
        </Btn>
      </div>
      {windows.length === 0 ? (
        <div className="text-[10px] text-muted font-cond italic">No windows set</div>
      ) : (
        <div className="space-y-1">
          {windows.map((w) => (
            <div key={w.id} className="flex justify-between text-[10px]">
              <span className="font-mono text-blue-300">{w.date}</span>
              <span className="text-muted">
                {w.available_from}–{w.available_to}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
