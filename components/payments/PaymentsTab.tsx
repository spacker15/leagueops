'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  DollarSign,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  X,
  ChevronDown,
} from 'lucide-react'
import type {
  RegistrationFee,
  TeamPayment,
  PaymentEntry,
  PaymentMethod,
  PaymentStatus,
} from '@/types'

const inp =
  'bg-[#081428] border border-[#1a2d50] text-white px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 transition-colors w-full'

type SubTab = 'overview' | 'teams' | 'fees' | 'history'

const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/40',
  partial: 'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  paid: 'bg-green-900/40 text-green-400 border border-green-800/40',
  waived: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  refunded: 'bg-red-900/40 text-red-400 border border-red-800/40',
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  check: 'Check',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  waived: 'Waived',
  other: 'Other',
}

function fmt(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function dateFmt(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Record Payment Modal ───────────────────────────────────────────────────
interface RecordPaymentModalProps {
  payment: TeamPayment
  onClose: () => void
  onSaved: () => void
}
function RecordPaymentModal({ payment, onClose, onSaved }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function submit() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    const res = await fetch('/api/payment-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_payment_id: payment.id,
        amount: amt,
        payment_method: method,
        reference_number: ref.trim() || null,
        paid_at: new Date(paidAt).toISOString(),
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Failed to record payment')
      return
    }
    toast.success('Payment recorded')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[420px] rounded-xl shadow-2xl border border-[#1a2d50]"
        style={{ background: '#061428' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2d50]">
          <div>
            <div className="font-cond text-[13px] font-black tracking-wider text-white">
              RECORD PAYMENT
            </div>
            <div className="font-cond text-[11px] text-muted">
              {payment.team_name} — {payment.division}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Balance reminder */}
          <div className="flex justify-between text-[11px] font-cond bg-[#081428] rounded-lg px-3 py-2 border border-[#1a2d50]">
            <span className="text-muted">Balance due:</span>
            <span className="text-white font-bold">{fmt(payment.balance)}</span>
          </div>

          {/* Amount */}
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Amount *</label>
            <input
              className={inp}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={payment.balance.toFixed(2)}
              autoFocus
            />
          </div>

          {/* Method */}
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Payment Method</label>
            <select
              className={inp}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Date Received</label>
            <input
              className={inp}
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          {/* Reference */}
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">
              Reference # (check #, transaction ID, etc.)
            </label>
            <input
              className={inp}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Notes</label>
            <input
              className={inp}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="font-cond text-[11px] font-black tracking-wider px-4 py-2 rounded-lg border border-[#1a2d50] text-muted hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="font-cond text-[11px] font-black tracking-wider px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'RECORD PAYMENT'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Team Payment Modal ─────────────────────────────────────────────────
interface AddTeamPaymentModalProps {
  eventId: number
  fees: RegistrationFee[]
  existingDivisions: string[]
  teams: { id: number; name: string; division: string }[]
  onClose: () => void
  onSaved: () => void
}
function AddTeamPaymentModal({ eventId, fees, teams, onClose, onSaved }: AddTeamPaymentModalProps) {
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState('')
  const [division, setDivision] = useState('')
  const [amtDue, setAmtDue] = useState('')
  const [saving, setSaving] = useState(false)

  function handleTeamSelect(id: string) {
    setTeamId(id)
    const t = teams.find((t) => String(t.id) === id)
    if (t) {
      setTeamName(t.name)
      setDivision(t.division)
      const fee = fees.find((f) => f.division === t.division)
      if (fee) setAmtDue(String(fee.amount))
    }
  }

  async function submit() {
    if (!teamName.trim()) {
      toast.error('Team name required')
      return
    }
    const amt = parseFloat(amtDue)
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter a valid amount due')
      return
    }
    setSaving(true)
    const res = await fetch('/api/team-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        team_id: teamId ? parseInt(teamId) : null,
        team_name: teamName.trim(),
        division: division.trim(),
        amount_due: amt,
        amount_paid: 0,
        status: 'pending',
      }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Failed to add team')
      return
    }
    toast.success('Team added to payments')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[400px] rounded-xl shadow-2xl border border-[#1a2d50]"
        style={{ background: '#061428' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2d50]">
          <div className="font-cond text-[13px] font-black tracking-wider text-white">ADD TEAM</div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">
              Select Registered Team (optional)
            </label>
            <select
              className={inp}
              value={teamId}
              onChange={(e) => handleTeamSelect(e.target.value)}
            >
              <option value="">— manual entry —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.division})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Team Name *</label>
            <input
              className={inp}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Knights Blue"
            />
          </div>
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Division</label>
            <input
              className={inp}
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="e.g. U12"
            />
          </div>
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Amount Due *</label>
            <input
              className={inp}
              type="number"
              min="0"
              step="0.01"
              value={amtDue}
              onChange={(e) => setAmtDue(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="font-cond text-[11px] font-black tracking-wider px-4 py-2 rounded-lg border border-[#1a2d50] text-muted hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="font-cond text-[11px] font-black tracking-wider px-4 py-2 rounded-lg bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'ADD TEAM'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Tab ───────────────────────────────────────────────────────────────
export function PaymentsTab() {
  const { state } = useApp()
  const eventId = state.event?.id ?? 1
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [fees, setFees] = useState<RegistrationFee[]>([])
  const [payments, setPayments] = useState<TeamPayment[]>([])
  const [history, setHistory] = useState<
    (PaymentEntry & { team_name?: string; team_payment?: TeamPayment })[]
  >([])
  const [loading, setLoading] = useState(true)
  const [filterDiv, setFilterDiv] = useState('')
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('')
  const [recordTarget, setRecordTarget] = useState<TeamPayment | null>(null)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null)
  const [teamHistory, setTeamHistory] = useState<Record<number, PaymentEntry[]>>({})

  // Fee edit state
  const [feeEdits, setFeeEdits] = useState<Record<string, string>>({})
  const [savingFee, setSavingFee] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [feesRes, paymentsRes] = await Promise.all([
      fetch(`/api/registration-fees?event_id=${eventId}`),
      fetch(`/api/team-payments?event_id=${eventId}`),
    ])
    if (feesRes.ok) setFees(await feesRes.json())
    if (paymentsRes.ok) setPayments(await paymentsRes.json())
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  // Load history entries when that tab is active
  useEffect(() => {
    if (subTab !== 'history') return
    fetch(`/api/payment-entries?event_id=${eventId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
  }, [subTab, eventId])

  // Load payment entries for a specific team_payment
  async function loadTeamHistory(tpId: number) {
    if (teamHistory[tpId]) {
      setExpandedHistory(expandedHistory === tpId ? null : tpId)
      return
    }
    const res = await fetch(`/api/payment-entries?team_payment_id=${tpId}`)
    if (res.ok) {
      const entries = await res.json()
      setTeamHistory((h) => ({ ...h, [tpId]: entries }))
    }
    setExpandedHistory(tpId)
  }

  // Save a single fee config row
  async function saveFee(division: string) {
    const val = parseFloat(feeEdits[division] ?? '')
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSavingFee(division)
    const existing = fees.find((f) => f.division === division)
    const res = await fetch('/api/registration-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        division,
        amount: val,
        ...(existing ? { id: existing.id } : {}),
      }),
    })
    setSavingFee(null)
    if (!res.ok) {
      toast.error('Failed to save fee')
      return
    }
    toast.success(`Fee saved for ${division}`)
    setFeeEdits((e) => {
      const n = { ...e }
      delete n[division]
      return n
    })
    load()
  }

  // Derived stats
  const totalDue = payments.reduce((s, p) => s + Number(p.amount_due), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const outstanding = totalDue - totalPaid
  const paidCount = payments.filter((p) => p.status === 'paid' || p.status === 'waived').length
  const pendingCount = payments.filter((p) => p.status === 'pending').length

  // Filtered team list
  const divisions = Array.from(
    new Set(
      [
        ...state.teams.map((t: any) => t.division),
        ...fees.map((f) => f.division),
        ...payments.map((p) => p.division),
      ].filter(Boolean)
    )
  ).sort() as string[]

  const filteredPayments = payments.filter((p) => {
    if (filterDiv && p.division !== filterDiv) return false
    if (filterStatus && p.status !== filterStatus) return false
    return true
  })

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'teams', label: `Teams (${payments.length})` },
    { id: 'fees', label: 'Fee Config' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-muted" />
          <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
            Payments
          </span>
          <span className="font-cond text-[11px] text-muted">— Registration Fee Tracking</span>
        </div>
        <button
          onClick={() => setShowAddTeam(true)}
          className="flex items-center gap-1.5 font-cond font-black text-[11px] tracking-[.1em] px-3 py-1.5 rounded-lg bg-red hover:bg-red/80 text-white transition-colors"
        >
          <Plus size={12} /> ADD TEAM
        </button>
      </div>

      {/* SubTabs */}
      <div className="flex gap-1 mb-5 border-b border-[#1a2d50]">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'font-cond text-[11px] font-black tracking-[.1em] px-4 py-2.5 transition-colors border-b-2 -mb-[2px]',
              subTab === t.id
                ? 'text-white border-red'
                : 'text-muted border-transparent hover:text-white/70'
            )}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16 text-muted font-cond text-[13px]">
          Loading payment data…
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && subTab === 'overview' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Due', value: fmt(totalDue), icon: DollarSign, color: 'text-white' },
              {
                label: 'Collected',
                value: fmt(totalPaid),
                icon: TrendingUp,
                color: 'text-green-400',
              },
              {
                label: 'Outstanding',
                value: fmt(outstanding),
                icon: AlertCircle,
                color: outstanding > 0 ? 'text-yellow-400' : 'text-green-400',
              },
              {
                label: 'Paid in Full',
                value: `${paidCount} / ${payments.length}`,
                icon: CheckCircle,
                color: 'text-green-400',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#081428] border border-[#1a2d50] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-muted" />
                  <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                    {label}
                  </span>
                </div>
                <div className={cn('font-cond text-[24px] font-black', color)}>{value}</div>
              </div>
            ))}
          </div>

          {/* By division */}
          {divisions.length > 0 && (
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a2d50]">
                <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                  By Division
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {['Division', 'Teams', 'Total Due', 'Collected', 'Outstanding', 'Paid'].map(
                      (h) => (
                        <th
                          key={h}
                          className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {divisions.map((div) => {
                    const divPay = payments.filter((p) => p.division === div)
                    const due = divPay.reduce((s, p) => s + Number(p.amount_due), 0)
                    const paid = divPay.reduce((s, p) => s + Number(p.amount_paid), 0)
                    return (
                      <tr key={div} className="border-b border-[#0d1a2e] last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-cond font-bold text-[12px] text-blue-300 bg-[#1a2d50] px-2 py-0.5 rounded">
                            {div}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-white">
                          {divPay.length}
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-white">{fmt(due)}</td>
                        <td className="px-4 py-3 font-cond text-[12px] text-green-400">
                          {fmt(paid)}
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-yellow-400">
                          {fmt(due - paid)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#1a2d50] rounded-full overflow-hidden min-w-[60px]">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{
                                  width: `${due > 0 ? Math.min(100, (paid / due) * 100) : 0}%`,
                                }}
                              />
                            </div>
                            <span className="font-cond text-[11px] text-muted">
                              {due > 0 ? Math.round((paid / due) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {payments.length === 0 && (
            <div className="text-center py-10 text-muted font-cond text-[13px]">
              No teams yet — click <strong className="text-white/50">ADD TEAM</strong> or configure
              fees first
            </div>
          )}
        </div>
      )}

      {/* ── TEAMS ── */}
      {!loading && subTab === 'teams' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <select
              className={cn(inp, 'w-40')}
              value={filterDiv}
              onChange={(e) => setFilterDiv(e.target.value)}
            >
              <option value="">All Divisions</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className={cn(inp, 'w-40')}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
            >
              <option value="">All Statuses</option>
              {(['pending', 'partial', 'paid', 'waived', 'refunded'] as PaymentStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                )
              )}
            </select>
            <span className="font-cond text-[11px] text-muted">
              {filteredPayments.length} teams
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="text-center py-10 text-muted font-cond text-[13px]">
              No teams match filters
            </div>
          ) : (
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {['Team', 'Division', 'Due', 'Paid', 'Balance', 'Status', ''].map((h) => (
                      <th
                        key={h}
                        className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <>
                      <tr
                        key={p.id}
                        className="border-b border-[#0d1a2e] last:border-0 group hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => loadTeamHistory(p.id)}
                              className="text-muted hover:text-white transition-colors"
                            >
                              <ChevronDown
                                size={12}
                                className={cn(
                                  'transition-transform',
                                  expandedHistory === p.id ? 'rotate-180' : ''
                                )}
                              />
                            </button>
                            <span className="font-cond font-bold text-[13px] text-white">
                              {p.team_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-cond text-[11px] font-bold px-2 py-0.5 rounded bg-[#1a2d50] text-blue-300">
                            {p.division || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-white">
                          {fmt(Number(p.amount_due))}
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-green-400">
                          {fmt(Number(p.amount_paid))}
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-yellow-400">
                          {fmt(Number(p.balance ?? Number(p.amount_due) - Number(p.amount_paid)))}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'font-cond text-[10px] font-black tracking-wide px-2 py-0.5 rounded uppercase',
                              STATUS_COLORS[p.status]
                            )}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setRecordTarget(p)}
                            className="font-cond text-[10px] font-black tracking-wide px-2.5 py-1 rounded bg-[#1a2d50] hover:bg-blue-900/60 text-blue-300 hover:text-white transition-colors whitespace-nowrap"
                          >
                            + PAYMENT
                          </button>
                        </td>
                      </tr>
                      {/* Expandable history */}
                      {expandedHistory === p.id && (
                        <tr key={`hist-${p.id}`} className="border-b border-[#0d1a2e]">
                          <td colSpan={7} className="px-6 py-3 bg-[#040d1c]">
                            {(teamHistory[p.id] ?? []).length === 0 ? (
                              <span className="font-cond text-[11px] text-muted">
                                No payments recorded yet
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {(teamHistory[p.id] ?? []).map((e) => (
                                  <div
                                    key={e.id}
                                    className="flex items-center gap-4 font-cond text-[11px]"
                                  >
                                    <span className="text-green-400 font-bold">
                                      {fmt(Number(e.amount))}
                                    </span>
                                    <span className="text-muted">
                                      {METHOD_LABELS[e.payment_method]}
                                    </span>
                                    {e.reference_number && (
                                      <span className="text-white/40">#{e.reference_number}</span>
                                    )}
                                    <span className="text-muted">{dateFmt(e.paid_at)}</span>
                                    {e.notes && (
                                      <span className="text-white/50 italic">{e.notes}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FEE CONFIG ── */}
      {!loading && subTab === 'fees' && (
        <div className="space-y-4">
          <div className="font-cond text-[11px] text-muted">
            Set a registration fee per division. When you add a team, the fee will be pre-filled
            automatically.
          </div>

          <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2d50]">
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5">
                    Division
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-48">
                    Fee Amount (USD)
                  </th>
                  <th className="w-24 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {divisions.map((div) => {
                  const existing = fees.find((f) => f.division === div)
                  const editVal = feeEdits[div] ?? (existing ? String(existing.amount) : '')
                  return (
                    <tr key={div} className="border-b border-[#0d1a2e] last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-cond font-bold text-[12px] text-blue-300 bg-[#1a2d50] px-2 py-0.5 rounded">
                          {div}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-cond text-[12px] text-muted">$</span>
                          <input
                            className={cn(inp, 'w-32')}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editVal}
                            onChange={(e) => setFeeEdits((f) => ({ ...f, [div]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {feeEdits[div] !== undefined && (
                          <button
                            onClick={() => saveFee(div)}
                            disabled={savingFee === div}
                            className="font-cond text-[10px] font-black tracking-wide px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                          >
                            {savingFee === div ? '…' : 'SAVE'}
                          </button>
                        )}
                        {existing && feeEdits[div] === undefined && (
                          <span className="font-cond text-[10px] text-green-400">✓ set</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {divisions.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center font-cond text-[12px] text-muted"
                    >
                      No divisions found. Add teams to the event first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {!loading && subTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="text-center py-10 text-muted font-cond text-[13px]">
              No payment entries yet
            </div>
          ) : (
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {['Date', 'Team', 'Amount', 'Method', 'Reference', 'Notes'].map((h) => (
                      <th
                        key={h}
                        className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((e) => (
                    <tr key={e.id} className="border-b border-[#0d1a2e] last:border-0">
                      <td className="px-4 py-3 font-cond text-[12px] text-muted">
                        {dateFmt(e.paid_at)}
                      </td>
                      <td className="px-4 py-3 font-cond text-[12px] text-white">
                        {payments.find((p) => p.id === e.team_payment_id)?.team_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-cond text-[12px] font-bold text-green-400">
                        {fmt(Number(e.amount))}
                      </td>
                      <td className="px-4 py-3 font-cond text-[12px] text-white">
                        {METHOD_LABELS[e.payment_method]}
                      </td>
                      <td className="px-4 py-3 font-cond text-[12px] text-muted">
                        {e.reference_number || '—'}
                      </td>
                      <td className="px-4 py-3 font-cond text-[12px] text-white/50">
                        {e.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {recordTarget && (
        <RecordPaymentModal
          payment={recordTarget}
          onClose={() => setRecordTarget(null)}
          onSaved={load}
        />
      )}
      {showAddTeam && (
        <AddTeamPaymentModal
          eventId={eventId}
          fees={fees}
          existingDivisions={divisions}
          teams={state.teams as any}
          onClose={() => setShowAddTeam(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
