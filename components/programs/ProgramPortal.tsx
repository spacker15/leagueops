'use client'

import { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'

interface ProgramData {
  id: number
  name: string
  short_name: string | null
  display_id: string | null
  city: string | null
  state: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  website: string | null
  notes: string | null
  status: string
}

interface TeamData {
  id: number
  name: string
  division: string
  display_id: string | null
  color: string
  program_id: number | null
}

interface EventData {
  id: number
  name: string
  slug: string
  start_date: string
  end_date: string
  status: string
}

export function ProgramPortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [divisions, setDivisions] = useState<string[]>([])

  // Edit program state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    short_name: '',
    city: '',
    state: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
  })
  const [saving, setSaving] = useState(false)

  // Add team state
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', division: '', color: '#0B3D91' })
  const [addingTeam, setAddingTeam] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/program-invite?token=${token}`)
    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Invalid or expired link')
      setLoading(false)
      return
    }
    const data = await res.json()
    setProgram(data.program)
    setEvent(data.event)
    setTeams(data.teams ?? [])
    setDivisions(data.divisions ?? [])
    setLoading(false)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!program) return
    setEditForm({
      name: program.name,
      short_name: program.short_name ?? '',
      city: program.city ?? '',
      state: program.state ?? '',
      contact_name: program.contact_name,
      contact_email: program.contact_email,
      contact_phone: program.contact_phone ?? '',
      website: program.website ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!editForm.name || !editForm.contact_name || !editForm.contact_email) {
      toast.error('Name, contact name, and email are required')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/program-invite?token=${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        short_name: editForm.short_name || null,
        city: editForm.city || null,
        state: editForm.state || null,
        contact_name: editForm.contact_name,
        contact_email: editForm.contact_email,
        contact_phone: editForm.contact_phone || null,
        website: editForm.website || null,
      }),
    })
    if (res.ok) {
      toast.success('Program updated')
      setEditing(false)
      load()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Update failed')
    }
    setSaving(false)
  }

  async function addTeam() {
    if (!newTeam.name || !newTeam.division) {
      toast.error('Team name and division are required')
      return
    }
    setAddingTeam(true)
    const res = await fetch(`/api/program-invite/teams?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTeam),
    })
    if (res.ok) {
      toast.success(`Team "${newTeam.name}" added`)
      setNewTeam({ name: '', division: '', color: '#0B3D91' })
      setShowAddTeam(false)
      load()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to add team')
    }
    setAddingTeam(false)
  }

  async function removeTeam(team: TeamData) {
    if (!confirm(`Remove team "${team.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/program-invite/teams?token=${token}&team_id=${team.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      toast.success(`Team "${team.name}" removed`)
      load()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to remove team')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="font-cond text-3xl font-black text-white mb-2 tracking-widest">
            LEAGUEOPS
          </div>
          <div className="font-cond text-sm text-muted tracking-widest">LOADING PROGRAM...</div>
        </div>
      </div>
    )
  }

  if (error || !program || !event) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="font-cond text-3xl font-black text-white mb-4 tracking-widest">
            LEAGUEOPS
          </div>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
            <p className="font-cond text-red-400 text-lg font-bold">
              {error ?? 'Program not found'}
            </p>
            <p className="text-muted text-sm mt-2">
              This link may have expired or been deactivated.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const inp =
    'w-full bg-surface border border-border text-white px-3 py-2 rounded text-[13px] outline-none focus:border-blue-400'
  const sel =
    'w-full bg-[#040e24] border border-border text-white px-3 py-2 rounded text-[13px] outline-none focus:border-blue-400'
  const label = 'font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase mb-1'

  return (
    <div className="min-h-screen bg-surface">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-surface-card border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <div className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
              {event.name}
            </div>
            <div className="font-cond text-2xl font-black text-white tracking-wide">
              {program.name}
              {program.display_id && (
                <span className="ml-2 font-mono text-[12px] text-muted">{program.display_id}</span>
              )}
            </div>
          </div>
          <span className="font-cond text-[10px] font-black px-3 py-1 rounded tracking-wider bg-green-900/40 text-green-400">
            {program.status?.toUpperCase() ?? 'ACTIVE'}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Program Details */}
        <div className="bg-surface-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-cond font-black text-white tracking-wider uppercase text-sm">
              Program Details
            </h2>
            {!editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[12px] font-cond font-bold"
              >
                <Pencil size={12} /> EDIT
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={label}>Program Name *</div>
                  <input
                    className={inp}
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <div className={label}>Short Name</div>
                  <input
                    className={inp}
                    value={editForm.short_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, short_name: e.target.value }))}
                    placeholder="e.g. FI"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={label}>Contact Name *</div>
                  <input
                    className={inp}
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div>
                  <div className={label}>Contact Email *</div>
                  <input
                    className={inp}
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className={label}>Phone</div>
                  <input
                    className={inp}
                    value={editForm.contact_phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  />
                </div>
                <div>
                  <div className={label}>City</div>
                  <input
                    className={inp}
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <div className={label}>State</div>
                  <input
                    className={inp}
                    value={editForm.state}
                    onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <div className={label}>Website</div>
                <input
                  className={inp}
                  value={editForm.website}
                  onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1 bg-navy hover:bg-navy/80 text-white font-cond font-bold text-[12px] px-4 py-2 rounded transition-colors"
                >
                  <Check size={14} /> {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-muted hover:text-white font-cond font-bold text-[12px] px-4 py-2 rounded transition-colors"
                >
                  <X size={14} /> CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-muted">Contact: </span>
                <span className="text-white">{program.contact_name}</span>
              </div>
              <div>
                <span className="text-muted">Email: </span>
                <span className="text-blue-300">{program.contact_email}</span>
              </div>
              {program.contact_phone && (
                <div>
                  <span className="text-muted">Phone: </span>
                  <span className="text-white">{program.contact_phone}</span>
                </div>
              )}
              <div>
                <span className="text-muted">Location: </span>
                <span className="text-white">
                  {[program.city, program.state].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
              {program.website && (
                <div>
                  <span className="text-muted">Website: </span>
                  <a
                    href={program.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:underline"
                  >
                    {program.website}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="bg-surface-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-cond font-black text-white tracking-wider uppercase text-sm">
              Teams ({teams.length})
            </h2>
            <button
              onClick={() => setShowAddTeam(!showAddTeam)}
              className="flex items-center gap-1 text-green-400 hover:text-green-300 text-[12px] font-cond font-bold"
            >
              <Plus size={12} /> ADD TEAM
            </button>
          </div>

          {showAddTeam && (
            <div className="bg-surface border border-border rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className={label}>Team Name *</div>
                  <input
                    className={inp}
                    value={newTeam.name}
                    onChange={(e) => setNewTeam((t) => ({ ...t, name: e.target.value }))}
                    placeholder="e.g. Blue Lightning"
                  />
                </div>
                <div>
                  <div className={label}>Division *</div>
                  <select
                    className={sel}
                    value={newTeam.division}
                    onChange={(e) => setNewTeam((t) => ({ ...t, division: e.target.value }))}
                  >
                    <option value="">Select division…</option>
                    {divisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={label}>Color</div>
                  <input
                    type="color"
                    className="w-full h-[38px] bg-surface border border-border rounded cursor-pointer"
                    value={newTeam.color}
                    onChange={(e) => setNewTeam((t) => ({ ...t, color: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addTeam}
                  disabled={addingTeam}
                  className="flex items-center gap-1 bg-green-800 hover:bg-green-700 text-white font-cond font-bold text-[12px] px-4 py-2 rounded transition-colors"
                >
                  <Check size={14} /> {addingTeam ? 'ADDING...' : 'ADD TEAM'}
                </button>
                <button
                  onClick={() => setShowAddTeam(false)}
                  className="text-muted hover:text-white font-cond font-bold text-[12px] px-4 py-2 rounded transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {teams.length === 0 ? (
            <p className="text-muted text-sm text-center py-6">
              No teams registered yet. Click &quot;Add Team&quot; to register your first team.
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3"
                >
                  <div
                    className="w-4 h-4 rounded-sm flex-shrink-0 border border-border"
                    style={{ backgroundColor: team.color }}
                  />
                  {team.display_id && (
                    <span className="font-mono text-[10px] text-muted">{team.display_id}</span>
                  )}
                  <span className="font-cond font-bold text-white text-[14px] flex-1">
                    {team.name}
                  </span>
                  <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                    {team.division}
                  </span>
                  <button
                    onClick={() => removeTeam(team)}
                    className="text-muted hover:text-red-400 transition-colors"
                    title="Remove team"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
