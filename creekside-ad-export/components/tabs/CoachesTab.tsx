'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/store'
import { cn, fmtDate, initials } from '@/lib/utils'
import {
  Card,
  SectionHeader,
  Btn,
  Modal,
  FormField,
  Input,
  Select,
  Avatar,
  Pill,
  BgCheckBadge,
} from '@/components/ui'
import * as db from '@/lib/db'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, AlertTriangle, Shield } from 'lucide-react'
import type { Coach, BgCheckStatus } from '@/types'

type CoachTitle = 'Head Coach' | 'Assistant Coach' | 'Volunteer'

interface CertEntry {
  type: string
  expiry: string
}

const EMPTY_ADD = {
  name: '',
  email: '',
  phone: '',
  title: 'Head Coach' as CoachTitle,
}

function isBgExpired(coach: Coach): boolean {
  if (coach.bg_check_status === 'expired') return true
  if (coach.bg_check_expiry) {
    const today = new Date().toISOString().split('T')[0]
    return coach.bg_check_expiry < today
  }
  return false
}

export function CoachesTab() {
  const { coaches, teams, schoolId } = useApp()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editCoach, setEditCoach] = useState<Coach | null>(null)
  const [deleteCoach, setDeleteCoach] = useState<Coach | null>(null)
  const [saving, setSaving] = useState(false)

  // Add form
  const [addForm, setAddForm] = useState(EMPTY_ADD)

  // Edit form
  const [editForm, setEditForm] = useState<{
    name: string
    email: string
    phone: string
    title: string
    bg_check_status: BgCheckStatus
    bg_check_expiry: string
    certifications: CertEntry[]
  }>({
    name: '',
    email: '',
    phone: '',
    title: '',
    bg_check_status: 'pending',
    bg_check_expiry: '',
    certifications: [],
  })

  // New cert row in edit modal
  const [newCert, setNewCert] = useState<CertEntry>({ type: '', expiry: '' })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return coaches
    return coaches.filter((c) => c.name.toLowerCase().includes(q))
  }, [coaches, search])

  function openEdit(coach: Coach) {
    setEditCoach(coach)
    setEditForm({
      name: coach.name,
      email: coach.email ?? '',
      phone: coach.phone ?? '',
      title: coach.title,
      bg_check_status: coach.bg_check_status,
      bg_check_expiry: coach.bg_check_expiry ?? '',
      certifications: coach.certifications ? [...coach.certifications] : [],
    })
    setNewCert({ type: '', expiry: '' })
  }

  async function handleAdd() {
    if (!addForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await db.insertCoach({
        school_id: schoolId,
        name: addForm.name.trim(),
        email: addForm.email.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        title: addForm.title,
        bg_check_status: 'pending',
        certifications: [],
      })
      toast.success('Coach added')
      setAddOpen(false)
      setAddForm(EMPTY_ADD)
      // Refresh is handled by store if real-time is on; otherwise force refresh
    } catch {
      toast.error('Failed to add coach')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editCoach) return
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await db.updateCoach(editCoach.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        title: editForm.title,
        bg_check_status: editForm.bg_check_status,
        bg_check_expiry: editForm.bg_check_expiry || undefined,
        certifications: editForm.certifications,
      })
      toast.success('Coach updated')
      setEditCoach(null)
    } catch {
      toast.error('Failed to update coach')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteCoach) return
    setSaving(true)
    try {
      await db.deleteCoach(deleteCoach.id)
      toast.success('Coach removed')
      setDeleteCoach(null)
    } catch {
      toast.error('Failed to delete coach')
    } finally {
      setSaving(false)
    }
  }

  function addCert() {
    if (!newCert.type.trim()) return
    setEditForm((f) => ({ ...f, certifications: [...f.certifications, { ...newCert }] }))
    setNewCert({ type: '', expiry: '' })
  }

  function removeCert(idx: number) {
    setEditForm((f) => ({ ...f, certifications: f.certifications.filter((_, i) => i !== idx) }))
  }

  function getAssignedTeams(coachId: number) {
    return teams.filter((t) => t.head_coach_id === coachId)
  }

  return (
    <div className="tab-content">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search coaches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Btn onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add Coach
        </Btn>
      </div>

      <SectionHeader>
        Coaches — {filtered.length} {filtered.length === 1 ? 'coach' : 'coaches'}
      </SectionHeader>

      {filtered.length === 0 ? (
        <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-4">
          {search ? 'No coaches match your search.' : 'No coaches added yet.'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((coach) => {
            const expired = isBgExpired(coach)
            const assignedTeams = getAssignedTeams(coach.id)
            return (
              <Card
                key={coach.id}
                className={cn('p-3 flex flex-col gap-2', expired && 'border-red/60')}
              >
                <div className="flex items-start gap-2">
                  <Avatar name={coach.name} variant={expired ? 'red' : 'blue'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-cond font-black text-[13px] text-white truncate">
                        {coach.name}
                      </span>
                      {expired && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                    </div>
                    <span className="font-cond text-[11px] text-muted">{coach.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(coach)}
                      className="p-1.5 rounded text-muted hover:text-white transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteCoach(coach)}
                      className="p-1.5 rounded text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <BgCheckBadge status={coach.bg_check_status} />
                  {coach.bg_check_expiry && (
                    <span
                      className={cn(
                        'font-cond text-[10px]',
                        expired ? 'text-red-400' : 'text-muted'
                      )}
                    >
                      Exp {fmtDate(coach.bg_check_expiry)}
                    </span>
                  )}
                </div>

                {coach.certifications && coach.certifications.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Shield size={11} className="text-muted shrink-0" />
                    <span className="font-cond text-[10px] text-muted">
                      {coach.certifications.length} cert{coach.certifications.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {assignedTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {assignedTeams.map((t) => (
                      <Pill key={t.id} variant="blue">
                        {t.name}
                      </Pill>
                    ))}
                  </div>
                )}

                {coach.email && (
                  <span className="text-muted text-[11px] font-cond truncate">{coach.email}</span>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Coach Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Coach"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Add Coach'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Name">
            <Input
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 000-0000"
            />
          </FormField>
          <FormField label="Title">
            <Select
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value as CoachTitle }))}
            >
              <option>Head Coach</option>
              <option>Assistant Coach</option>
              <option>Volunteer</option>
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* Edit Coach Modal */}
      <Modal
        open={!!editCoach}
        onClose={() => setEditCoach(null)}
        title="Edit Coach"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditCoach(null)}>
              Cancel
            </Btn>
            <Btn onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Name">
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </FormField>
          <FormField label="Title">
            <Select
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            >
              <option>Head Coach</option>
              <option>Assistant Coach</option>
              <option>Volunteer</option>
            </Select>
          </FormField>

          <div className="border-t border-border pt-3">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted block mb-3">
              Background Check
            </span>
            <div className="flex flex-col gap-3">
              <FormField label="Status">
                <Select
                  value={editForm.bg_check_status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, bg_check_status: e.target.value as BgCheckStatus }))
                  }
                >
                  <option value="cleared">Cleared</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                </Select>
              </FormField>
              <FormField label="Expiry Date">
                <Input
                  type="date"
                  value={editForm.bg_check_expiry}
                  onChange={(e) => setEditForm((f) => ({ ...f, bg_check_expiry: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted block mb-2">
              Certifications
            </span>
            {editForm.certifications.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {editForm.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-[#040e24] border border-[#1e3060] rounded-lg px-2.5 py-1.5"
                  >
                    <span className="font-cond text-[12px] text-white flex-1 truncate">
                      {cert.type}
                    </span>
                    {cert.expiry && (
                      <span className="font-cond text-[10px] text-muted shrink-0">
                        Exp {fmtDate(cert.expiry)}
                      </span>
                    )}
                    <button
                      onClick={() => removeCert(idx)}
                      className="text-muted hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Certification type"
                value={newCert.type}
                onChange={(e) => setNewCert((c) => ({ ...c, type: e.target.value }))}
                className="flex-1"
              />
              <Input
                type="date"
                value={newCert.expiry}
                onChange={(e) => setNewCert((c) => ({ ...c, expiry: e.target.value }))}
                className="w-36"
              />
              <Btn size="sm" onClick={addCert} disabled={!newCert.type.trim()}>
                <Plus size={12} />
              </Btn>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteCoach}
        onClose={() => setDeleteCoach(null)}
        title="Remove Coach"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setDeleteCoach(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Removing…' : 'Remove'}
            </Btn>
          </>
        }
      >
        {deleteCoach && (
          <div className="flex flex-col gap-3">
            <p className="text-white text-[13px] font-cond">
              Remove <strong>{deleteCoach.name}</strong> from the coaching staff?
            </p>
            {getAssignedTeams(deleteCoach.id).length > 0 && (
              <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-800/40 rounded-lg p-3">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-yellow-300 text-[12px] font-cond">
                  This coach is assigned to{' '}
                  {getAssignedTeams(deleteCoach.id)
                    .map((t) => t.name)
                    .join(', ')}
                  . Removing them will unassign them from those teams.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
