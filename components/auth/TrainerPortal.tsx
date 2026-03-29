'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

type PortalTab = 'checkin' | 'availability'

interface EventDate {
  id: number
  date: string
  label: string
}

interface Trainer {
  id: number
  name: string
  email: string | null
  phone: string | null
  certifications: string | null
  checked_in: boolean
}

export function TrainerPortal() {
  const { userRole, signOut } = useAuth()
  const portalEventId = userRole?.event_id
  const [tab, setTab] = useState<PortalTab>('checkin')
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [availability, setAvailability] = useState<
    Map<string, { from: string; to: string } | null>
  >(new Map())
  const [savingAvail, setSavingAvail] = useState<string | null>(null)
  const [weatherAlerts, setWeatherAlerts] = useState<
    { id: number; alert_type: string; description: string }[]
  >([])

  useEffect(() => {
    if (!portalEventId) return
    loadData()
  }, [userRole])

  async function loadData() {
    if (!portalEventId) return
    setLoading(true)
    const sb = createClient()

    // Find trainer by trainer_id from user_roles, or fallback to display_name match
    const trainerId = (userRole as any)?.trainer_id ?? null
    let trainerData: Trainer | null = null

    if (trainerId) {
      const { data } = await sb.from('trainers').select('*').eq('id', trainerId).single()
      trainerData = data
    } else if (userRole?.display_name) {
      const { data } = await sb
        .from('trainers')
        .select('*')
        .eq('event_id', portalEventId)
        .eq('name', userRole.display_name)
        .maybeSingle()
      trainerData = data
    }

    setTrainer(trainerData)
    setCheckedIn(trainerData?.checked_in ?? false)

    const [{ data: dates }, { data: availData }, { data: weatherData }] = await Promise.all([
      sb.from('event_dates').select('id, date, label').eq('event_id', portalEventId).order('date'),
      trainerData
        ? sb
            .from('trainer_availability')
            .select('date, available_from, available_to')
            .eq('trainer_id', trainerData.id)
        : Promise.resolve({ data: [] }),
      sb
        .from('weather_alerts')
        .select('id, alert_type, description')
        .eq('event_id', portalEventId)
        .eq('is_active', true),
    ])

    setEventDates((dates ?? []) as EventDate[])

    const availMap = new Map<string, { from: string; to: string } | null>()
    for (const a of availData ?? []) {
      availMap.set(a.date, { from: a.available_from.slice(0, 5), to: a.available_to.slice(0, 5) })
    }
    setAvailability(availMap)
    setWeatherAlerts(
      (weatherData ?? []) as { id: number; alert_type: string; description: string }[]
    )

    setLoading(false)
  }

  async function handleSelfCheckIn() {
    if (!trainer) return
    setCheckingIn(true)
    const sb = createClient()
    const newState = !checkedIn
    await sb.from('trainers').update({ checked_in: newState }).eq('id', trainer.id)
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `Trainer ${trainer.name} ${newState ? 'checked in' : 'checked out'} via portal`,
      log_type: newState ? 'ok' : 'info',
      occurred_at: new Date().toISOString(),
    })
    setCheckedIn(newState)
    setCheckingIn(false)
    toast.success(newState ? '✓ You are checked in!' : 'Checked out')
  }

  async function toggleAvailability(date: string) {
    if (!trainer) return
    const sb = createClient()
    const current = availability.get(date)
    if (current !== undefined) {
      await sb.from('trainer_availability').delete().eq('trainer_id', trainer.id).eq('date', date)
      setAvailability((prev) => {
        const next = new Map(prev)
        next.delete(date)
        return next
      })
    } else {
      const { error } = await sb.from('trainer_availability').insert({
        trainer_id: trainer.id,
        date,
        available_from: '08:00',
        available_to: '18:00',
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setAvailability((prev) => new Map(prev).set(date, { from: '08:00', to: '18:00' }))
    }
  }

  async function updateAvailTime(date: string, field: 'from' | 'to', value: string) {
    if (!trainer) return
    const current = availability.get(date)
    if (!current) return
    const updated = { ...current, [field]: value }
    setAvailability((prev) => new Map(prev).set(date, updated))
    setSavingAvail(date)
    const sb = createClient()
    await sb
      .from('trainer_availability')
      .update({ available_from: updated.from, available_to: updated.to })
      .eq('trainer_id', trainer.id)
      .eq('date', date)
    setSavingAvail(null)
  }

  if (!portalEventId) return null
  if (loading)
    return (
      <div className="h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )

  return (
    <div className="h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch flex-shrink-0">
        <div className="flex items-center gap-3 py-3 px-2">
          <div className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">
            TRAINER PORTAL
          </div>
        </div>
        <nav className="flex flex-1 ml-4">
          {(
            [
              { id: 'checkin', label: 'My Check-In' },
              { id: 'availability', label: 'Availability' },
            ] as { id: PortalTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 font-cond text-[12px] font-bold tracking-widest uppercase border-b-2 transition-colors',
                tab === t.id
                  ? 'border-red text-white'
                  : 'border-transparent text-muted hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 px-4">
          <div className={cn('w-2 h-2 rounded-full', checkedIn ? 'bg-green-400' : 'bg-red-400')} />
          <span className="font-cond text-[11px] text-white">{trainer?.name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white"
          >
            <LogOut size={13} /> OUT
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Weather alert banner */}
          {weatherAlerts.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {weatherAlerts
                .filter(
                  (alert, idx, arr) =>
                    arr.findIndex((a) => a.alert_type === alert.alert_type) === idx
                )
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg px-3 py-2"
                  >
                    <span className="text-yellow-400 text-[14px]">⚡</span>
                    <div>
                      <span className="font-cond text-[10px] font-black tracking-widest text-yellow-300 uppercase mr-2">
                        {alert.alert_type}
                      </span>
                      <span className="font-cond text-[11px] text-yellow-200">
                        {alert.description}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── CHECK-IN ── */}
          {tab === 'checkin' && (
            <div className="bg-surface-card border border-border rounded-xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-teal-900/30 border-2 border-teal-700/50 flex items-center justify-center mx-auto mb-3">
                <span className="font-cond font-black text-2xl text-teal-300">
                  {trainer?.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </span>
              </div>
              <div className="font-cond font-black text-[20px] text-white mb-0.5">
                {trainer?.name}
              </div>
              {trainer?.certifications && (
                <div className="font-cond text-[11px] text-muted mb-1">
                  {trainer.certifications}
                </div>
              )}
              {trainer?.phone && (
                <div className="font-cond text-[11px] text-muted mb-4">{trainer.phone}</div>
              )}
              {!trainer?.certifications && !trainer?.phone && <div className="mb-4" />}
              <button
                onClick={handleSelfCheckIn}
                disabled={checkingIn}
                className={cn(
                  'w-full py-4 rounded-xl font-cond font-black text-[16px] tracking-widest transition-all',
                  checkedIn
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-navy hover:bg-navy-light text-white border-2 border-border'
                )}
              >
                {checkingIn
                  ? 'UPDATING...'
                  : checkedIn
                    ? '✓ CHECKED IN — TAP TO CHECK OUT'
                    : 'TAP TO CHECK IN'}
              </button>
            </div>
          )}

          {/* ── AVAILABILITY ── */}
          {tab === 'availability' && (
            <div>
              {eventDates.length > 0 ? (
                <div className="bg-surface-card border border-border rounded-xl p-4">
                  <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                    MY AVAILABILITY
                  </div>
                  {!trainer ? (
                    <div className="font-cond text-[11px] text-muted">
                      No trainer record found for this account.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {eventDates.map((d) => {
                        const avail = availability.get(d.date)
                        const isAvail = avail !== undefined
                        return (
                          <div
                            key={d.id}
                            className={cn(
                              'rounded-lg border px-3 py-2',
                              isAvail
                                ? 'bg-green-900/15 border-green-700/40'
                                : 'bg-surface border-border/50'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-cond font-black text-[12px] text-white">
                                  {d.label}
                                </span>
                                <span className="font-cond text-[10px] text-muted ml-2">
                                  {format(new Date(d.date + 'T12:00:00'), 'EEE M/d')}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleAvailability(d.date)}
                                className={cn(
                                  'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                                  isAvail
                                    ? 'bg-green-700/60 border-green-600 text-green-200 hover:bg-green-700'
                                    : 'border-border text-muted hover:text-white hover:border-white/30'
                                )}
                              >
                                {isAvail ? 'AVAILABLE' : 'UNAVAILABLE'}
                              </button>
                            </div>
                            {isAvail && avail && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="font-cond text-[9px] text-muted uppercase">
                                  From
                                </span>
                                <input
                                  type="time"
                                  value={avail.from}
                                  onChange={(e) => updateAvailTime(d.date, 'from', e.target.value)}
                                  className="bg-surface border border-border rounded px-2 py-0.5 font-mono text-[11px] text-white focus:outline-none focus:border-green-500"
                                />
                                <span className="font-cond text-[9px] text-muted uppercase">
                                  To
                                </span>
                                <input
                                  type="time"
                                  value={avail.to}
                                  onChange={(e) => updateAvailTime(d.date, 'to', e.target.value)}
                                  className="bg-surface border border-border rounded px-2 py-0.5 font-mono text-[11px] text-white focus:outline-none focus:border-green-500"
                                />
                                {savingAvail === d.date && (
                                  <span className="font-cond text-[9px] text-muted">SAVING...</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="font-cond text-[11px] text-muted text-center py-8">
                  No event dates found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
