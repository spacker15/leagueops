'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, LogOut, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

type PortalTab = 'checkin' | 'games' | 'approvals' | 'availability'

const VOL_POSITIONS = ['Line Judge', 'Timekeeper', 'Ball Retriever', 'Gate', 'General']

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  Scheduled: [{ label: 'START GAME', next: 'Live', color: 'bg-green-700 hover:bg-green-600' }],
  Starting: [{ label: 'START GAME', next: 'Live', color: 'bg-green-700 hover:bg-green-600' }],
  Live: [
    { label: 'HALFTIME', next: 'Halftime', color: 'bg-yellow-700 hover:bg-yellow-600' },
    { label: 'END GAME', next: 'Final', color: 'bg-red hover:opacity-90' },
  ],
  Halftime: [
    { label: '2ND HALF', next: 'Live', color: 'bg-green-700 hover:bg-green-600' },
    { label: 'END GAME', next: 'Final', color: 'bg-red hover:opacity-90' },
  ],
  Delayed: [{ label: 'RESUME', next: 'Live', color: 'bg-green-700 hover:bg-green-600' }],
}

interface Field {
  id: number
  name: string
}

interface EventDate {
  id: number
  date: string
  label: string
}

interface GameSummary {
  id: number
  event_date_id: number
  scheduled_time: string
  division: string
  status: string
  home_score: number | null
  away_score: number | null
  field_id: number
  field: Field
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
}

interface VolSlot {
  role: string
  volunteer_id: number
  volunteer?: { name: string }
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

export function VolunteerPortal() {
  const { userRole, signOut } = useAuth()
  const portalEventId = userRole?.event_id
  const [tab, setTab] = useState<PortalTab>('checkin')
  const [vol, setVol] = useState<any>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [todayLabel, setTodayLabel] = useState('')

  const [allGames, setAllGames] = useState<GameSummary[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [myAssignedGameIds, setMyAssignedGameIds] = useState<Set<number>>(new Set())
  const [myAssignmentRoles, setMyAssignmentRoles] = useState<Map<number, string[]>>(new Map())
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null)

  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null)
  const [gameSlots, setGameSlots] = useState<VolSlot[]>([])
  const [slotLoading, setSlotLoading] = useState(false)

  const [homePlayers, setHomePlayers] = useState<any[]>([])
  const [awayPlayers, setAwayPlayers] = useState<any[]>([])
  const [checkins, setCheckins] = useState<number[]>([])

  const [availability, setAvailability] = useState<
    Map<string, { from: string; to: string } | null>
  >(new Map())
  const [savingAvail, setSavingAvail] = useState<string | null>(null)

  const [weatherAlerts, setWeatherAlerts] = useState<
    { id: number; alert_type: string; description: string }[]
  >([])

  useEffect(() => {
    if (!portalEventId) return
    if (!userRole?.volunteer_id) {
      // Auto-create volunteer record for users who don't have one yet
      createVolunteerRecord()
      return
    }
    loadData()
  }, [userRole])

  async function createVolunteerRecord() {
    if (!portalEventId || !userRole?.id) return
    const sb = createClient()
    const name = userRole.display_name ?? 'Volunteer'
    const { data: newVol, error } = await sb
      .from('volunteers')
      .insert({ event_id: portalEventId, name, role: 'Operations' })
      .select('id')
      .single()
    if (error || !newVol) {
      toast.error('Could not create volunteer record')
      return
    }
    await sb.from('user_roles').update({ volunteer_id: newVol.id }).eq('id', userRole.id)
    // Reload the page so auth context re-reads the updated role
    window.location.reload()
  }

