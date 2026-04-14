'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { CheckCircle, LogOut, AlertCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MedicalStatus } from '@/types'

const STATUS_ORDER: MedicalStatus[] = [
  'Dispatched',
  'On Site',
  'Transported',
  'Released',
  'Resolved',
]

const STATUS_COLOR: Record<MedicalStatus, string> = {
  Dispatched: 'text-red-400 bg-red-900/30 border-red-700/40',
  'On Site': 'text-orange-400 bg-orange-900/30 border-orange-700/40',
  Transported: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  Released: 'text-green-400 bg-green-900/30 border-green-700/40',
  Resolved: 'text-muted bg-surface-card border-border',
}

interface Dispatch {
  id: number
  player_name: string
  team_name: string | null
  injury_type: string
  trainer_name: string
  status: MedicalStatus
  notes: string | null
  dispatched_at: string
  field?: { name: string } | null
}

export function TrainerPortal() {
  const { userRole, signOut } = useAuth()
  const eventId = userRole?.event_id
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    loadDispatches()

    // Real-time subscription
    const sb = createClient()
    const sub = sb
      .channel('trainer-portal')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medical_incidents',
          filter: `event_id=eq.${eventId}`,
        },
        () => loadDispatches()
      )
      .subscribe()
    return () => {
      sb.removeChannel(sub)
    }
  }, [eventId])

  async function loadDispatches() {
    const sb = createClient()
    const { data } = await sb
      .from('medical_incidents')
      .select('*, field:fields(name)')
      .eq('event_id', eventId!)
      .neq('status', 'Resolved')
      .order('dispatched_at', { ascending: false })
    setDispatches((data as Dispatch[]) ?? [])
    setLoading(false)
  }

  async function advanceStatus(d: Dispatch) {
    const idx = STATUS_ORDER.indexOf(d.status)
    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return
    const next = STATUS_ORDER[idx + 1]
    setUpdating(d.id)
    const sb = createClient()
    await sb.from('medical_incidents').update({ status: next }).eq('id', d.id)
    await sb.from('ops_log').insert({
      event_id: eventId,
      message: `Medical: ${d.player_name} — status → ${next} (${d.trainer_name})`,
      log_type: next === 'Resolved' ? 'ok' : 'warn',
      occurred_at: new Date().toISOString(),
    })
    toast.success(`${d.player_name} → ${next}`)
    setUpdating(null)
    loadDispatches()
  }

  if (!eventId)
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="text-center">
          <div className="font-cond text-xl font-black text-white mb-2 tracking-widest">
            NO EVENT
          </div>
          <div className="font-cond text-sm text-muted mb-4">
            Your account is not linked to an event.
          </div>
          <button
            onClick={signOut}
            className="font-cond text-[11px] font-bold tracking-wider px-4 py-2 rounded bg-surface-card border border-border text-muted hover:text-white transition-colors"
          >
            SIGN OUT
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div
        className="border-b border-border px-4 py-3 flex items-center justify-between"
        style={{ background: '#081428' }}
      >
        <div>
          <div className="font-cond text-lg font-black text-white tracking-widest">
            TRAINER PORTAL
          </div>
          <div className="font-cond text-[11px] text-muted tracking-wide">
            Medical Dispatch Queue
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white transition-colors"
        >
          <LogOut size={14} />
          SIGN OUT
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="text-center py-12 font-cond text-muted tracking-widest">LOADING...</div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
            <div className="font-cond text-[13px] font-black text-white tracking-widest mb-1">
              ALL CLEAR
            </div>
            <div className="font-cond text-[11px] text-muted">No active medical dispatches</div>
          </div>
        ) : (
          dispatches.map((d) => {
            const idx = STATUS_ORDER.indexOf(d.status)
            const nextStatus = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null
            const time = new Date(d.dispatched_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })

            return (
              <div key={d.id} className="rounded-lg border border-border bg-surface-card p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-cond text-[15px] font-black text-white">
                      {d.player_name}
                    </div>
                    <div className="font-cond text-[11px] text-muted">
                      {d.team_name ?? '—'} · {d.field?.name ?? 'Unknown field'}
                    </div>
                  </div>
                  <span
                    className={`font-cond text-[10px] font-black tracking-[.1em] px-2 py-0.5 rounded-full border uppercase ${STATUS_COLOR[d.status]}`}
                  >
                    {d.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3 text-[11px]">
                  <span className="font-cond text-muted flex items-center gap-1">
                    <AlertCircle size={11} />
                    {d.injury_type}
                  </span>
                  <span className="font-cond text-muted flex items-center gap-1">
                    <Clock size={11} />
                    {time}
                  </span>
                </div>

                {d.notes && (
                  <div className="text-[11px] text-muted/80 bg-surface rounded px-2 py-1.5 mb-3 font-sans">
                    {d.notes}
                  </div>
                )}

                {nextStatus && (
                  <button
                    onClick={() => advanceStatus(d)}
                    disabled={updating === d.id}
                    className="w-full font-cond text-[11px] font-black tracking-wider py-2 rounded bg-navy hover:bg-navy-light text-white transition-colors disabled:opacity-50"
                  >
                    {updating === d.id ? 'UPDATING...' : `MARK ${nextStatus.toUpperCase()}`}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
