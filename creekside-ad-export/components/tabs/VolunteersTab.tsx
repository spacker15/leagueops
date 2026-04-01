'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, UserCheck, UserX, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, fmtDate, fmtTime } from '@/lib/utils'
import type { Volunteer, VolunteerAssignment, VolunteerRole, Game } from '@/types'
import * as db from '@/lib/db'
import { useApp } from '@/lib/store'
import { Btn, FormField, Input, Modal, Avatar, CoverageBar } from '@/components/ui'

const ROLES: VolunteerRole[] = ['Stats', 'Time/Score', 'Announcer', 'Concessions', 'Gate/Tickets']

function groupGamesByDate(games: Game[]): [string, Game[]][] {
  const map = new Map<string, Game[]>()
  for (const g of games) {
    if (!map.has(g.scheduled_date)) map.set(g.scheduled_date, [])
    map.get(g.scheduled_date)!.push(g)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function VolunteersTab() {
  const { volunteers: storeVolunteers, games, schoolId } = useApp()

  // ── Volunteer directory state ──────────────────────────
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])

  useEffect(() => {
    setVolunteers(storeVolunteers)
  }, [storeVolunteers])

  const [addVolOpen, setAddVolOpen] = useState(false)
  const [volForm, setVolForm] = useState({ name: '', email: '', phone: '' })
  const [savingVol, setSavingVol] = useState(false)
  const [confirmDeleteVol, setConfirmDeleteVol] = useState<number | null>(null)

  // ── Assignment state ───────────────────────────────────
  const [selectedGameId, setSelectedGameId] = useState<string>('')
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([])
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [assignPickerRole, setAssignPickerRole] = useState<VolunteerRole | null>(null)

  // Upcoming + all games for selector (soonest first)
  const sortedGames = useMemo(
    () =>
      [...games].sort(
        (a, b) =>
          a.scheduled_date.localeCompare(b.scheduled_date) ||
          (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
      ),
    [games]
  )

  const groupedGames = useMemo(() => groupGamesByDate(sortedGames), [sortedGames])

  // Load assignments when game changes
  useEffect(() => {
    if (!selectedGameId) {
      setAssignments([])
      return
    }
    let cancelled = false
    async function load() {
      setLoadingAssign(true)
      try {
        const data = await db.getVolunteerAssignments(Number(selectedGameId))
        if (!cancelled) setAssignments(data)
      } finally {
        if (!cancelled) setLoadingAssign(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedGameId])

  const selectedGame = useMemo(
    () => games.find((g) => g.id === Number(selectedGameId)),
    [games, selectedGameId]
  )

  // ── Assignment helpers ─────────────────────────────────
  function assignmentForRole(role: VolunteerRole): VolunteerAssignment | undefined {
    return assignments.find((a) => a.role === role)
  }

  async function handleAssign(role: VolunteerRole, volunteerId: number) {
    if (!selectedGameId) return
    const existing = assignmentForRole(role)
    try {
      await db.upsertVolunteerAssignment({
        game_id: Number(selectedGameId),
        volunteer_id: volunteerId,
        role,
        checked_in:
          existing?.volunteer_id === volunteerId ? (existing?.checked_in ?? false) : false,
        school_id: schoolId,
      })
      const updated = await db.getVolunteerAssignments(Number(selectedGameId))
      setAssignments(updated)
      setAssignPickerRole(null)
      toast.success('Volunteer assigned')
    } catch {
      toast.error('Failed to assign volunteer')
    }
  }

  async function handleUnassign(assignment: VolunteerAssignment) {
    try {
      await db.deleteVolunteerAssignment(assignment.id)
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id))
      toast.success('Assignment removed')
    } catch {
      toast.error('Failed to remove assignment')
    }
  }

  async function handleToggleCheckin(assignment: VolunteerAssignment) {
    try {
      await db.upsertVolunteerAssignment({
        game_id: assignment.game_id,
        volunteer_id: assignment.volunteer_id,
        role: assignment.role,
        checked_in: !assignment.checked_in,
        school_id: assignment.school_id,
      })
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignment.id ? { ...a, checked_in: !a.checked_in } : a))
      )
    } catch {
      toast.error('Failed to update check-in')
    }
  }

  const filledRoles = assignments.length
  const totalRoles = ROLES.length

  // ── Volunteer CRUD ─────────────────────────────────────
  async function handleAddVol() {
    if (!volForm.name.trim()) {
      toast.error('Enter a name')
      return
    }
    setSavingVol(true)
    try {
      const created = await db.insertVolunteer({
        school_id: schoolId,
        name: volForm.name.trim(),
        email: volForm.email.trim() || undefined,
        phone: volForm.phone.trim() || undefined,
        is_active: true,
      })
      if (created) {
        setVolunteers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Volunteer added')
        setAddVolOpen(false)
        setVolForm({ name: '', email: '', phone: '' })
      }
    } catch {
      toast.error('Failed to add volunteer')
    } finally {
      setSavingVol(false)
    }
  }

  async function handleDeleteVol(id: number) {
    try {
      await db.updateVolunteer(id, { is_active: false })
      setVolunteers((prev) => prev.filter((v) => v.id !== id))
      // Refresh assignments if the removed volunteer was assigned
      if (selectedGameId && assignments.some((a) => a.volunteer_id === id)) {
        const updated = await db.getVolunteerAssignments(Number(selectedGameId))
        setAssignments(updated)
      }
      toast.success('Volunteer removed')
      setConfirmDeleteVol(null)
    } catch {
      toast.error('Failed to remove volunteer')
    }
  }

  return (
    <div className="tab-content">
      <div className="flex gap-4 items-start">
        {/* ── Left: Volunteer Directory (1/3) ───────────── */}
        <div className="w-1/3 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
              Volunteers ({volunteers.length})
            </span>
            <Btn variant="primary" size="sm" onClick={() => setAddVolOpen(true)}>
              <Plus size={11} /> Add
            </Btn>
          </div>

          {volunteers.length === 0 ? (
            <div className="text-center text-muted text-[12px] py-8">No volunteers yet.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {volunteers.map((v) => (
                <div
                  key={v.id}
                  className="bg-surface-card border border-border rounded-xl px-3 py-2.5 flex items-center gap-2.5"
                >
                  <Avatar name={v.name} variant="blue" />
                  <div className="flex-1 min-w-0">
                    <div className="font-cond font-bold text-[12px] text-white truncate">
                      {v.name}
                    </div>
                    {v.phone && (
                      <div className="font-mono text-[10px] text-muted truncate">{v.phone}</div>
                    )}
                    {v.email && !v.phone && (
                      <div className="font-mono text-[10px] text-muted truncate">{v.email}</div>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmDeleteVol(v.id)}
                    className="text-muted hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Game Assignments (2/3) ─────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Game selector */}
          <div className="flex flex-col gap-1">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
              Game
            </span>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors max-w-sm"
            >
              <option value="">Select a game…</option>
              {groupedGames.map(([date, dayGames]) => (
                <optgroup key={date} label={fmtDateShort(date)}>
                  {dayGames.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.scheduled_time ? `${fmtTime(g.scheduled_time)} — ` : ''}
                      {g.home_team_name} vs {g.away_team_name}
                      {g.location ? ` @ ${g.location}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {!selectedGameId ? (
            <div className="text-center text-muted text-[13px] py-16">
              Select a game to manage volunteer assignments.
            </div>
          ) : loadingAssign ? (
            <div className="text-center text-muted text-[13px] py-10">Loading assignments…</div>
          ) : (
            <>
              {/* Coverage bar */}
              <div className="bg-surface-card border border-border rounded-xl px-4 py-3">
                <CoverageBar label="Roles Filled" value={filledRoles} total={totalRoles} />
              </div>

              {/* Role rows */}
              <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="border-b border-border px-4 py-2.5">
                  {selectedGame && (
                    <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                      {fmtDate(selectedGame.scheduled_date)}
                      {selectedGame.scheduled_time
                        ? ` · ${fmtTime(selectedGame.scheduled_time)}`
                        : ''}
                      {' · '}
                      {selectedGame.home_team_name} vs {selectedGame.away_team_name}
                    </span>
                  )}
                </div>

                {ROLES.map((role, idx) => {
                  const assignment = assignmentForRole(role)
                  const assignedVol = assignment
                    ? (assignment.volunteer ??
                      volunteers.find((v) => v.id === assignment.volunteer_id))
                    : null
                  const isPicking = assignPickerRole === role

                  return (
                    <div key={role}>
                      <div
                        className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          idx < ROLES.length - 1 ? 'border-b border-border/50' : ''
                        )}
                      >
                        {/* Role name */}
                        <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted w-28 shrink-0">
                          {role}
                        </span>

                        {/* Assigned volunteer or unassigned */}
                        <div className="flex-1 min-w-0">
                          {assignedVol ? (
                            <button
                              onClick={() => assignment && handleUnassign(assignment)}
                              className="flex items-center gap-2 group"
                              title="Click to unassign"
                            >
                              <Avatar name={assignedVol.name} variant="green" />
                              <span className="font-cond font-bold text-[12px] text-white group-hover:text-red-400 transition-colors">
                                {assignedVol.name}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[12px] text-muted/50 italic">Unassigned</span>
                          )}
                        </div>

                        {/* Check-in dot */}
                        {assignment && (
                          <button
                            onClick={() => handleToggleCheckin(assignment)}
                            className="shrink-0"
                            title={
                              assignment.checked_in ? 'Mark not checked in' : 'Mark checked in'
                            }
                          >
                            <span
                              className={cn(
                                'w-2.5 h-2.5 rounded-full block transition-colors',
                                assignment.checked_in ? 'bg-green-500' : 'bg-[#1a2d50]'
                              )}
                            />
                          </button>
                        )}
                        {!assignment && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#1a2d50] block shrink-0" />
                        )}

                        {/* Assign button */}
                        <Btn
                          variant={isPicking ? 'outline' : 'ghost'}
                          size="sm"
                          onClick={() => setAssignPickerRole(isPicking ? null : role)}
                          className="shrink-0"
                        >
                          {isPicking ? 'Cancel' : assignedVol ? 'Reassign' : 'Assign'}
                        </Btn>
                      </div>

                      {/* Mini picker */}
                      {isPicking && (
                        <div className="px-4 py-3 bg-[#040e24] border-t border-border/50">
                          <span className="font-cond font-black tracking-widest uppercase text-[10px] text-muted block mb-2">
                            Select volunteer
                          </span>
                          {volunteers.length === 0 ? (
                            <span className="text-[12px] text-muted">
                              No volunteers in directory.
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {volunteers.map((v) => (
                                <button
                                  key={v.id}
                                  onClick={() => handleAssign(role, v.id)}
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-cond font-bold transition-colors',
                                    assignment?.volunteer_id === v.id
                                      ? 'bg-navy border-navy text-white'
                                      : 'bg-[#081428] border-border text-muted hover:text-white hover:border-[#2a4070]'
                                  )}
                                >
                                  <Avatar name={v.name} variant="blue" />
                                  {v.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Checked in
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1a2d50] inline-block" />
                  Not checked in
                </span>
                <span className="text-muted/60">· Click name to unassign</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add Volunteer Modal ──────────────────────────── */}
      <Modal
        open={addVolOpen}
        onClose={() => {
          setAddVolOpen(false)
          setVolForm({ name: '', email: '', phone: '' })
        }}
        title="Add Volunteer"
        footer={
          <>
            <Btn
              variant="ghost"
              size="md"
              onClick={() => {
                setAddVolOpen(false)
                setVolForm({ name: '', email: '', phone: '' })
              }}
            >
              Cancel
            </Btn>
            <Btn variant="primary" size="md" onClick={handleAddVol} disabled={savingVol}>
              {savingVol ? 'Saving…' : 'Add Volunteer'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name">
            <Input
              placeholder="Full name"
              value={volForm.name}
              onChange={(e) => setVolForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              placeholder="optional"
              value={volForm.email}
              onChange={(e) => setVolForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              placeholder="optional"
              value={volForm.phone}
              onChange={(e) => setVolForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>

      {/* ── Confirm Delete Volunteer Modal ───────────────── */}
      <Modal
        open={confirmDeleteVol !== null}
        onClose={() => setConfirmDeleteVol(null)}
        title="Remove Volunteer"
        footer={
          <>
            <Btn variant="ghost" size="md" onClick={() => setConfirmDeleteVol(null)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              size="md"
              onClick={() => confirmDeleteVol !== null && handleDeleteVol(confirmDeleteVol)}
            >
              Remove
            </Btn>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          Remove this volunteer from the directory? Any existing game assignments will also be
          cleared.
        </p>
      </Modal>
    </div>
  )
}