  async function loadData() {
    const sb = createClient()
    setLoading(true)
    const [
      { data: volData },
      { data: gamesData },
      { data: fieldsData },
      { data: myAssignData },
      { data: eventDates },
      { data: availData },
      { data: weatherData },
    ] = await Promise.all([
      sb.from('volunteers').select('*').eq('id', userRole!.volunteer_id!).single(),
      sb
        .from('games')
        .select(
          `id, event_date_id, scheduled_time, division, status, home_score, away_score, field_id,
           field:fields(id, name),
           home_team:teams!games_home_team_id_fkey(id, name),
           away_team:teams!games_away_team_id_fkey(id, name)`
        )
        .eq('event_id', portalEventId!)
        .neq('status', 'Cancelled'),
      sb.from('fields').select('id, name').eq('event_id', portalEventId!).order('name'),
      sb
        .from('vol_assignments')
        .select('game_id, role')
        .eq('volunteer_id', userRole!.volunteer_id!),
      sb
        .from('event_dates')
        .select('id, date, label, day_number')
        .eq('event_id', portalEventId!)
        .order('date'),
      sb
        .from('volunteer_availability')
        .select('date, available_from, available_to')
        .eq('volunteer_id', userRole!.volunteer_id!),
      sb
        .from('weather_alerts')
        .select('id, alert_type, description')
        .eq('event_id', portalEventId!)
        .eq('is_active', true),
    ])

    setVol(volData)
    setCheckedIn(volData?.checked_in ?? false)
    const games = ((gamesData ?? []) as unknown as GameSummary[]).sort(
      (a, b) => timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)
    )
    setAllGames(games)
    setFields((fieldsData ?? []) as Field[])
    setMyAssignedGameIds(new Set((myAssignData ?? []).map((a: any) => a.game_id)))
    const rolesMap = new Map<number, string[]>()
    for (const a of myAssignData ?? []) {
      const existing = rolesMap.get(a.game_id) ?? []
      rolesMap.set(a.game_id, [...existing, a.role])
    }
    setMyAssignmentRoles(rolesMap)

    const dates = (eventDates ?? []) as EventDate[]
    setEventDates(dates)

    const today = new Date().toISOString().split('T')[0]
    const todayDate = dates.find((d) => d.date === today)
    const upcomingDate = dates.find((d) => d.date >= today)
    const defaultDate = todayDate ?? upcomingDate ?? null
    if (defaultDate) setSelectedDateId(defaultDate.id)

    if (todayDate) {
      setTodayLabel(
        `${todayDate.label} — ${format(new Date(todayDate.date + 'T12:00:00'), 'EEEE, MMMM d')}`
      )
    } else if (upcomingDate) {
      setTodayLabel(
        `Next: ${upcomingDate.label} — ${format(new Date(upcomingDate.date + 'T12:00:00'), 'EEEE, MMMM d')}`
      )
    }
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

  async function loadGameDetail(game: GameSummary) {
    setSelectedGame(game)
    setSlotLoading(true)
    setGameSlots([])
    setHomePlayers([])
    setAwayPlayers([])
    setCheckins([])
    const sb = createClient()
    const [{ data: slots }, { data: home }, { data: away }, { data: ci }] = await Promise.all([
      sb
        .from('vol_assignments')
        .select(`role, volunteer_id, volunteer:volunteers(name)`)
        .eq('game_id', game.id),
      sb
        .from('players')
        .select('id, name, number, position, usa_lacrosse_number')
        .eq('team_id', game.home_team.id)
        .order('name'),
      sb
        .from('players')
        .select('id, name, number, position, usa_lacrosse_number')
        .eq('team_id', game.away_team.id)
        .order('name'),
      sb.from('player_checkins').select('player_id').eq('game_id', game.id),
    ])
    setGameSlots((slots ?? []) as unknown as VolSlot[])
    setHomePlayers(home ?? [])
    setAwayPlayers(away ?? [])
    setCheckins((ci ?? []).map((c: any) => c.player_id))
    setSlotLoading(false)
  }

