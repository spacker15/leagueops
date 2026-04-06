'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { AlertTriangle, Edit2, LogOut, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { EventDatePicker } from '@/components/ui/EventDatePicker'

type PortalTab = 'checkin' | 'availability' | 'schedule' | 'incidents'

const INJURY_TYPES = [
  'General / Unknown',
  'Head / Concussion',
  'Neck / Spine',
  'Upper Body',
  'Lower Body',
  'Laceration',
  'Heat Illness',
  'Cardiac',
]

const INCIDENT_STATUSES = ['Dispatched', 'En Route', 'On Scene', 'Resolved']

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

interface Field {
  id: number
  name: string
}

interface GameSummary {
  id: number
  event_date_id: number
  scheduled_time: string
  division: string
  status: string
  quarter: number | null
  home_score: number | null
  away_score: number | null
  field_id: number
  field: Field
  home_team: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  }
  away_team: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  }
}

function teamLogo(
  team:
    | { logo_url?: string | null; programs?: { logo_url?: string | null } | null }
    | null
    | undefined
): string | null {
  return team?.logo_url ?? team?.programs?.logo_url ?? null
}

interface Incident {
  id: number
  event_id: number
  game_id: number | null
  field_id: number | null
  player_name: string
  team_name: string
  injury_type: string
  trainer_name: string
  status: string
  notes: string | null
  dispatched_at: string
  field?: { id: number; name: string } | null
}

