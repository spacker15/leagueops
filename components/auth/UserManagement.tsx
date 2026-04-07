'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/store'
import { Btn, FormField, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { UserPlus, RefreshCw, Pencil, KeyRound, X, Check } from 'lucide-react'

interface UserRoleRow {
  id: number
  user_id: string
  role: string
  display_name: string | null
  is_active: boolean
  referee_id: number | null
  volunteer_id: number | null
  program_id: number | null
  coach_id: number | null
  created_at: string
  email?: string
}

export function UserManagement() {
  const { userRole: currentRole } = useAuth()
  const { state, eventId } = useApp()
  const [users, setUsers] = useState<UserRoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('league_admin')
  const [inviteRefId, setInviteRefId] = useState('')
  const [inviteVolId, setInviteVolId] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteProgramId, setInviteProgramId] = useState('')
  const [inviteCoachId, setInviteCoachId] = useState('')
  const [inviteTrainerId, setInviteTrainerId] = useState('')
  // Inline creation fields for refs/volunteers/trainers
  const [newRefPhone, setNewRefPhone] = useState('')
  const [newVolRole, setNewVolRole] = useState('Score Table')
  const [newVolPhone, setNewVolPhone] = useState('')
  const [newTrainerPhone, setNewTrainerPhone] = useState('')
  const [newTrainerCerts, setNewTrainerCerts] = useState('')
  const [sending, setSending] = useState(false)
  // Edit/reset password state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [refs, setRefs] = useState<any[]>([])
  const [vols, setVols] = useState<any[]>([])
  const [trainers, setTrainers] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])

  useEffect(() => {
    loadUsers()
    loadRefVol()
    loadProgramsCoaches()
  }, [])

  if (!eventId) return null

  const ROLE_ORDER: Record<string, number> = {
    admin: 0,
    league_admin: 1,
    program_leader: 2,
    coach: 3,
    referee: 4,
    volunteer: 5,
    trainer: 6,
  }

  function sortUsers(list: UserRoleRow[]): UserRoleRow[] {
    return [...list].sort((a, b) => {
      const roleA = ROLE_ORDER[a.role] ?? 99
      const roleB = ROLE_ORDER[b.role] ?? 99
      if (roleA !== roleB) return roleA - roleB
      const nameA = (a.display_name ?? '').toLowerCase()
      const nameB = (b.display_name ?? '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  async function loadUsers() {
    const sb = createClient()
    setLoading(true)
    const { data } = await sb.from('user_roles').select('*')
    setUsers(sortUsers((data as UserRoleRow[]) ?? []))
    setLoading(false)
  }

  async function loadRefVol() {
    const sb = createClient()
    const [{ data: r }, { data: v }, { data: t }] = await Promise.all([
      sb.from('referees').select('id, name').eq('event_id', eventId).order('name'),
      sb.from('volunteers').select('id, name, role').eq('event_id', eventId).order('name'),
      sb.from('trainers').select('id, name, email').eq('event_id', eventId).order('name'),
    ])
    setRefs(r ?? [])
    setVols(v ?? [])
    setTrainers(t ?? [])
  }

  async function loadProgramsCoaches() {
    const sb = createClient()
    const [{ data: p }, { data: c }] = await Promise.all([
      sb.from('programs').select('id, name, short_name').order('name'),
      sb.from('coaches').select('id, name, email').order('name'),
    ])
    setPrograms(p ?? [])
    setCoaches(c ?? [])
  }

  async function createUser() {
    if (!inviteEmail || !invitePassword) {
      toast.error('Email and password required')
      return
    }
    setSending(true)
    const sb = createClient()
    const displayName = inviteName || inviteEmail

    let refId = inviteRefId ? Number(inviteRefId) : null
    let volId = inviteVolId ? Number(inviteVolId) : null
    let trainerId = inviteTrainerId ? Number(inviteTrainerId) : null

    // Create new referee record inline if "new" selected
    if (inviteRole === 'referee' && inviteRefId === '__new__') {
      const { data: newRef, error } = await sb
        .from('referees')
        .insert({
          event_id: eventId,
          name: displayName,
          phone: newRefPhone || null,
          email: inviteEmail,
        })
        .select('id')
        .single()
      if (error || !newRef) {
        toast.error(error?.message ?? 'Failed to create referee')
        setSending(false)
        return
      }
      refId = newRef.id
    }

    // Create new volunteer record inline if "new" selected
    if (inviteRole === 'volunteer' && inviteVolId === '__new__') {
      const { data: newVol, error } = await sb
        .from('volunteers')
        .insert({
          event_id: eventId,
          name: displayName,
          role: newVolRole,
          phone: newVolPhone || null,
        })
        .select('id')
        .single()
      if (error || !newVol) {
        toast.error(error?.message ?? 'Failed to create volunteer')
        setSending(false)
        return
      }
      volId = newVol.id
    }

    // Create new trainer record inline if "new" selected
    if (inviteRole === 'trainer' && inviteTrainerId === '__new__') {
      const { data: newTrainer, error } = await sb
        .from('trainers')
        .insert({
          event_id: eventId,
          name: displayName,
          email: inviteEmail,
          phone: newTrainerPhone || null,
          certifications: newTrainerCerts || null,
        })
        .select('id')
        .single()
      if (error || !newTrainer) {
        toast.error(error?.message ?? 'Failed to create trainer')
        setSending(false)
        return
      }
      trainerId = newTrainer.id
    }

    // Create auth user via admin API (requires service role in API route)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
        display_name: displayName,
        referee_id: refId,
        volunteer_id: volId,
        program_id: inviteProgramId ? Number(inviteProgramId) : null,
        coach_id: inviteCoachId ? Number(inviteCoachId) : null,
        trainer_id: trainerId,
        event_id: eventId,
      }),
    })

    const data = await res.json()
    if (data.error) {
      toast.error(typeof data.error === 'string' ? data.error : 'Failed to create user')
    } else {
      toast.success(`User created: ${inviteEmail}`)
      // Send invite email for applicable roles
      if (['referee', 'volunteer', 'coach', 'program_leader', 'trainer'].includes(inviteRole)) {
        try {
          const emailRes = await fetch('/api/admin/send-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: inviteEmail,
              name: displayName,
              roleName: inviteRole,
              eventId,
            }),
          })
          if (emailRes.ok) toast.success(`Invite email sent to ${inviteEmail}`)
        } catch {
          // Non-blocking — user still created
        }
      }
      setInviteEmail('')
      setInvitePassword('')
      setInviteName('')
      setInviteRefId('')
      setInviteVolId('')
      setInviteProgramId('')
      setInviteCoachId('')
      setInviteTrainerId('')
      setNewRefPhone('')
      setNewVolRole('Score Table')
      setNewVolPhone('')
      setNewTrainerPhone('')
      setNewTrainerCerts('')
      loadUsers()
      loadRefVol()
    }
    setSending(false)
  }

  async function toggleActive(id: number, current: boolean) {
    const sb = createClient()
    await sb.from('user_roles').update({ is_active: !current }).eq('id', id)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: !current } : u)))
    toast.success(current ? 'User deactivated' : 'User activated')
  }

  function startEditing(u: UserRoleRow) {
    setEditingId(u.id)
    setEditName(u.display_name ?? '')
    setEditEmail(u.email ?? '')
    setEditPassword('')
  }

  function cancelEditing() {
    setEditingId(null)
    setEditName('')
    setEditEmail('')
    setEditPassword('')
  }

  async function saveUser(u: UserRoleRow) {
    setSaving(true)
    const payload: Record<string, unknown> = {
      user_id: u.user_id,
      role_id: u.id,
    }
    if (editPassword) payload.password = editPassword
    if (editName && editName !== (u.display_name ?? '')) payload.display_name = editName
    if (editEmail && editEmail !== (u.email ?? '')) payload.email = editEmail

    if (!editPassword && !payload.display_name && !payload.email) {
      toast.error('No changes to save')
      setSaving(false)
      return
    }

    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (data.error) {
      toast.error(typeof data.error === 'string' ? data.error : 'Failed to update user')
    } else {
      const changes: string[] = []
      if (editPassword) changes.push('password reset')
      if (payload.display_name) changes.push('name updated')
      if (payload.email) changes.push('email updated')
      toast.success(`User updated: ${changes.join(', ')}`)
      cancelEditing()
      loadUsers()
    }
    setSaving(false)
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: 'text-red-400 bg-red-900/30',
    league_admin: 'text-blue-300 bg-blue-900/30',
    referee: 'text-yellow-400 bg-yellow-900/30',
    volunteer: 'text-green-400 bg-green-900/30',
    player: 'text-purple-400 bg-purple-900/30',
    program_leader: 'text-orange-400 bg-orange-900/30',
    coach: 'text-cyan-400 bg-cyan-900/30',
  }

  return (
    <div>
      <SectionHeader>USER MANAGEMENT</SectionHeader>
      <div className="grid grid-cols-2 gap-6">
        {/* Create user form */}
        <div>
          <div className="bg-surface-card border border-border rounded-lg p-4">
            <div className="font-cond font-black text-[13px] tracking-wide mb-4 flex items-center gap-2">
              <UserPlus size={14} /> CREATE USER
            </div>
            <div className="space-y-3">
              <FormField label="Email">
                <input
                  className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  type="email"
                />
              </FormField>
              <FormField label="Password">
                <input
                  className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Temporary password"
                  type="password"
                />
              </FormField>
              <FormField label="Display Name">
                <input
                  className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                />
              </FormField>
              <FormField label="Role">
                <select
                  className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="admin">Admin — Full access</option>
                  <option value="league_admin">League Admin</option>
                  <option value="referee">Referee</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="program_leader">Program Leader</option>
                  <option value="coach">Coach</option>
                  <option value="trainer">Trainer (Athletic)</option>
                </select>
              </FormField>

              {inviteRole === 'referee' && (
                <>
                  <FormField label="Referee">
                    <select
                      className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                      value={inviteRefId}
                      onChange={(e) => setInviteRefId(e.target.value)}
                    >
                      <option value="">Select referee…</option>
                      <option value="__new__">+ Create new referee</option>
                      {refs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {inviteRefId === '__new__' && (
                    <div className="pl-3 border-l-2 border-yellow-800/50 space-y-2">
                      <FormField label="Phone (optional)">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={newRefPhone}
                          onChange={(e) => setNewRefPhone(e.target.value)}
                          placeholder="555-0100"
                        />
                      </FormField>
                    </div>
                  )}
                </>
              )}

              {inviteRole === 'volunteer' && (
                <>
                  <FormField label="Volunteer">
                    <select
                      className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                      value={inviteVolId}
                      onChange={(e) => setInviteVolId(e.target.value)}
                    >
                      <option value="">Select volunteer…</option>
                      <option value="__new__">+ Create new volunteer</option>
                      {vols.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.role})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {inviteVolId === '__new__' && (
                    <div className="pl-3 border-l-2 border-green-800/50 space-y-2">
                      <FormField label="Volunteer Role">
                        <select
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={newVolRole}
                          onChange={(e) => setNewVolRole(e.target.value)}
                        >
                          <option>Score Table</option>
                          <option>Clock</option>
                          <option>Field Marshal</option>
                          <option>Operations</option>
                          <option>Gate</option>
                        </select>
                      </FormField>
                      <FormField label="Phone (optional)">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={newVolPhone}
                          onChange={(e) => setNewVolPhone(e.target.value)}
                          placeholder="555-0100"
                        />
                      </FormField>
                    </div>
                  )}
                </>
              )}

              {inviteRole === 'program_leader' && (
                <FormField label="Link to Program">
                  <select
                    className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                    value={inviteProgramId}
                    onChange={(e) => setInviteProgramId(e.target.value)}
                  >
                    <option value="">Select program…</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.short_name ? ` (${p.short_name})` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {inviteRole === 'coach' && (
                <FormField label="Link to Coach">
                  <select
                    className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                    value={inviteCoachId}
                    onChange={(e) => setInviteCoachId(e.target.value)}
                  >
                    <option value="">Select coach…</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {inviteRole === 'trainer' && (
                <>
                  <FormField label="Trainer">
                    <select
                      className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                      value={inviteTrainerId}
                      onChange={(e) => setInviteTrainerId(e.target.value)}
                    >
                      <option value="">Select trainer…</option>
                      <option value="__new__">+ Create new trainer</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.email ? ` (${t.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {inviteTrainerId === '__new__' && (
                    <div className="pl-3 border-l-2 border-teal-800/50 space-y-2">
                      <FormField label="Phone (optional)">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={newTrainerPhone}
                          onChange={(e) => setNewTrainerPhone(e.target.value)}
                          placeholder="555-0100"
                        />
                      </FormField>
                      <FormField label="Certifications (optional)">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={newTrainerCerts}
                          onChange={(e) => setNewTrainerCerts(e.target.value)}
                          placeholder="ATC, CPR, First Aid"
                        />
                      </FormField>
                    </div>
                  )}
                </>
              )}

              <Btn variant="primary" className="w-full" onClick={createUser} disabled={sending}>
                {sending ? 'CREATING...' : 'CREATE USER'}
              </Btn>
            </div>
          </div>
        </div>

        {/* User list */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="font-cond text-[11px] font-bold text-muted tracking-widest uppercase">
              {users.length} USERS
            </div>
            <Btn size="sm" variant="ghost" onClick={loadUsers}>
              <RefreshCw size={11} className="inline mr-1" /> REFRESH
            </Btn>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted font-cond">LOADING...</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    'bg-surface-card border border-border rounded-lg p-3',
                    !u.is_active && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-cond font-black text-[13px] text-white truncate">
                        {u.display_name ?? 'Unknown'}
                      </div>
                      <div className="font-cond text-[10px] text-muted">
                        {u.referee_id && `Ref #${u.referee_id}`}
                        {u.volunteer_id && `Vol #${u.volunteer_id}`}
                        {u.program_id && `Program #${u.program_id}`}
                        {u.coach_id && `Coach #${u.coach_id}`}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-cond text-[10px] font-bold px-2 py-0.5 rounded',
                        ROLE_COLORS[u.role] ?? 'text-muted bg-surface'
                      )}
                    >
                      {u.role.replace('_', ' ').toUpperCase()}
                    </span>
                    <button
                      onClick={() => startEditing(u)}
                      className="font-cond text-[10px] font-bold px-2 py-1 rounded border border-border text-muted hover:bg-blue-900/20 hover:text-blue-400 hover:border-blue-800/50 transition-colors"
                      title="Edit user"
                    >
                      <Pencil size={10} className="inline mr-1" />
                      EDIT
                    </button>
                    <button
                      onClick={() => toggleActive(u.id, u.is_active)}
                      className={cn(
                        'font-cond text-[10px] font-bold px-2 py-1 rounded border transition-colors',
                        u.is_active
                          ? 'border-green-800/50 text-green-400 bg-green-900/20 hover:bg-red-900/20 hover:text-red-400 hover:border-red-800/50'
                          : 'border-border text-muted hover:bg-green-900/20 hover:text-green-400'
                      )}
                    >
                      {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {editingId === u.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <FormField label="Display Name">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Full name"
                        />
                      </FormField>
                      <FormField label="Email">
                        <input
                          className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="user@example.com"
                          type="email"
                        />
                      </FormField>
                      <FormField label="New Password">
                        <div className="flex items-center gap-2">
                          <KeyRound size={12} className="text-muted shrink-0" />
                          <input
                            className="w-full bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Leave blank to keep current"
                            type="password"
                          />
                        </div>
                      </FormField>
                      <div className="flex gap-2 pt-1">
                        <Btn
                          size="sm"
                          variant="primary"
                          onClick={() => saveUser(u)}
                          disabled={saving}
                        >
                          <Check size={10} className="inline mr-1" />
                          {saving ? 'SAVING...' : 'SAVE'}
                        </Btn>
                        <Btn size="sm" variant="ghost" onClick={cancelEditing}>
                          <X size={10} className="inline mr-1" />
                          CANCEL
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