  async function takePosition(role: string) {
    if (!selectedGame || !userRole?.volunteer_id) return
    const sb = createClient()
    const { error } = await sb.from('vol_assignments').insert({
      game_id: selectedGame.id,
      volunteer_id: userRole.volunteer_id,
      role,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Assigned as ${role}`)
    setMyAssignedGameIds((prev) => new Set([...prev, selectedGame.id]))
    loadGameDetail(selectedGame)
  }

  async function dropPosition(role: string) {
    if (!selectedGame || !userRole?.volunteer_id) return
    const sb = createClient()
    await sb
      .from('vol_assignments')
      .delete()
      .eq('game_id', selectedGame.id)
      .eq('volunteer_id', userRole.volunteer_id)
      .eq('role', role)
    toast('Dropped position', { icon: '↩' })
    const remaining = gameSlots.filter(
      (s) => s.volunteer_id === userRole.volunteer_id && s.role !== role
    )
    if (remaining.length === 0) {
      setMyAssignedGameIds((prev) => {
        const next = new Set(prev)
        next.delete(selectedGame.id)
        return next
      })
    }
    loadGameDetail(selectedGame)
  }

  async function updateGameStatus(newStatus: string) {
    if (!selectedGame) return
    const sb = createClient()
    const { error } = await sb.from('games').update({ status: newStatus }).eq('id', selectedGame.id)
    if (error) {
      toast.error(error.message)
      return
    }
    const updated = { ...selectedGame, status: newStatus }
    setSelectedGame(updated)
    setAllGames((prev) => prev.map((g) => (g.id === selectedGame.id ? updated : g)))
    toast.success(`Game: ${newStatus}`)
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `${vol?.name} updated ${selectedGame.home_team.name} vs ${selectedGame.away_team.name} → ${newStatus}`,
      log_type: 'info',
      occurred_at: new Date().toISOString(),
    })
  }

  async function updateScore(team: 'home' | 'away', delta: number) {
    if (!selectedGame) return
    const sb = createClient()
    const field = team === 'home' ? 'home_score' : 'away_score'
    const current = (team === 'home' ? selectedGame.home_score : selectedGame.away_score) ?? 0
    const newVal = Math.max(0, current + delta)
    const { error } = await sb
      .from('games')
      .update({ [field]: newVal })
      .eq('id', selectedGame.id)
    if (error) {
      toast.error(error.message)
      return
    }
    const updated = { ...selectedGame, [field]: newVal }
    setSelectedGame(updated)
    setAllGames((prev) => prev.map((g) => (g.id === selectedGame.id ? updated : g)))
  }

  async function handleSelfCheckIn() {
    if (!userRole?.volunteer_id) return
    setCheckingIn(true)
    const sb = createClient()
    const newState = !checkedIn
    await sb.from('volunteers').update({ checked_in: newState }).eq('id', userRole.volunteer_id)
    await sb.from('portal_checkins').insert({
      person_type: 'volunteer',
      person_id: userRole.volunteer_id,
      event_id: portalEventId,
      checked_in: newState,
    })
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `Volunteer ${vol?.name} ${newState ? 'checked in' : 'checked out'} via portal`,
      log_type: newState ? 'ok' : 'info',
      occurred_at: new Date().toISOString(),
    })
    setCheckedIn(newState)
    setCheckingIn(false)
    toast.success(newState ? '✓ You are checked in!' : 'Checked out')
  }

  async function toggleAvailability(date: string) {
    if (!userRole?.volunteer_id) return
    const sb = createClient()
    const current = availability.get(date)
    if (current !== undefined) {
      await sb
        .from('volunteer_availability')
        .delete()
        .eq('volunteer_id', userRole.volunteer_id)
        .eq('date', date)
      setAvailability((prev) => {
        const next = new Map(prev)
        next.delete(date)
        return next
      })
    } else {
      const { error } = await sb.from('volunteer_availability').insert({
        volunteer_id: userRole.volunteer_id,
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
    if (!userRole?.volunteer_id) return
    const current = availability.get(date)
    if (!current) return
    const updated = { ...current, [field]: value }
    setAvailability((prev) => new Map(prev).set(date, updated))
    setSavingAvail(date)
    const sb = createClient()
    await sb
      .from('volunteer_availability')
      .update({
        available_from: updated.from,
        available_to: updated.to,
      })
      .eq('volunteer_id', userRole.volunteer_id)
      .eq('date', date)
    setSavingAvail(null)
  }

  async function togglePlayerCheckin(playerId: number) {
    if (!selectedGame) return
    const sb = createClient()
    const isIn = checkins.includes(playerId)
    if (isIn) {
      await sb
        .from('player_checkins')
        .delete()
        .eq('game_id', selectedGame.id)
        .eq('player_id', playerId)
      setCheckins((prev) => prev.filter((id) => id !== playerId))
      toast('Player checked out', { icon: '↩' })
    } else {
      await sb.from('player_checkins').upsert({
        game_id: selectedGame.id,
        player_id: playerId,
        checked_in_at: new Date().toISOString(),
      })
      setCheckins((prev) => [...prev, playerId])
      toast.success('Player checked in')
    }
  }

  if (!portalEventId) return null
  if (loading)
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )

  const isAssigned = selectedGame
    ? gameSlots.some((s) => s.volunteer_id === userRole?.volunteer_id)
    : false

  return (
    <div className="h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch">
        <div className="flex items-center gap-3 py-3 px-2">
          <div className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">
            VOLUNTEER PORTAL
          </div>
        </div>
        <nav className="flex flex-1 ml-4">
          {[
            { id: 'checkin', label: 'My Check-In' },
            { id: 'games', label: `Games (${allGames.length})` },
            { id: 'availability', label: 'Availability' },
            { id: 'approvals', label: 'Approvals' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as PortalTab)}
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
          <span className="font-cond text-[11px] text-white">{vol?.name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white"
          >
            <LogOut size={13} /> OUT
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {weatherAlerts.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {weatherAlerts.map((alert) => (
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
          {/* ── MY CHECK-IN ── */}
          {tab === 'checkin' && (
            <div>
              {/* Date picker */}
              {eventDates.length > 0 && (
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  <button
                    onClick={() => setSelectedDateId(null)}
                    className={cn(
                      'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                      selectedDateId === null
                        ? 'bg-navy border-blue-500 text-white'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    ALL
                  </button>
                  {eventDates.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDateId(d.id)}
                      className={cn(
                        'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                        selectedDateId === d.id
                          ? 'bg-red border-red text-white'
                          : 'border-border text-muted hover:text-white'
                      )}
                    >
                      {d.label}
                      <span
                        className={cn(
                          'ml-1 font-normal normal-case tracking-normal',
                          selectedDateId === d.id ? 'text-red-200' : 'text-muted'
                        )}
                      >
                        {format(new Date(d.date + 'T12:00:00'), 'M/d')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {todayLabel && (
                <div className="bg-navy/40 border border-border rounded-lg px-4 py-2.5 mb-4 text-center">
                  <span className="font-cond text-[11px] font-black tracking-widest text-blue-300 uppercase">
                    {todayLabel}
                  </span>
                </div>
              )}
              <div className="bg-surface-card border border-border rounded-xl p-6 text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-blue-900/30 border-2 border-blue-700/50 flex items-center justify-center mx-auto mb-3">
                  <span className="font-cond font-black text-2xl text-blue-300">
                    {vol?.name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="font-cond font-black text-[20px] text-white mb-0.5">
                  {vol?.name}
                </div>
                <div className="font-cond text-[12px] text-muted mb-4">{vol?.role}</div>
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

              {(() => {
                const filteredAssigned = allGames.filter(
                  (g) =>
                    myAssignedGameIds.has(g.id) &&
                    (selectedDateId === null || g.event_date_id === selectedDateId)
                )
                if (filteredAssigned.length === 0) return null
                return (
                  <>
                    <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
                      MY ASSIGNED GAMES ({filteredAssigned.length})
                    </div>
                    <div className="space-y-2">
                      {filteredAssigned.map((game) => {
                        const roles = myAssignmentRoles.get(game.id) ?? []
                        return (
                          <button
                            key={game.id}
                            onClick={() => {
                              setTab('games')
                              setSelectedFieldId(game.field_id)
                              loadGameDetail(game)
                            }}
                            className="w-full text-left bg-surface-card border border-green-800/40 hover:border-green-400/60 rounded-xl p-3 transition-all"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[12px] font-bold text-blue-300">
                                {game.scheduled_time}
                              </span>
                              <span
                                className={cn(
                                  'font-cond text-[10px] font-black px-2 py-0.5 rounded',
                                  game.status === 'Live'
                                    ? 'badge-live'
                                    : game.status === 'Final'
                                      ? 'badge-final'
                                      : 'badge-scheduled'
                                )}
                              >
                                {game.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="font-cond font-black text-[13px] text-white mt-0.5">
                              {game.home_team.name} vs {game.away_team.name}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="font-cond text-[10px] text-muted">
                                {game.field.name} · {game.division}
                              </span>
                              {roles.length > 0 && (
                                <div className="flex gap-1">
                                  {roles.map((r) => (
                                    <span
                                      key={r}
                                      className="font-cond text-[9px] font-black text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ── GAMES TAB ── */}
          {tab === 'games' && (
            <div>
              {/* Date picker */}
              {eventDates.length > 0 && (
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  <button
                    onClick={() => setSelectedDateId(null)}
                    className={cn(
                      'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                      selectedDateId === null
                        ? 'bg-navy border-blue-500 text-white'
                        : 'border-border text-muted hover:text-white'
                    )}
                  >
                    ALL
                  </button>
                  {eventDates.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedDateId(d.id)
                        setSelectedFieldId(null)
                        setSelectedGame(null)
                      }}
                      className={cn(
                        'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                        selectedDateId === d.id
                          ? 'bg-red border-red text-white'
                          : 'border-border text-muted hover:text-white'
                      )}
                    >
                      {d.label}
                      <span
                        className={cn(
                          'ml-1 font-normal normal-case tracking-normal',
                          selectedDateId === d.id ? 'text-red-200' : 'text-muted'
                        )}
                      >
                        {format(new Date(d.date + 'T12:00:00'), 'M/d')}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Field selector */}
              {!selectedFieldId && (
                <>
                  <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
                    SELECT A FIELD
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {fields.map((field) => {
                      const fieldGames = allGames.filter(
                        (g) =>
                          g.field_id === field.id &&
                          (selectedDateId === null || g.event_date_id === selectedDateId)
                      )
                      const myCount = fieldGames.filter((g) => myAssignedGameIds.has(g.id)).length
                      if (fieldGames.length === 0) return null
                      return (
                        <button
                          key={field.id}
                          onClick={() => {
                            setSelectedFieldId(field.id)
                            setSelectedGame(null)
                          }}
                          className="bg-surface-card border border-border hover:border-blue-400 rounded-xl p-4 text-left transition-all"
                        >
                          <div className="font-cond font-black text-[15px] text-white mb-1">
                            {field.name}
                          </div>
                          <div className="font-cond text-[11px] text-muted">
                            {fieldGames.length} game{fieldGames.length !== 1 ? 's' : ''}
                          </div>
                          {myCount > 0 && (
                            <div className="font-cond text-[10px] text-green-400 mt-1">
                              ● {myCount} assigned to you
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Game list for selected field */}
              {selectedFieldId && !selectedGame && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setSelectedFieldId(null)}
                      className="text-muted hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="font-cond font-black text-[14px] text-white">
                      {fields.find((f) => f.id === selectedFieldId)?.name}
                    </div>
                  </div>

                  <div
                    className="space-y-2 overflow-y-auto"
                    style={{ maxHeight: 'calc(100vh - 220px)' }}
                  >
                    {allGames
                      .filter(
                        (g) =>
                          g.field_id === selectedFieldId &&
                          (selectedDateId === null || g.event_date_id === selectedDateId)
                      )
                      .map((game) => {
                        const mine = myAssignedGameIds.has(game.id)
                        const roles = myAssignmentRoles.get(game.id) ?? []
                        return (
                          <button
                            key={game.id}
                            onClick={() => loadGameDetail(game)}
                            className={cn(
                              'w-full text-left rounded-xl p-4 border transition-all',
                              mine
                                ? 'bg-green-900/15 border-green-800/50 hover:border-green-400'
                                : 'bg-surface-card border-border hover:border-blue-400'
                            )}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-mono text-[13px] font-bold text-blue-300">
                                {game.scheduled_time}
                              </span>
                              <div className="flex items-center gap-2">
                                {mine && roles.length > 0 && (
                                  <div className="flex gap-1">
                                    {roles.map((r) => (
                                      <span
                                        key={r}
                                        className="font-cond text-[9px] font-black text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <span
                                  className={cn(
                                    'font-cond text-[10px] font-black px-2 py-0.5 rounded',
                                    game.status === 'Live'
                                      ? 'badge-live'
                                      : game.status === 'Final'
                                        ? 'badge-final'
                                        : 'badge-scheduled'
                                  )}
                                >
                                  {game.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="font-cond font-black text-[14px] text-white">
                              {game.home_team.name} vs {game.away_team.name}
                            </div>
                            <div className="font-cond text-[10px] text-muted mt-0.5">
                              {game.division}
                            </div>
                            {weatherAlerts.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-yellow-400 text-[10px]">⚡</span>
                                <span className="font-cond text-[9px] text-yellow-300">
                                  Weather alert active
                                </span>
                              </div>
                            )}
                            {(game.status === 'Live' ||
                              game.status === 'Halftime' ||
                              game.status === 'Final') && (
                              <div className="font-mono text-[13px] font-bold text-white mt-1">
                                {game.home_score ?? 0} — {game.away_score ?? 0}
                              </div>
                            )}
                          </button>
                        )
                      })}
                  </div>
                </>
              )}

              {/* Game detail */}
              {selectedGame && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="text-muted hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="font-cond font-black text-[14px] text-white">
                      {selectedGame.home_team.name} vs {selectedGame.away_team.name}
                    </div>
                  </div>

                  {/* Game header */}
                  <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-[12px] font-bold text-blue-300">
                          {selectedGame.scheduled_time}
                        </div>
                        <div className="font-cond font-black text-[18px] text-white">
                          {selectedGame.home_team.name} vs {selectedGame.away_team.name}
                        </div>
                        <div className="font-cond text-[11px] text-muted">
                          {selectedGame.field.name} · {selectedGame.division}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'font-cond text-[11px] font-black px-2 py-1 rounded',
                          selectedGame.status === 'Live'
                            ? 'badge-live'
                            : selectedGame.status === 'Final'
                              ? 'badge-final'
                              : selectedGame.status === 'Halftime'
                                ? 'badge-halftime'
                                : 'badge-scheduled'
                        )}
                      >
                        {selectedGame.status.toUpperCase()}
                      </span>
                    </div>
                    {(selectedGame.status === 'Live' ||
                      selectedGame.status === 'Halftime' ||
                      selectedGame.status === 'Final') && (
                      <div className="text-center font-mono text-[32px] font-bold text-white mt-3">
                        {selectedGame.home_score ?? 0} — {selectedGame.away_score ?? 0}
                      </div>
                    )}
                  </div>

                  {slotLoading ? (
                    <div className="text-center py-6 text-muted font-cond">LOADING...</div>
                  ) : (
                    <>
                      {/* Position slots */}
                      <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                        <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                          VOLUNTEER POSITIONS
                        </div>
                        <div className="space-y-2">
                          {VOL_POSITIONS.map((pos) => {
                            const slot = gameSlots.find((s) => s.role === pos)
                            const isMe = slot?.volunteer_id === userRole?.volunteer_id
                            const isEmpty = !slot
                            return (
                              <div
                                key={pos}
                                className={cn(
                                  'flex items-center justify-between rounded-lg px-3 py-2.5 border',
                                  isMe
                                    ? 'bg-green-900/20 border-green-700/50'
                                    : isEmpty
                                      ? 'bg-surface border-border/50'
                                      : 'bg-navy/20 border-border/50'
                                )}
                              >
                                <div>
                                  <span className="font-cond text-[11px] font-black text-muted uppercase tracking-wide">
                                    {pos}
                                  </span>
                                  {slot && (
                                    <span className="font-cond text-[12px] font-bold text-white ml-2">
                                      {isMe
                                        ? '(You)'
                                        : ((slot.volunteer as any)?.name ?? 'Assigned')}
                                    </span>
                                  )}
                                  {isEmpty && (
                                    <span className="font-cond text-[12px] text-muted ml-2">
                                      — OPEN
                                    </span>
                                  )}
                                </div>
                                {isMe ? (
                                  <button
                                    onClick={() => dropPosition(pos)}
                                    className="font-cond text-[10px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800/50 hover:bg-red-900/20 transition-colors"
                                  >
                                    DROP
                                  </button>
                                ) : isEmpty ? (
                                  <button
                                    onClick={() => takePosition(pos)}
                                    className="font-cond text-[10px] font-bold text-green-400 px-2 py-1 rounded border border-green-700/50 bg-green-900/20 hover:bg-green-800/40 transition-colors"
                                  >
                                    TAKE
                                  </button>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Game control (assigned volunteers only) */}
                      {isAssigned &&
                        selectedGame.status !== 'Final' &&
                        selectedGame.status !== 'Cancelled' && (
                          <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                              GAME CONTROL
                            </div>

                            {(selectedGame.status === 'Live' ||
                              selectedGame.status === 'Halftime') && (
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {(
                                  [
                                    {
                                      label: selectedGame.home_team.name,
                                      team: 'home' as const,
                                      score: selectedGame.home_score ?? 0,
                                    },
                                    {
                                      label: selectedGame.away_team.name,
                                      team: 'away' as const,
                                      score: selectedGame.away_score ?? 0,
                                    },
                                  ] as const
                                ).map(({ label, team, score }) => (
                                  <div
                                    key={team}
                                    className="bg-surface border border-border rounded-lg p-3 text-center"
                                  >
                                    <div className="font-cond text-[11px] text-muted mb-2 truncate">
                                      {label}
                                    </div>
                                    <div className="font-mono text-[28px] font-bold text-white mb-2">
                                      {score}
                                    </div>
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() => updateScore(team, -1)}
                                        className="w-9 h-9 rounded-lg bg-navy border border-border font-cond font-black text-[16px] text-muted hover:text-white transition-colors"
                                      >
                                        −
                                      </button>
                                      <button
                                        onClick={() => updateScore(team, 1)}
                                        className="w-9 h-9 rounded-lg bg-green-800 border border-green-700/50 font-cond font-black text-[16px] text-white hover:bg-green-700 transition-colors"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 flex-wrap">
                              {(STATUS_ACTIONS[selectedGame.status] ?? []).map((action) => (
                                <button
                                  key={action.next}
                                  onClick={() => updateGameStatus(action.next)}
                                  className={cn(
                                    'flex-1 py-3 rounded-xl font-cond font-black text-[13px] tracking-widest text-white transition-colors',
                                    action.color
                                  )}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Player check-in (assigned volunteers only) */}
                      {isAssigned && (
                        <div>
                          <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
                            PLAYER CHECK-IN
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: selectedGame.home_team.name, players: homePlayers },
                              { label: selectedGame.away_team.name, players: awayPlayers },
                            ].map(({ label, players }) => (
                              <div
                                key={label}
                                className="bg-surface-card border border-border rounded-xl overflow-hidden"
                              >
                                <div className="bg-navy/60 px-3 py-2.5 border-b border-border flex justify-between items-center">
                                  <div className="font-cond font-black text-[13px] text-white">
                                    {label}
                                  </div>
                                  <div className="font-cond text-[11px] text-green-400 font-bold">
                                    {players.filter((p) => checkins.includes(p.id)).length}/
                                    {players.length}
                                  </div>
                                </div>
                                {players.length === 0 ? (
                                  <div className="p-4 text-center text-muted font-cond text-[12px]">
                                    No roster
                                  </div>
                                ) : (
                                  <div className="divide-y divide-border/30">
                                    {players.map((p) => {
                                      const checked = checkins.includes(p.id)
                                      return (
                                        <button
                                          key={p.id}
                                          onClick={() => togglePlayerCheckin(p.id)}
                                          className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2.5 transition-colors',
                                            checked ? 'bg-green-900/15' : 'hover:bg-white/5'
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              'w-8 h-8 rounded-full flex items-center justify-center font-cond font-black text-[12px] flex-shrink-0',
                                              checked
                                                ? 'bg-green-700 text-white'
                                                : 'bg-navy text-muted'
                                            )}
                                          >
                                            {p.number ?? '—'}
                                          </div>
                                          <div className="flex-1 text-left min-w-0">
                                            <div
                                              className={cn(
                                                'font-cond font-bold text-[12px]',
                                                checked ? 'text-green-300' : 'text-white'
                                              )}
                                            >
                                              {p.name}
                                            </div>
                                            {p.usa_lacrosse_number && (
                                              <div className="font-mono text-[9px] text-muted">
                                                USA #{p.usa_lacrosse_number}
                                              </div>
                                            )}
                                          </div>
                                          {checked ? (
                                            <CheckCircle size={14} className="text-green-400" />
                                          ) : (
                                            <div className="w-4 h-4 rounded-full border-2 border-border" />
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
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
                              <span className="font-cond text-[9px] text-muted uppercase">To</span>
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
                </div>
              ) : (
                <div className="font-cond text-[11px] text-muted text-center py-8">
                  No event dates found.
                </div>
              )}
            </div>
          )}

          {/* ── APPROVALS TAB ── */}
          {tab === 'approvals' && (
            <ApprovalsPanel
              personName={vol?.name ?? 'Volunteer'}
              personType="volunteer"
              eventId={portalEventId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ApprovalsPanel({
  personName,
  personType,
  eventId,
}: {
  personName: string
  personType: 'referee' | 'volunteer'
  eventId: number
}) {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/eligibility?all=1&event_id=${eventId}`)
    if (res.ok) setApprovals(await res.json())
    setLoading(false)
  }

  async function act(id: number, action: 'approve' | 'deny') {
    setApprovingId(id)
    await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        approval_id: id,
        approved_by: personType,
        approved_by_name: personName,
        denied_by: personName,
        reason: 'Denied by official',
      }),
    })
    setApprovals((prev) => prev.filter((a) => a.id !== id))
    setApprovingId(null)
  }

  if (loading) return <div className="text-center py-8 text-muted font-cond">LOADING...</div>

  return (
    <div>
      <div className="font-cond font-black text-[13px] tracking-wide mb-1">
        MULTI-GAME APPROVALS
      </div>
      <div className="font-cond text-[11px] text-muted mb-4">
        Approve or deny on behalf of the opposing team&apos;s coach.
      </div>
      {approvals.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
          <div className="font-cond font-black text-[14px] text-green-400">✓ ALL CLEAR</div>
        </div>
      ) : (
        approvals.map((a) => {
          const p = a.player
          return (
            <div
              key={a.id}
              className="bg-surface-card border border-yellow-800/40 rounded-xl p-4 mb-3"
            >
              <div className="font-cond font-black text-[15px] text-white mb-0.5">{p?.name}</div>
              <div className="font-cond text-[11px] text-muted mb-3">
                Playing 2nd game · Opposing:{' '}
                <span className="text-white">{a.opposing_team_name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => act(a.id, 'approve')}
                  disabled={approvingId === a.id}
                  className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg bg-green-700 text-white"
                >
                  ✓ APPROVE
                </button>
                <button
                  onClick={() => act(a.id, 'deny')}
                  disabled={approvingId === a.id}
                  className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg border border-red-800/50 text-red-400"
                >
                  ✗ DENY
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
