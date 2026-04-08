'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/store'
import { Btn, FormField, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { UserPlus, RefreshCw, Pencil, KeyRound, X, Check, Filter } from 'lucide-react'

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
  trainer_id: number | null
  birthday: string | null
  created_at: string
  email?: string
}

interface LinkedDetails {
  referee?: { name: string; phone: string | null; email: string | null; checked_in: boolean; grade_level: string }
  volunteer?: { name: string; role: string; phone: string | null; checked_in: boolean }
  program?: { name: string; short_name: string | null }
  coach?: { name: string; email: string; phone: string | null; certifications: string | null }
  trainer?: { name: string; email: string | null; phone: string | null; certifications: string | null; checked_in: boolean }
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
  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('all')
  // Edit/reset password state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [saving, setSaving] = useState(false)
  const [editDetails, setEditDetails] = useState<LinkedDetails | null>(null)
  const [origAuthEmail, setOrigAuthEmail] = useState('')
  // Editable linked entity fields
  const [editLinkedName, setEditLinkedName] = useState('')
  const [editLinkedEmail, setEditLinkedEmail] = useState('')
  const [editLinkedPhone, setEditLinkedPhone] = useState('')
  const [editLinkedRole, setEditLinkedRole] = useState('')
  const [editLinkedCerts, setEditLinkedCerts] = useState('')
  const [editLinkedGradeLevel, setEditLinkedGradeLevel] = useState('Adult')
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

  async function startEditing(u: UserRoleRow) {
    setEditingId(u.id)
    setEditName(u.display_name ?? '')
    setEditEmail('')
    setEditPassword('')
    setEditBirthday(u.birthday ?? '')
    setEditDetails(null)
    // Reset linked fields
    setEditLinkedName('')
    setEditLinkedEmail('')
    setEditLinkedPhone('')
    setEditLinkedRole('')
    setEditLinkedCerts('')

    // Fetch auth user email
    try {
      const emailRes = await fetch(`/api/admin/update-user?user_id=${u.user_id}`)
      const emailData = await emailRes.json()
      if (emailData.email) {
        setEditEmail(emailData.email)
        setOrigAuthEmail(emailData.email)
      }
    } catch {
      // Non-blocking
    }

    // Fetch linked entity details
    const sb = createClient()
    const details: LinkedDetails = {}

    if (u.referee_id) {
      const { data } = await sb.from('referees').select('name, phone, email, checked_in, grade_level').eq('id', u.referee_id).single()
      if (data) {
        details.referee = data
        setEditLinkedName(data.name ?? '')
        setEditLinkedEmail(data.email ?? '')
        setEditLinkedPhone(data.phone ?? '')
        setEditLinkedGradeLevel(data.grade_level === 'Youth' ? 'Youth' : 'Adult')
      }
    }
    if (u.volunteer_id) {
      const { data } = await sb.from('volunteers').select('name, role, phone, checked_in').eq('id', u.volunteer_id).single()
      if (data) {
        details.volunteer = data
        setEditLinkedName(data.name ?? '')
        setEditLinkedPhone(data.phone ?? '')
        setEditLinkedRole(data.role ?? '')
      }
    }
    if (u.program_id) {
      const { data } = await sb.from('programs').select('name, short_name').eq('id', u.program_id).single()
      if (data) details.program = data
    }
    if (u.coach_id) {
      const { data } = await sb.from('coaches').select('name, email, phone, certifications').eq('id', u.coach_id).single()
      if (data) {
        details.coach = data
        setEditLinkedName(data.name ?? '')
        setEditLinkedEmail(data.email ?? '')
        setEditLinkedPhone(data.phone ?? '')
        setEditLinkedCerts(data.certifications ?? '')
      }
    }
    if (u.trainer_id) {
      const { data } = await sb.from('trainers').select('name, email, phone, certifications, checked_in').eq('id', u.trainer_id).single()
      if (data) {
        details.trainer = data
        setEditLinkedName(data.name ?? '')
        setEditLinkedEmail(data.email ?? '')
        setEditLinkedPhone(data.phone ?? '')
        setEditLinkedCerts(data.certifications ?? '')
      }
    }

    setEditDetails(details)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditName('')
    setEditEmail('')
    setEditPassword('')
    setEditBirthday('')
    setEditDetails(null)
    setOrigAuthEmail('')
    setEditLinkedName('')
    setEditLinkedEmail('')
    setEditLinkedPhone('')
    setEditLinkedRole('')
    setEditLinkedCerts('')
    setEditLinkedGradeLevel('Adult')
  }