function timeToMin(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function isActiveIncident(inc: Incident) {
  return !['Resolved', 'Cleared', 'Cancelled'].includes(inc.status)
}

export function TrainerPortal() {
  const { userRole, signOut } = useAuth()
  const portalEventId = userRole?.event_id
  const [tab, setTab] = useState<PortalTab>('checkin')
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  // Availability
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [availability, setAvailability] = useState<
    Map<string, { from: string; to: string } | null>
  >(new Map())
  const [savingAvail, setSavingAvail] = useState<string | null>(null)

  // Weather
  const [weatherAlerts, setWeatherAlerts] = useState<
    { id: number; alert_type: string; description: string; complex?: { name: string } | null }[]
  >([])

  // Schedule
  const [allGames, setAllGames] = useState<GameSummary[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null)

  // Incidents
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [incForm, setIncForm] = useState({
    player_name: '',
    team_name: '',
    injury_type: 'General / Unknown',
    field_id: '',
    game_id: '',
    trainer_name: '',
    status: 'On Scene',
    notes: '',
  })
  const [savingInc, setSavingInc] = useState(false)

  useEffect(() => {
    if (!portalEventId) return
    loadData()
  }, [userRole])

  async function loadData() {
    if (!portalEventId) return
    setLoading(true)
    const sb = createClient()

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

    const [
      { data: dates },
      { data: availData },
      { data: weatherData },
      { data: gamesData },
      { data: fieldsData },
      { data: incidentsData },
    ] = await Promise.all([
      sb.from('event_dates').select('id, date, label').eq('event_id', portalEventId).order('date'),
      trainerData
        ? sb
            .from('trainer_availability')
            .select('date, available_from, available_to')
            .eq('trainer_id', trainerData.id)
        : Promise.resolve({ data: [] }),
      sb
        .from('weather_alerts')
        .select('id, alert_type, description, complex:complexes(name)')
        .eq('event_id', portalEventId)
        .eq('is_active', true),
      sb
        .from('games')
        .select(
          `id, event_date_id, scheduled_time, division, status, quarter, home_score, away_score, field_id,
           field:fields(id, name),
           home_team:teams!games_home_team_id_fkey(id, name, logo_url, programs(logo_url)),
           away_team:teams!games_away_team_id_fkey(id, name, logo_url, programs(logo_url))`
        )
        .eq('event_id', portalEventId)
        .neq('status', 'Cancelled'),
      sb.from('fields').select('id, name').eq('event_id', portalEventId).order('name'),
      sb
        .from('medical_incidents')
        .select('*, field:fields(id, name)')
        .eq('event_id', portalEventId)
        .order('dispatched_at', { ascending: false }),
    ])

    const datesArr = (dates ?? []) as EventDate[]
    setEventDates(datesArr)

    const availMap = new Map<string, { from: string; to: string } | null>()
    for (const a of availData ?? []) {
      availMap.set(a.date, { from: a.available_from.slice(0, 5), to: a.available_to.slice(0, 5) })
    }
    setAvailability(availMap)
    setWeatherAlerts(
      (weatherData ?? []) as { id: number; alert_type: string; description: string }[]
    )

    const games = ((gamesData ?? []) as unknown as GameSummary[]).sort(
      (a, b) => timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)
    )
    setAllGames(games)
    setFields((fieldsData ?? []) as Field[])
    setIncidents((incidentsData ?? []) as unknown as Incident[])

    // Default to today's date
    const today = new Date().toISOString().split('T')[0]
    const todayDate = datesArr.find((d) => d.date === today)
    const upcoming = datesArr.find((d) => d.date >= today)
    if (todayDate) setSelectedDateId(todayDate.id)
    else if (upcoming) setSelectedDateId(upcoming.id)

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
      const { error } = await sb
        .from('trainer_availability')
        .upsert(
          { trainer_id: trainer.id, date, available_from: '08:00', available_to: '18:00' },
          { onConflict: 'trainer_id,date' }
        )
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

  async function updateDispatchStatus(inc: Incident, status: string) {
    const sb = createClient()
    const patch: Record<string, string> = { status }
    if (status === 'En Route' && inc.status === 'Dispatched' && trainer) {
      patch.trainer_name = trainer.name
    }
    const { error } = await sb.from('medical_incidents').update(patch).eq('id', inc.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setIncidents((prev) => prev.map((i) => (i.id === inc.id ? { ...i, ...patch } : i)))
    toast.success(`Status: ${status}`)
  }

  function openNewIncident() {
    setEditingIncident(null)
    setIncForm({
      player_name: '',
      team_name: '',
      injury_type: 'General / Unknown',
      field_id: '',
      game_id: '',
      trainer_name: trainer?.name ?? '',
      status: 'On Scene',
      notes: '',
    })
    setShowIncidentForm(true)
  }

  function openEditIncident(inc: Incident) {
    setEditingIncident(inc)
    setIncForm({
      player_name: inc.player_name,
      team_name: inc.team_name ?? '',
      injury_type: inc.injury_type,
      field_id: String(inc.field_id ?? ''),
      game_id: String(inc.game_id ?? ''),
      trainer_name: inc.trainer_name,
      status: inc.status,
      notes: inc.notes ?? '',
    })
    setShowIncidentForm(true)
    setTab('incidents')
  }

  async function saveIncident() {
    setSavingInc(true)
    const sb = createClient()
    const payload = {
      event_id: portalEventId!,
      player_name: incForm.player_name || 'Unknown',
      team_name: incForm.team_name,
      injury_type: incForm.injury_type,
      field_id: incForm.field_id ? parseInt(incForm.field_id) : null,
      game_id: incForm.game_id ? parseInt(incForm.game_id) : null,
      trainer_name: incForm.trainer_name || trainer?.name || '',
      status: incForm.status,
      notes: incForm.notes || null,
    }
    if (editingIncident) {
      const { error } = await sb
        .from('medical_incidents')
        .update(payload)
        .eq('id', editingIncident.id)
      if (error) {
        toast.error(error.message)
        setSavingInc(false)
        return
      }
      toast.success('Incident updated')
    } else {
      const { error } = await sb
        .from('medical_incidents')
        .insert({ ...payload, dispatched_at: new Date().toISOString() })
      if (error) {
        toast.error(error.message)
        setSavingInc(false)
        return
      }
      toast.success('Incident created')
    }
    setSavingInc(false)
    setShowIncidentForm(false)
    await loadData()
  }

  if (!portalEventId) return null
  if (loading)
    return (
      <div className="h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )

  const activeDispatches = incidents.filter(isActiveIncident)
  const filteredGames =
    selectedDateId === null ? allGames : allGames.filter((g) => g.event_date_id === selectedDateId)
  const gamesByField = fields
    .map((f) => ({ field: f, games: filteredGames.filter((g) => g.field_id === f.id) }))
    .filter((g) => g.games.length > 0)

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
              { id: 'schedule', label: 'Schedule' },
              {
                id: 'incidents',
                label: `Incidents${activeDispatches.length > 0 ? ` (${activeDispatches.length})` : ''}`,
              },
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

      {/* Active dispatch banner */}
      {activeDispatches.length > 0 && (
        <div className="flex-shrink-0 border-b-2 border-red-600 bg-red-950/70 px-4 py-2.5 space-y-2">
          {activeDispatches.map((inc) => (
            <div key={inc.id} className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                <AlertTriangle size={13} className="text-red-300 flex-shrink-0" />
                <div className="min-w-0">
                  <span
                    className={cn(
                      'font-cond text-[10px] font-black tracking-widest uppercase mr-2',
                      inc.status === 'Dispatched' ? 'text-red-300' : 'text-orange-300'
                    )}
                  >
                    {inc.status === 'Dispatched' ? '🚨 DISPATCH' : inc.status.toUpperCase()}
                  </span>
                  <span className="font-cond font-black text-[12px] text-white">
                    {inc.player_name}
                  </span>
                  <span className="font-cond text-[11px] text-red-200 mx-1.5">·</span>
                  <span className="font-cond text-[11px] text-red-200">{inc.injury_type}</span>
                  {inc.field?.name && (
                    <>
                      <span className="font-cond text-[11px] text-red-200/60 mx-1.5">·</span>
                      <span className="font-cond text-[11px] text-red-200">{inc.field.name}</span>
                    </>
                  )}
                  <span className="font-cond text-[10px] text-red-400/70 ml-2">
                    {format(new Date(inc.dispatched_at), 'h:mm a')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {inc.status === 'Dispatched' && (
                  <button
                    onClick={() => updateDispatchStatus(inc, 'En Route')}
                    className="font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded bg-red-700 hover:bg-red-600 text-white border border-red-500 transition-colors"
                  >
                    ACCEPT
                  </button>
                )}
                {inc.status === 'En Route' && (
                  <button
                    onClick={() => updateDispatchStatus(inc, 'On Scene')}
                    className="font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded bg-orange-700 hover:bg-orange-600 text-white border border-orange-500 transition-colors"
                  >
                    ON SCENE
                  </button>
                )}
                {inc.status === 'On Scene' && (
                  <button
                    onClick={() => updateDispatchStatus(inc, 'Resolved')}
                    className="font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded bg-green-700 hover:bg-green-600 text-white border border-green-600 transition-colors"
                  >
                    RESOLVE
                  </button>
                )}
                <button
                  onClick={() => openEditIncident(inc)}
                  className="font-cond text-[10px] text-red-300/70 hover:text-white px-1.5 py-1 transition-colors"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                      {alert.complex?.name && (
                        <span className="font-cond text-[10px] text-yellow-400/70 ml-2">
                          — {alert.complex.name}
                        </span>
                      )}
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

          {/* ── SCHEDULE ── */}
          {tab === 'schedule' && (
            <div>
              {/* Date filter */}
              <EventDatePicker
                dates={eventDates}
                selectedId={selectedDateId}
                onChange={setSelectedDateId}
                className="mb-4"
              />
              {gamesByField.length === 0 ? (
                <div className="font-cond text-[11px] text-muted text-center py-8">
                  No games scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {gamesByField.map(({ field, games }) => (
                    <div
                      key={field.id}
                      className="bg-surface-card border border-border rounded-xl overflow-hidden"
                    >
                      <div className="bg-navy/60 px-4 py-2 border-b border-border">
                        <div className="font-cond font-black text-[13px] text-white tracking-wide">
                          {field.name}
                        </div>
                      </div>
                      <div className="divide-y divide-border/30">
                        {games.map((game) => {
                          const scoreVisible =
                            game.status === 'Live' ||
                            game.status === 'Halftime' ||
                            game.status === 'Final'
                          const quarterLabel =
                            game.status === 'Halftime'
                              ? 'HT'
                              : game.status === 'Live' && game.quarter
                                ? `Q${game.quarter}`
                                : null
                          return (
                            <div key={game.id} className="flex items-center px-4 py-2.5 gap-3">
                              <span className="font-mono text-[11px] font-bold text-blue-300 flex-shrink-0 w-14">
                                {game.scheduled_time}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 font-cond font-bold text-[12px] text-white">
                                  {teamLogo(game.home_team) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={teamLogo(game.home_team)!}
                                      alt=""
                                      className="w-3.5 h-3.5 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <span className="truncate">{game.home_team.name}</span>
                                </div>
                                <div className="font-cond text-[9px] text-muted pl-4">vs</div>
                                <div className="flex items-center gap-1 font-cond font-bold text-[12px] text-white">
                                  {teamLogo(game.away_team) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={teamLogo(game.away_team)!}
                                      alt=""
                                      className="w-3.5 h-3.5 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <span className="truncate">{game.away_team.name}</span>
                                </div>
                                <div className="font-cond text-[10px] text-muted">
                                  {game.division}
                                </div>
                              </div>
                              {scoreVisible && (
                                <div className="font-mono text-[12px] font-bold text-white flex-shrink-0">
                                  {game.home_score ?? 0}–{game.away_score ?? 0}
                                </div>
                              )}
                              <span
                                className={cn(
                                  'font-cond text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0',
                                  game.status === 'Live'
                                    ? 'badge-live'
                                    : game.status === 'Final'
                                      ? 'badge-final'
                                      : game.status === 'Halftime'
                                        ? 'badge-halftime'
                                        : 'badge-scheduled'
                                )}
                              >
                                {quarterLabel ?? game.status.toUpperCase()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INCIDENTS ── */}
          {tab === 'incidents' && (
            <div>
              {!showIncidentForm && (
                <button
                  onClick={openNewIncident}
                  className="w-full mb-4 flex items-center justify-center gap-2 font-cond font-black text-[13px] tracking-widest py-3 rounded-xl bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-200 transition-colors"
                >
                  <Plus size={14} />
                  START INCIDENT REPORT
                </button>
              )}

              {showIncidentForm && (
                <div className="bg-surface-card border border-red-800/50 rounded-xl p-4 mb-4">
                  <div className="font-cond text-[10px] font-black tracking-widest text-red-300 uppercase mb-3">
                    {editingIncident ? 'EDIT INCIDENT' : 'NEW INCIDENT REPORT'}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">
                          Patient Name
                        </div>
                        <input
                          type="text"
                          value={incForm.player_name}
                          onChange={(e) =>
                            setIncForm((p) => ({ ...p, player_name: e.target.value }))
                          }
                          placeholder="Name (optional)"
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white placeholder:text-muted focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">Team</div>
                        <input
                          type="text"
                          value={incForm.team_name}
                          onChange={(e) => setIncForm((p) => ({ ...p, team_name: e.target.value }))}
                          placeholder="Team (optional)"
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white placeholder:text-muted focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">
                          Injury Type
                        </div>
                        <select
                          value={incForm.injury_type}
                          onChange={(e) =>
                            setIncForm((p) => ({ ...p, injury_type: e.target.value }))
                          }
                          className="w-full bg-surface-card border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white focus:outline-none focus:border-red-500"
                        >
                          {INJURY_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">Field</div>
                        <select
                          value={incForm.field_id}
                          onChange={(e) => setIncForm((p) => ({ ...p, field_id: e.target.value }))}
                          className="w-full bg-surface-card border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white focus:outline-none focus:border-red-500"
                        >
                          <option value="">— Select field —</option>
                          {fields.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">Status</div>
                        <select
                          value={incForm.status}
                          onChange={(e) => setIncForm((p) => ({ ...p, status: e.target.value }))}
                          className="w-full bg-surface-card border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white focus:outline-none focus:border-red-500"
                        >
                          {INCIDENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="font-cond text-[9px] text-muted uppercase mb-1">
                          Trainer
                        </div>
                        <input
                          type="text"
                          value={incForm.trainer_name}
                          onChange={(e) =>
                            setIncForm((p) => ({ ...p, trainer_name: e.target.value }))
                          }
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-cond text-[9px] text-muted uppercase mb-1">Notes</div>
                      <textarea
                        value={incForm.notes}
                        onChange={(e) => setIncForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        placeholder="Clinical notes, observations..."
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white placeholder:text-muted focus:outline-none focus:border-red-500 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveIncident}
                        disabled={savingInc}
                        className="flex-1 font-cond font-black text-[12px] tracking-widest py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
                      >
                        {savingInc ? 'SAVING...' : editingIncident ? 'UPDATE' : 'CREATE REPORT'}
                      </button>
                      <button
                        onClick={() => setShowIncidentForm(false)}
                        className="font-cond text-[12px] text-muted hover:text-white px-4 py-2.5 rounded-lg border border-border transition-colors"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {incidents.length === 0 ? (
                <div className="font-cond text-[11px] text-muted text-center py-8">
                  No incidents recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {incidents.map((inc) => {
                    const active = isActiveIncident(inc)
                    return (
                      <div
                        key={inc.id}
                        className={cn(
                          'bg-surface-card border rounded-xl p-3',
                          active ? 'border-red-800/60' : 'border-border/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <span className="font-cond font-black text-[13px] text-white">
                              {inc.player_name}
                            </span>
                            {inc.team_name && (
                              <span className="font-cond text-[11px] text-muted ml-2">
                                {inc.team_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={cn(
                                'font-cond text-[9px] font-black tracking-widest px-2 py-0.5 rounded',
                                inc.status === 'Dispatched'
                                  ? 'bg-red-900/60 text-red-200'
                                  : inc.status === 'En Route'
                                    ? 'bg-orange-900/60 text-orange-200'
                                    : inc.status === 'On Scene'
                                      ? 'bg-yellow-900/60 text-yellow-200'
                                      : 'bg-green-900/60 text-green-200'
                              )}
                            >
                              {inc.status.toUpperCase()}
                            </span>
                            <button
                              onClick={() => openEditIncident(inc)}
                              className="text-muted hover:text-white transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-cond text-[11px] text-red-300">
                            {inc.injury_type}
                          </span>
                          {inc.field?.name && (
                            <span className="font-cond text-[11px] text-muted">
                              · {inc.field.name}
                            </span>
                          )}
                          {inc.trainer_name && (
                            <span className="font-cond text-[11px] text-muted">
                              · {inc.trainer_name}
                            </span>
                          )}
                          <span className="font-cond text-[10px] text-muted/60">
                            {format(new Date(inc.dispatched_at), 'M/d h:mm a')}
                          </span>
                        </div>
                        {inc.notes && (
                          <div className="font-cond text-[11px] text-muted/80 mt-1 italic">
                            {inc.notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
