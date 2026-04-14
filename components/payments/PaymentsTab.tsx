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
  Zap,
  Building2,
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
      const err = await res.json().catch(() => ({}))
      toast.error(err?.error || 'Failed to record payment')
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

// ─── Program Payment Modal ──────────────────────────────────────────────────
interface ProgramPaymentModalProps {
  programName: string
  teams: TeamPayment[]
  totalOwed: number
  onClose: () => void
  onSaved: () => void
}
function ProgramPaymentModal({
  programName,
  teams,
  totalOwed,
  onClose,
  onSaved,
}: ProgramPaymentModalProps) {
  const [amount, setAmount] = useState(String(totalOwed.toFixed(2)))
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function submit() {
    const total = parseFloat(amount)
    if (isNaN(total) || total <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)

    // Distribute payment across teams proportionally by what each owes
    const teamOwed = teams.map((t) => ({
      id: t.id,
      owed: Math.max(0, Number(t.amount_due) - Number(t.amount_paid)),
    }))
    const totalTeamOwed = teamOwed.reduce((s, t) => s + t.owed, 0)

    let remaining = total
    for (let i = 0; i < teamOwed.length; i++) {
      if (teamOwed[i].owed <= 0) continue
      // Last team gets the remainder to avoid rounding issues
      const share =
        i === teamOwed.length - 1
          ? remaining
          : Math.min(
              teamOwed[i].owed,
              totalTeamOwed > 0
                ? Math.round((teamOwed[i].owed / totalTeamOwed) * total * 100) / 100
                : 0
            )
      if (share <= 0) continue
      remaining -= share

      const res = await fetch('/api/payment-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_payment_id: teamOwed[i].id,
          amount: share,
          payment_method: method,
          reference_number: ref.trim() || null,
          paid_at: new Date(paidAt).toISOString(),
          notes: notes.trim()
            ? `[${programName}] ${notes.trim()}`
            : `[${programName}] Program payment`,
        }),
      })
      if (!res.ok) {
        setSaving(false)
        toast.error('Failed to record payment — check console')
        return
      }
    }

    setSaving(false)
    toast.success(`Payment of ${fmt(total)} recorded for ${programName}`)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[440px] rounded-xl shadow-2xl border border-[#1a2d50]"
        style={{ background: '#061428' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2d50]">
          <div>
            <div className="font-cond text-[13px] font-black tracking-wider text-white">
              COLLECT PROGRAM PAYMENT
            </div>
            <div className="font-cond text-[11px] text-muted">
              {programName} — {teams.length} teams owed
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#0a1a30] rounded-lg p-3 flex items-center justify-between">
            <span className="font-cond text-[11px] text-muted">Total Owed</span>
            <span className="font-cond text-[16px] font-black text-yellow-400">
              {fmt(totalOwed)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-cond text-[10px] text-muted block mb-1">Amount *</label>
              <input
                className={inp}
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="font-cond text-[10px] text-muted block mb-1">Method</label>
              <select
                className={cn(inp, 'bg-[#040e24]')}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-cond text-[10px] text-muted block mb-1">Reference #</label>
              <input
                className={inp}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Check # etc."
              />
            </div>
            <div>
              <label className="font-cond text-[10px] text-muted block mb-1">Date</label>
              <input
                className={inp}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="font-cond text-[10px] text-muted block mb-1">Notes</label>
            <input
              className={inp}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div className="font-cond text-[10px] text-muted">
            Payment will be distributed proportionally across {teams.length} teams.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1a2d50]">
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

// ─── Main Tab ───────────────────────────────────────────────────────────────
export function PaymentsTab() {
  const { state, eventId } = useApp()
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
  const [extraRefEdits, setExtraRefEdits] = useState<Record<string, string>>({})
  const [extraAssignerEdits, setExtraAssignerEdits] = useState<Record<string, string>>({})
  const [gamesIncludedEdits, setGamesIncludedEdits] = useState<Record<string, string>>({})
  const [savingFee, setSavingFee] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [programPayTarget, setProgramPayTarget] = useState<{
    programName: string
    teams: TeamPayment[]
    totalOwed: number
  } | null>(null)

  // Game counts per team for extra game fee calculation
  const [teamGameCounts, setTeamGameCounts] = useState<Record<number, number>>({})
  // Program logos by program name
  const [programLogos, setProgramLogos] = useState<Record<string, string | null>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [feesRes, paymentsRes] = await Promise.all([
      fetch(`/api/registration-fees?event_id=${eventId}`),
      fetch(`/api/team-payments?event_id=${eventId}`),
    ])
    if (feesRes.ok) setFees(await feesRes.json())
    if (paymentsRes.ok) setPayments(await paymentsRes.json())

    // Fetch program logos
    try {
      const sb = (await import('@/supabase/client')).createClient()
      const { data: progs } = await sb
        .from('programs')
        .select('name, logo_url')
        .eq('event_id', eventId!)
      if (progs) {
        const logoMap: Record<string, string | null> = {}
        for (const p of progs) logoMap[p.name] = p.logo_url ?? null
        setProgramLogos(logoMap)
      }
    } catch {
      // non-critical
    }

    // Count games per team from state
    const counts: Record<number, number> = {}
    for (const g of state.games ?? []) {
      if (g.home_team_id) counts[g.home_team_id] = (counts[g.home_team_id] || 0) + 1
      if (g.away_team_id) counts[g.away_team_id] = (counts[g.away_team_id] || 0) + 1
    }
    setTeamGameCounts(counts)

    setLoading(false)
  }, [eventId, state.games])

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

  if (!eventId) return null

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
    const existing = fees.find((f) => f.division === division)
    const val = parseFloat(feeEdits[division] ?? (existing ? String(existing.amount) : ''))
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid amount')
      return
    }
    const refFee =
      parseFloat(
        extraRefEdits[division] ?? (existing ? String(existing.extra_game_ref_fee) : '')
      ) || 0
    const assignerFee =
      parseFloat(
        extraAssignerEdits[division] ?? (existing ? String(existing.extra_game_assigner_fee) : '')
      ) || 0
    const gamesInc =
      parseInt(gamesIncludedEdits[division] ?? (existing ? String(existing.games_included) : '')) ||
      0
    if (refFee < 0 || assignerFee < 0) {
      toast.error('Extra game fees must be >= 0')
      return
    }
    setSavingFee(division)
    const res = await fetch('/api/registration-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        division,
        amount: val,
        games_included: gamesInc,
        extra_game_ref_fee: refFee,
        extra_game_assigner_fee: assignerFee,
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
    setExtraRefEdits((e) => {
      const n = { ...e }
      delete n[division]
      return n
    })
    setExtraAssignerEdits((e) => {
      const n = { ...e }
      delete n[division]
      return n
    })
    setGamesIncludedEdits((e) => {
      const n = { ...e }
      delete n[division]
      return n
    })
    load()
  }

  // Auto-generate team payments from registered teams
  async function generatePayments() {
    setGenerating(true)
    try {
      const res = await fetch('/api/team-payments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to generate')
        return
      }
      const data = await res.json()
      if (data.created > 0) {
        toast.success(`Generated ${data.created} payment records`)
      } else {
        toast.success('All teams already have payment records')
      }
      load()
    } catch {
      toast.error('Failed to generate payment records')
    } finally {
      setGenerating(false)
    }
  }

  // Build program grouping from payments using program_name field
  const programGroups = (() => {
    const groups: Record<
      string,
      {
        programName: string
        teams: TeamPayment[]
        teamCount: number
        totalDue: number
        totalPaid: number
      }
    > = {}
    for (const p of payments) {
      const programName = (p as any).program_name || 'Unassigned'
      if (!groups[programName]) {
        groups[programName] = { programName, teams: [], teamCount: 0, totalDue: 0, totalPaid: 0 }
      }
      groups[programName].teams.push(p)
      groups[programName].teamCount++
      groups[programName].totalDue += Number(p.amount_due)
      groups[programName].totalPaid += Number(p.amount_paid)
    }
    return Object.values(groups).sort((a, b) => a.programName.localeCompare(b.programName))
  })()

  // Extra game fee calculation — per-division games_included
  const feeByDivision: Record<string, { ref: number; assigner: number; gamesIncluded: number }> = {}
  for (const f of fees) {
    feeByDivision[f.division] = {
      ref: Number(f.extra_game_ref_fee) || 0,
      assigner: Number(f.extra_game_assigner_fee) || 0,
      gamesIncluded: Number(f.games_included) || 0,
    }
  }

  // Per-team extra game fee: { teamPaymentId → { extraGames, extraFee, gamesPlayed, gamesIncluded } }
  const teamExtraFees: Record<
    number,
    { extraGames: number; extraFee: number; gamesPlayed: number; gamesIncluded: number }
  > = {}
  let totalExtraGameFees = 0
  for (const p of payments) {
    const gamesPlayed = p.team_id ? teamGameCounts[p.team_id] || 0 : 0
    const rates = feeByDivision[p.division]
    const gamesIncluded = rates?.gamesIncluded || 0
    const extra = gamesIncluded > 0 ? Math.max(0, gamesPlayed - gamesIncluded) : 0
    const perGame = rates ? rates.ref + rates.assigner : 0
    const extraFee = extra * perGame
    teamExtraFees[p.id] = { extraGames: extra, extraFee, gamesPlayed, gamesIncluded }
    totalExtraGameFees += extraFee
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
        <div className="flex items-center gap-2">
          <button
            onClick={generatePayments}
            disabled={generating}
            className="flex items-center gap-1.5 font-cond font-black text-[11px] tracking-[.1em] px-3 py-1.5 rounded-lg bg-navy hover:bg-navy/80 text-white transition-colors disabled:opacity-50"
          >
            <Zap size={12} /> {generating ? 'GENERATING…' : 'GENERATE FROM TEAMS'}
          </button>
          <button
            onClick={() => setShowAddTeam(true)}
            className="flex items-center gap-1.5 font-cond font-black text-[11px] tracking-[.1em] px-3 py-1.5 rounded-lg bg-red hover:bg-red/80 text-white transition-colors"
          >
            <Plus size={12} /> ADD TEAM
          </button>
        </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                label: 'Registration Fees',
                value: fmt(totalDue),
                icon: DollarSign,
                color: 'text-white',
              },
              {
                label: 'Extra Game Fees',
                value: fmt(totalExtraGameFees),
                icon: AlertCircle,
                color: totalExtraGameFees > 0 ? 'text-orange-400' : 'text-muted',
              },
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
                    {[
                      'Division',
                      'Teams',
                      'Reg Fees',
                      'Extra Game Fees',
                      'Collected',
                      'Outstanding',
                      'Paid',
                    ].map((h) => (
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
                  {divisions.map((div) => {
                    const divPay = payments.filter((p) => p.division === div)
                    const due = divPay.reduce((s, p) => s + Number(p.amount_due), 0)
                    const paid = divPay.reduce((s, p) => s + Number(p.amount_paid), 0)
                    const divExtra = divPay.reduce(
                      (s, p) => s + (teamExtraFees[p.id]?.extraFee || 0),
                      0
                    )
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
                        <td className="px-4 py-3 font-cond text-[12px] text-orange-400">
                          {divExtra > 0 ? fmt(divExtra) : '—'}
                        </td>
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

          {/* By Program — expandable with Division > Team breakdown */}
          {programGroups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Building2 size={13} className="text-muted" />
                <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                  By Program
                </span>
              </div>
              {programGroups.map((pg) => {
                const pgExtra = pg.teams.reduce(
                  (s, t) => s + (teamExtraFees[t.id]?.extraFee || 0),
                  0
                )
                const pgTotalOwed = pg.totalDue + pgExtra - pg.totalPaid
                const allPaid = pg.teams.every((t) => t.status === 'paid' || t.status === 'waived')
                const isExpanded = expandedProgram === pg.programName

                // Group teams by division within this program
                const divGroups: Record<string, TeamPayment[]> = {}
                for (const t of pg.teams) {
                  const d = t.division || 'Unassigned'
                  if (!divGroups[d]) divGroups[d] = []
                  divGroups[d].push(t)
                }

                return (
                  <div
                    key={pg.programName}
                    className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden"
                  >
                    {/* Program header row */}
                    <button
                      onClick={() => setExpandedProgram(isExpanded ? null : pg.programName)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <ChevronDown
                        size={14}
                        className={cn(
                          'text-muted transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                      {programLogos[pg.programName] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={programLogos[pg.programName]!}
                          alt=""
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <Building2 size={16} className="text-muted flex-shrink-0" />
                      )}
                      <span className="font-cond font-black text-[14px] text-white flex-1 text-left">
                        {pg.programName}
                      </span>
                      <span className="font-cond text-[11px] text-muted">{pg.teamCount} teams</span>
                      <span className="font-cond text-[11px] text-white">{fmt(pg.totalDue)}</span>
                      {pgExtra > 0 && (
                        <span className="font-cond text-[11px] text-orange-400">
                          +{fmt(pgExtra)} extra
                        </span>
                      )}
                      <span className="font-cond text-[11px] text-green-400">
                        {fmt(pg.totalPaid)} paid
                      </span>
                      <span
                        className={cn(
                          'font-cond text-[10px] font-black tracking-wide px-2 py-0.5 rounded uppercase',
                          allPaid
                            ? 'bg-green-900/40 text-green-400'
                            : pg.totalPaid > 0
                              ? 'bg-blue-900/40 text-blue-300'
                              : 'bg-yellow-900/40 text-yellow-400'
                        )}
                      >
                        {allPaid ? 'PAID' : pg.totalPaid > 0 ? 'PARTIAL' : 'PENDING'}
                      </span>
                    </button>

                    {/* Expanded: Division > Team breakdown */}
                    {isExpanded && (
                      <div className="border-t border-[#1a2d50]">
                        {Object.entries(divGroups)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([div, divTeams]) => {
                            const divDue = divTeams.reduce((s, t) => s + Number(t.amount_due), 0)
                            const divExtra = divTeams.reduce(
                              (s, t) => s + (teamExtraFees[t.id]?.extraFee || 0),
                              0
                            )
                            const divPaid = divTeams.reduce((s, t) => s + Number(t.amount_paid), 0)
                            return (
                              <div key={div}>
                                {/* Division header */}
                                <div className="flex items-center gap-2 px-6 py-2 bg-[#0a1a30] border-b border-[#1a2d50]">
                                  <span className="font-cond text-[10px] font-bold px-2 py-0.5 rounded bg-[#1a2d50] text-blue-300">
                                    {div}
                                  </span>
                                  <span className="font-cond text-[10px] text-muted">
                                    {divTeams.length} teams
                                  </span>
                                  <span className="font-cond text-[10px] text-muted ml-auto">
                                    Reg: {fmt(divDue)}
                                    {divExtra > 0 && (
                                      <span className="text-orange-400 ml-2">
                                        Extra: {fmt(divExtra)}
                                      </span>
                                    )}
                                    <span className="text-green-400 ml-2">
                                      Paid: {fmt(divPaid)}
                                    </span>
                                  </span>
                                </div>
                                {/* Team rows */}
                                {divTeams.map((t) => {
                                  const tExtra = teamExtraFees[t.id]
                                  const stateTeam = state.teams?.find((st) => st.id === t.team_id)
                                  const teamLogo =
                                    stateTeam?.logo_url || programLogos[pg.programName] || null
                                  return (
                                    <div
                                      key={t.id}
                                      className="flex items-center gap-3 px-8 py-2 border-b border-[#0d1a2e] last:border-0 hover:bg-white/[0.02]"
                                    >
                                      {teamLogo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={teamLogo}
                                          alt=""
                                          className="w-5 h-5 rounded object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded bg-[#1a2d50] flex-shrink-0" />
                                      )}
                                      <span className="font-cond text-[12px] text-white flex-1">
                                        {t.team_name}
                                      </span>
                                      <span className="font-cond text-[11px] text-muted w-20 text-right">
                                        {fmt(Number(t.amount_due))}
                                      </span>
                                      {tExtra?.extraGames > 0 ? (
                                        <span className="font-cond text-[11px] text-orange-400 w-20 text-right">
                                          +{tExtra.extraGames}g {fmt(tExtra.extraFee)}
                                        </span>
                                      ) : (
                                        <span className="w-20" />
                                      )}
                                      <span className="font-cond text-[11px] text-green-400 w-20 text-right">
                                        {fmt(Number(t.amount_paid))}
                                      </span>
                                      <span
                                        className={cn(
                                          'font-cond text-[10px] font-black tracking-wide px-2 py-0.5 rounded uppercase w-16 text-center',
                                          STATUS_COLORS[t.status]
                                        )}
                                      >
                                        {t.status}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setRecordTarget(t)
                                        }}
                                        className="font-cond text-[9px] font-black tracking-wide px-2 py-0.5 rounded bg-[#1a2d50] hover:bg-blue-900/60 text-blue-300 hover:text-white transition-colors"
                                      >
                                        + PAY
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        {/* Program totals + collect button */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-[#040d1c] border-t border-[#1a2d50]">
                          <span className="font-cond text-[11px] font-black tracking-wider text-muted uppercase flex-1">
                            Program Total: {fmt(pg.totalDue + pgExtra)}
                            {pgExtra > 0 && (
                              <span className="text-orange-400 ml-1">
                                (incl. {fmt(pgExtra)} extra game fees)
                              </span>
                            )}
                          </span>
                          <span className="font-cond text-[11px] text-green-400">
                            Paid: {fmt(pg.totalPaid)}
                          </span>
                          <span className="font-cond text-[12px] font-bold text-yellow-400">
                            Owed: {fmt(pgTotalOwed > 0 ? pgTotalOwed : 0)}
                          </span>
                          {pgTotalOwed > 0 && (
                            <button
                              onClick={() =>
                                setProgramPayTarget({
                                  programName: pg.programName,
                                  teams: pg.teams.filter(
                                    (t) => t.status !== 'paid' && t.status !== 'waived'
                                  ),
                                  totalOwed: pgTotalOwed,
                                })
                              }
                              className="font-cond text-[10px] font-black tracking-wider px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
                            >
                              COLLECT PAYMENT
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Extra Game Fees Breakdown */}
          {totalExtraGameFees > 0 && (
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a2d50] flex items-center gap-2">
                <AlertCircle size={13} className="text-orange-400" />
                <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                  Extra Game Fees
                </span>
                <span className="font-cond text-[10px] text-muted ml-1">
                  — Games over included amount
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d50]">
                    {[
                      'Team',
                      'Division',
                      'Games Played',
                      'Extra Games',
                      'Rate/Game',
                      'Extra Fee',
                    ].map((h) => (
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
                  {payments
                    .filter((p) => (teamExtraFees[p.id]?.extraGames || 0) > 0)
                    .map((p) => {
                      const info = teamExtraFees[p.id]
                      const rates = feeByDivision[p.division]
                      const perGame = rates ? rates.ref + rates.assigner : 0
                      return (
                        <tr key={p.id} className="border-b border-[#0d1a2e] last:border-0">
                          <td className="px-4 py-3 font-cond font-bold text-[12px] text-white">
                            {p.team_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-cond text-[11px] font-bold px-2 py-0.5 rounded bg-[#1a2d50] text-blue-300">
                              {p.division}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[12px] text-white">
                            {info.gamesPlayed}
                          </td>
                          <td className="px-4 py-3 font-mono text-[12px] text-orange-400 font-bold">
                            +{info.extraGames}
                          </td>
                          <td className="px-4 py-3 font-cond text-[12px] text-muted">
                            {fmt(perGame)}
                          </td>
                          <td className="px-4 py-3 font-cond text-[12px] font-bold text-orange-400">
                            {fmt(info.extraFee)}
                          </td>
                        </tr>
                      )
                    })}
                  <tr className="bg-[#040d1c]">
                    <td
                      colSpan={5}
                      className="px-4 py-3 font-cond text-[11px] font-black tracking-wider text-muted text-right uppercase"
                    >
                      Total Extra Game Fees
                    </td>
                    <td className="px-4 py-3 font-cond text-[14px] font-black text-orange-400">
                      {fmt(totalExtraGameFees)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {payments.length === 0 && (
            <div className="text-center py-10 text-muted font-cond text-[13px]">
              No teams yet — click <strong className="text-white/50">GENERATE FROM TEAMS</strong> to
              auto-create payment records, or configure fees first
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
                    {[
                      'Team',
                      'Division',
                      'Reg Fee',
                      'Extra Games',
                      'Extra Fee',
                      'Paid',
                      'Balance',
                      'Status',
                      '',
                    ].map((h) => (
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
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {teamExtraFees[p.id]?.extraGames > 0 ? (
                            <span className="text-orange-400">
                              +{teamExtraFees[p.id].extraGames}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 font-cond text-[12px] text-orange-400">
                          {teamExtraFees[p.id]?.extraFee > 0
                            ? fmt(teamExtraFees[p.id].extraFee)
                            : '—'}
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
                          <td colSpan={9} className="px-6 py-3 bg-[#040d1c]">
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
            Set a registration fee per division. Set games included — extra game fees apply per team
            for each game beyond the included amount.
          </div>

          <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2d50]">
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5">
                    Division
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-32">
                    Reg Fee (USD)
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-24">
                    Games Incl.
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-32">
                    Extra Game Ref Fee
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-36">
                    Ref Assigner Fee
                  </th>
                  <th className="font-cond text-[10px] font-black tracking-[.1em] text-muted uppercase text-left px-4 py-2.5 w-28">
                    Total/Game
                  </th>
                  <th className="w-20 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {divisions.map((div) => {
                  const existing = fees.find((f) => f.division === div)
                  const editVal = feeEdits[div] ?? (existing ? String(existing.amount) : '')
                  const gamesIncVal =
                    gamesIncludedEdits[div] ?? (existing ? String(existing.games_included) : '')
                  const refVal =
                    extraRefEdits[div] ?? (existing ? String(existing.extra_game_ref_fee) : '')
                  const assignerVal =
                    extraAssignerEdits[div] ??
                    (existing ? String(existing.extra_game_assigner_fee) : '')
                  const totalPerGame = (parseFloat(refVal) || 0) + (parseFloat(assignerVal) || 0)
                  const hasEdits =
                    feeEdits[div] !== undefined ||
                    gamesIncludedEdits[div] !== undefined ||
                    extraRefEdits[div] !== undefined ||
                    extraAssignerEdits[div] !== undefined
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
                            className={cn(inp, 'w-24')}
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
                        <input
                          className={cn(inp, 'w-16 text-center')}
                          type="number"
                          min="0"
                          step="1"
                          value={gamesIncVal}
                          onChange={(e) =>
                            setGamesIncludedEdits((f) => ({ ...f, [div]: e.target.value }))
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-cond text-[12px] text-muted">$</span>
                          <input
                            className={cn(inp, 'w-24')}
                            type="number"
                            min="0"
                            step="0.01"
                            value={refVal}
                            onChange={(e) =>
                              setExtraRefEdits((f) => ({ ...f, [div]: e.target.value }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-cond text-[12px] text-muted">$</span>
                          <input
                            className={cn(inp, 'w-24')}
                            type="number"
                            min="0"
                            step="0.01"
                            value={assignerVal}
                            onChange={(e) =>
                              setExtraAssignerEdits((f) => ({ ...f, [div]: e.target.value }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'font-cond text-[12px] font-bold',
                            totalPerGame > 0 ? 'text-orange-400' : 'text-muted'
                          )}
                        >
                          {totalPerGame > 0 ? fmt(totalPerGame) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasEdits && (
                          <button
                            onClick={() => saveFee(div)}
                            disabled={savingFee === div}
                            className="font-cond text-[10px] font-black tracking-wide px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                          >
                            {savingFee === div ? '…' : 'SAVE'}
                          </button>
                        )}
                        {existing && !hasEdits && (
                          <span className="font-cond text-[10px] text-green-400">✓ set</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {divisions.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
      {programPayTarget && (
        <ProgramPaymentModal
          programName={programPayTarget.programName}
          teams={programPayTarget.teams}
          totalOwed={programPayTarget.totalOwed}
          onClose={() => setProgramPayTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