  async function saveUser(u: UserRoleRow) {
    setSaving(true)
    const sb = createClient()
    const changes: string[] = []

    // 1. Update auth user (password/email) via API
    const payload: Record<string, unknown> = {
      user_id: u.user_id,
      role_id: u.id,
    }
    if (editPassword) payload.password = editPassword
    if (editName && editName !== (u.display_name ?? '')) payload.display_name = editName
    if (editEmail && editEmail !== origAuthEmail) payload.email = editEmail

    const hasAuthChanges = editPassword || payload.display_name || payload.email
    if (hasAuthChanges) {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to update user')
        setSaving(false)
        return
      }
      if (editPassword) changes.push('password reset')
      if (payload.display_name) changes.push('name updated')
      if (payload.email) changes.push('email updated')
    }

    // 2. Update birthday on user_roles
    if (editBirthday !== (u.birthday ?? '')) {
      await sb.from('user_roles').update({ birthday: editBirthday || null }).eq('id', u.id)
      changes.push('birthday updated')
    }

    // 3. Update linked entity fields
    if (u.referee_id && editDetails?.referee) {
      const updates: Record<string, string | null> = {}
      if (editLinkedName !== editDetails.referee.name) updates.name = editLinkedName
      if (editLinkedEmail !== (editDetails.referee.email ?? '')) updates.email = editLinkedEmail || null
      if (editLinkedPhone !== (editDetails.referee.phone ?? '')) updates.phone = editLinkedPhone || null
      if (editLinkedGradeLevel !== editDetails.referee.grade_level) updates.grade_level = editLinkedGradeLevel
      if (Object.keys(updates).length > 0) {
        await sb.from('referees').update(updates).eq('id', u.referee_id)
        changes.push('referee details updated')
      }
    }
    if (u.volunteer_id && editDetails?.volunteer) {
      const updates: Record<string, string | null> = {}
      if (editLinkedName !== editDetails.volunteer.name) updates.name = editLinkedName
      if (editLinkedPhone !== (editDetails.volunteer.phone ?? '')) updates.phone = editLinkedPhone || null
      if (editLinkedRole !== editDetails.volunteer.role) updates.role = editLinkedRole
      if (Object.keys(updates).length > 0) {
        await sb.from('volunteers').update(updates).eq('id', u.volunteer_id)
        changes.push('volunteer details updated')
      }
    }
    if (u.coach_id && editDetails?.coach) {
      const updates: Record<string, string | null> = {}
      if (editLinkedName !== editDetails.coach.name) updates.name = editLinkedName
      if (editLinkedEmail !== (editDetails.coach.email ?? '')) updates.email = editLinkedEmail || null
      if (editLinkedPhone !== (editDetails.coach.phone ?? '')) updates.phone = editLinkedPhone || null
      if (editLinkedCerts !== (editDetails.coach.certifications ?? '')) updates.certifications = editLinkedCerts || null
      if (Object.keys(updates).length > 0) {
        await sb.from('coaches').update(updates).eq('id', u.coach_id)
        changes.push('coach details updated')
      }
    }
    if (u.trainer_id && editDetails?.trainer) {
      const updates: Record<string, string | null> = {}
      if (editLinkedName !== editDetails.trainer.name) updates.name = editLinkedName
      if (editLinkedEmail !== (editDetails.trainer.email ?? '')) updates.email = editLinkedEmail || null
      if (editLinkedPhone !== (editDetails.trainer.phone ?? '')) updates.phone = editLinkedPhone || null
      if (editLinkedCerts !== (editDetails.trainer.certifications ?? '')) updates.certifications = editLinkedCerts || null
      if (Object.keys(updates).length > 0) {
        await sb.from('trainers').update(updates).eq('id', u.trainer_id)
        changes.push('trainer details updated')
      }
    }

    if (changes.length === 0) {
      toast.error('No changes to save')
      setSaving(false)
      return
    }

    toast.success(`User updated: ${changes.join(', ')}`)
    cancelEditing()
    loadUsers()
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
    trainer: 'text-teal-400 bg-teal-900/30',
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    league_admin: 'League Admin',
    program_leader: 'Program Leader',
    coach: 'Coach',
    referee: 'Referee',
    volunteer: 'Volunteer',
    trainer: 'Trainer',
  }

  const filteredUsers = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)
  const availableRoles = [...new Set(users.map((u) => u.role))].sort(
    (a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99)
  )

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
              {filteredUsers.length}{roleFilter !== 'all' ? ` / ${users.length}` : ''} USERS
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter size={10} className="text-muted" />
                <select
                  className="bg-[#040e24] border border-border text-white px-2 py-1 rounded text-[11px] font-cond font-bold outline-none focus:border-blue-400"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">ALL ROLES</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {(ROLE_LABELS[r] ?? r).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <Btn size="sm" variant="ghost" onClick={loadUsers}>
                <RefreshCw size={11} className="inline mr-1" /> REFRESH
              </Btn>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted font-cond">LOADING...</div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    'bg-surface-card border border-border rounded-lg p-3',
                    !u.is_active && 'opacity-50',
                    editingId === u.id && 'border-blue-800/60'
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
                        {u.trainer_id && `Trainer #${u.trainer_id}`}
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
                      onClick={() => editingId === u.id ? cancelEditing() : startEditing(u)}
                      className={cn(
                        'font-cond text-[10px] font-bold px-2 py-1 rounded border transition-colors',
                        editingId === u.id
                          ? 'border-blue-800/50 text-blue-400 bg-blue-900/20'
                          : 'border-border text-muted hover:bg-blue-900/20 hover:text-blue-400 hover:border-blue-800/50'
                      )}
                      title="Edit user"
                    >
                      {editingId === u.id ? (
                        <><X size={10} className="inline mr-1" />CLOSE</>
                      ) : (
                        <><Pencil size={10} className="inline mr-1" />EDIT</>
                      )}
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

                  {/* Edit card with full details */}
                  {editingId === u.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {!editDetails && (u.referee_id || u.volunteer_id || u.program_id || u.coach_id || u.trainer_id) && (
                        <div className="mb-3 text-[11px] text-muted font-cond">Loading details...</div>
                      )}

                      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
                        {/* Account section */}
                        <div className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                          ACCOUNT
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Display Name">
                            <input
                              className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Full name"
                            />
                          </FormField>
                          <FormField label="Email">
                            <input
                              className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="user@example.com"
                              type="email"
                            />
                          </FormField>
                          <FormField label="Birthday">
                            <input
                              className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                              value={editBirthday}
                              onChange={(e) => setEditBirthday(e.target.value)}
                              type="date"
                            />
                          </FormField>
                          <FormField label="New Password">
                            <div className="flex items-center gap-2">
                              <KeyRound size={12} className="text-muted shrink-0" />
                              <input
                                className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Leave blank to keep current"
                                type="password"
                              />
                            </div>
                          </FormField>
                        </div>

                        {/* Linked entity editable section */}
                        {editDetails?.referee && (
                          <>
                            <div className="font-cond text-[10px] font-black tracking-[.12em] text-yellow-400 uppercase pt-2 border-t border-border">
                              REFEREE DETAILS
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Name">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedName}
                                  onChange={(e) => setEditLinkedName(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Email">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedEmail}
                                  onChange={(e) => setEditLinkedEmail(e.target.value)}
                                  type="email"
                                />
                              </FormField>
                              <FormField label="Phone">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedPhone}
                                  onChange={(e) => setEditLinkedPhone(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Ref Type">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditLinkedGradeLevel('Adult')}
                                    className={cn(
                                      'flex-1 font-cond text-[11px] font-bold py-1.5 rounded border transition-colors',
                                      editLinkedGradeLevel === 'Adult'
                                        ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                                        : 'bg-surface border-border text-muted hover:text-white'
                                    )}
                                  >
                                    ADULT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditLinkedGradeLevel('Youth')}
                                    className={cn(
                                      'flex-1 font-cond text-[11px] font-bold py-1.5 rounded border transition-colors',
                                      editLinkedGradeLevel === 'Youth'
                                        ? 'bg-green-900/40 border-green-500 text-green-300'
                                        : 'bg-surface border-border text-muted hover:text-white'
                                    )}
                                  >
                                    YOUTH
                                  </button>
                                </div>
                              </FormField>
                              <div className="flex items-end pb-1">
                                <span className={cn('font-cond text-[11px] font-bold', editDetails.referee.checked_in ? 'text-green-400' : 'text-muted')}>
                                  {editDetails.referee.checked_in ? 'CHECKED IN' : 'NOT CHECKED IN'}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {editDetails?.volunteer && (
                          <>
                            <div className="font-cond text-[10px] font-black tracking-[.12em] text-green-400 uppercase pt-2 border-t border-border">
                              VOLUNTEER DETAILS
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Name">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedName}
                                  onChange={(e) => setEditLinkedName(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Role">
                                <select
                                  className="w-full bg-[#040e24] border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedRole}
                                  onChange={(e) => setEditLinkedRole(e.target.value)}
                                >
                                  <option>Score Table</option>
                                  <option>Clock</option>
                                  <option>Field Marshal</option>
                                  <option>Operations</option>
                                  <option>Gate</option>
                                </select>
                              </FormField>
                              <FormField label="Phone">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedPhone}
                                  onChange={(e) => setEditLinkedPhone(e.target.value)}
                                />
                              </FormField>
                              <div className="flex items-end pb-1">
                                <span className={cn('font-cond text-[11px] font-bold', editDetails.volunteer.checked_in ? 'text-green-400' : 'text-muted')}>
                                  {editDetails.volunteer.checked_in ? 'CHECKED IN' : 'NOT CHECKED IN'}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {editDetails?.program && (
                          <>
                            <div className="font-cond text-[10px] font-black tracking-[.12em] text-orange-400 uppercase pt-2 border-t border-border">
                              PROGRAM
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <DetailRow label="Program" value={editDetails.program.name} />
                              <DetailRow label="Short Name" value={editDetails.program.short_name} />
                            </div>
                          </>
                        )}

                        {editDetails?.coach && (
                          <>
                            <div className="font-cond text-[10px] font-black tracking-[.12em] text-cyan-400 uppercase pt-2 border-t border-border">
                              COACH DETAILS
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Name">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedName}
                                  onChange={(e) => setEditLinkedName(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Email">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedEmail}
                                  onChange={(e) => setEditLinkedEmail(e.target.value)}
                                  type="email"
                                />
                              </FormField>
                              <FormField label="Phone">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedPhone}
                                  onChange={(e) => setEditLinkedPhone(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Certifications">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedCerts}
                                  onChange={(e) => setEditLinkedCerts(e.target.value)}
                                />
                              </FormField>
                            </div>
                          </>
                        )}

                        {editDetails?.trainer && (
                          <>
                            <div className="font-cond text-[10px] font-black tracking-[.12em] text-teal-400 uppercase pt-2 border-t border-border">
                              TRAINER DETAILS
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Name">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedName}
                                  onChange={(e) => setEditLinkedName(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Email">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedEmail}
                                  onChange={(e) => setEditLinkedEmail(e.target.value)}
                                  type="email"
                                />
                              </FormField>
                              <FormField label="Phone">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedPhone}
                                  onChange={(e) => setEditLinkedPhone(e.target.value)}
                                />
                              </FormField>
                              <FormField label="Certifications">
                                <input
                                  className="w-full bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                                  value={editLinkedCerts}
                                  onChange={(e) => setEditLinkedCerts(e.target.value)}
                                />
                              </FormField>
                              <div className="flex items-end pb-1">
                                <span className={cn('font-cond text-[11px] font-bold', editDetails.trainer.checked_in ? 'text-green-400' : 'text-muted')}>
                                  {editDetails.trainer.checked_in ? 'CHECKED IN' : 'NOT CHECKED IN'}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Save / Cancel */}
                        <div className="flex gap-2 pt-2 border-t border-border">
                          <Btn
                            size="sm"
                            variant="primary"
                            onClick={() => saveUser(u)}
                            disabled={saving}
                          >
                            <Check size={10} className="inline mr-1" />
                            {saving ? 'SAVING...' : 'SAVE ALL CHANGES'}
                          </Btn>
                          <Btn size="sm" variant="ghost" onClick={cancelEditing}>
                            <X size={10} className="inline mr-1" />
                            CANCEL
                          </Btn>
                        </div>
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

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <div className="font-cond text-[10px] font-bold text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="font-cond text-[12px] text-white">
        {value || <span className="text-muted/50">—</span>}
      </div>
    </>
  )
}
