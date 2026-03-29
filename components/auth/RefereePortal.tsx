'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, LogOut, ChevronLeft, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { EventDatePicker } from '@/components/ui/EventDatePicker'

type PortalTab = 'checkin' | 'games' | 'approvals' | 'availability'

const REF_POSITIONS = ['Lead', 'Wing 1', 'Wing 2']
const VOL_POSITIONS = ['Line Judge', 'Timekeeper', 'Ball Retriever', 'Gate', 'General']
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

interface Field {
  id: number
  name: string
}

interface EventDate {
  id: number
  date: string
  label: string
}

interface Trainer {
  id: number
  name: string
  checked_in: boolean
}

interface TrainerDispatch {
  id: number
  player_name: string
  injury_type: string
  trainer_name: string
  status: string
  dispatched_at: string
  notes: string | null
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
  home_team: { id: number; name: string; logo_url?: string | null }
  away_team: { id: number; name: string; logo_url?: string | null }
}

interface RefSlot {
  role: string
  referee_id: number
  referee?: { name: string }
}

interface VolSlot {
  role: string
  volunteer_id: number | null
  referee_id: number | null
  volunteer?: { name: string }
  referee?: { name: string }
}

function getQuarterLabel(game: GameSummary): string {
  if (game.status === 'Halftime') return 'HT'
  if (game.status === 'Final') return 'FINAL'
  if (game.quarter) return `Q${game.quarter}`
  return ''
}

function getGameActions(
  game: GameSummary
): { label: string; color: string; onClick: () => { status: string; quarter?: number } }[] {
  const q = game.quarter ?? 1
  if (game.status === 'Scheduled' || game.status === 'Starting') {
    return [
      {
        label: 'START GAME',
        color: 'bg-green-700 hover:bg-green-600',
        onClick: () => ({ status: 'Live', quarter: 1 }),
      },
    ]
  }
  if (game.status === 'Live') {
    if (q === 1)
      return [
        {
          label: 'END Q1',
          color: 'bg-blue-700 hover:bg-blue-600',
          onClick: () => ({ status: 'Live', quarter: 2 }),
        },
      ]
    if (q === 2)
      return [
        {
          label: 'HALFTIME',
          color: 'bg-yellow-700 hover:bg-yellow-600',
          onClick: () => ({ status: 'Halftime', quarter: 2 }),
        },
        {
          label: 'END GAME',
          color: 'bg-red hover:opacity-90',
          onClick: () => ({ status: 'Final' }),
        },
      ]
    if (q === 3)
      return [
        {
          label: 'END Q3',
          color: 'bg-blue-700 hover:bg-blue-600',
          onClick: () => ({ status: 'Live', quarter: 4 }),
        },
      ]
    if (q === 4)
      return [
        {
          label: 'END GAME',
          color: 'bg-red hover:opacity-90',
          onClick: () => ({ status: 'Final' }),
        },
      ]
  }
  if (game.status === 'Halftime')
    return [
      {
        label: 'START Q3',
        color: 'bg-green-700 hover:bg-green-600',
        onClick: () => ({ status: 'Live', quarter: 3 }),
      },
      { label: 'END GAME', color: 'bg-red hover:opacity-90', onClick: () => ({ status: 'Final' }) },
    ]
  if (game.status === 'Delayed')
    return [
      {
        label: 'RESUME',
        color: 'bg-green-700 hover:bg-green-600',
        onClick: () => ({ status: 'Live' }),
      },
    ]
  return []
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

export function RefereePortal() {
  const { userRole, signOut } = useAuth()
  const portalEventId = userRole?.event_id
  const [tab, setTab] = useState<PortalTab>('checkin')
  const [ref, setRef] = useState<any>(null)
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
  const [gameSlots, setGameSlots] = useState<RefSlot[]>([])
  const [volSlots, setVolSlots] = useState<VolSlot[]>([])
  const [slotLoading, setSlotLoading] = useState(false)

  // Quick assign
  const [quickAssignMode, setQuickAssignMode] = useState(false)
  const [quickAssignPos, setQuickAssignPos] = useState('Lead')
  const [quickAssigning, setQuickAssigning] = useState<number | null>(null)

  // Weather
  const [weatherAlerts, setWeatherAlerts] = useState<
    { id: number; alert_type: string; description: string }[]
  >([])

  // Trainers + dispatch
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [trainerDispatch, setTrainerDispatch] = useState<TrainerDispatch | null>(null)
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [dispatchPlayerName, setDispatchPlayerName] = useState('')
  const [dispatchInjuryType, setDispatchInjuryType] = useState('General / Unknown')
  const [dispatchTrainerId, setDispatchTrainerId] = useState<string>('') // kept for compat, unused in UI
  const [dispatching, setDispatching] = useState(false)

  // Availability
  const [availability, setAvailability] = useState<
    Map<string, { from: string; to: string } | null>
  >(new Map())
  const [savingAvail, setSavingAvail] = useState<string | null>(null)

  const [homePlayers, setHomePlayers] = useState<any[]>([])
  const [awayPlayers, setAwayPlayers] = useState<any[]>([])
  const [checkins, setCheckins] = useState<number[]>([])

  useEffect(() => {
    if (!portalEventId || !userRole?.referee_id) return
    loadData()
  }, [userRole])

  async function loadData() {
    const sb = createClient()
    setLoading(true)
    const [
      { data: refData },
      { data: gamesData },
      { data: fieldsData },
      { data: myAssignData },
      { data: myVolAssignData },
      { data: eventDates },
      { data: trainersData },
      { data: weatherData },
    ] = await Promise.all([
      sb.from('referees').select('*').eq('id', userRole!.referee_id!).single(),
      sb
        .from('games')
        .select(
          `id, event_date_id, scheduled_time, division, status, quarter, home_score, away_score, field_id,
           field:fields(id, name),
           home_team:teams!games_home_team_id_fkey(id, name, logo_url),
           away_team:teams!games_away_team_id_fkey(id, name, logo_url)`
        )
        .eq('event_id', portalEventId!)
        .neq('status', 'Cancelled'),
      sb.from('fields').select('id, name').eq('event_id', portalEventId!).order('name'),
      sb.from('ref_assignments').select('game_id, role').eq('referee_id', userRole!.referee_id!),
      sb.from('vol_assignments').select('game_id, role').eq('referee_id', userRole!.referee_id!),
      sb
        .from('event_dates')
        .select('id, date, label, day_number')
        .eq('event_id', portalEventId!)
        .order('date'),
      sb
        .from('trainers')
        .select('id, name, checked_in')
        .eq('event_id', portalEventId!)
        .order('name'),
      sb
        .from('weather_alerts')
        .select('id, alert_type, description')
        .eq('event_id', portalEventId!)
        .eq('is_active', true),
    ])

    setRef(refData)
    setCheckedIn(refData?.checked_in ?? false)
    const games = ((gamesData ?? []) as unknown as GameSummary[]).sort(
      (a, b) => timeToMin(a.scheduled_time) - timeToMin(b.scheduled_time)
    )
    setAllGames(games)
    setFields((fieldsData ?? []) as Field[])
    const allMyAssign = [...(myAssignData ?? []), ...(myVolAssignData ?? [])]
    setMyAssignedGameIds(new Set(allMyAssign.map((a: any) => a.game_id)))
    const rolesMap = new Map<number, string[]>()
    for (const a of allMyAssign) {
      const existing = rolesMap.get(a.game_id) ?? []
      rolesMap.set(a.game_id, [...existing, a.role])
    }
    setMyAssignmentRoles(rolesMap)
    setTrainers((trainersData ?? []) as Trainer[])
    setWeatherAlerts(
      (weatherData ?? []) as { id: number; alert_type: string; description: string }[]
    )

    const { data: availData } = await sb
      .from('referee_availability')
      .select('date, available_from, available_to')
      .eq('referee_id', userRole!.referee_id!)
    const availMap = new Map<string, { from: string; to: string } | null>()
    for (const a of availData ?? []) {
      availMap.set(a.date, { from: a.available_from.slice(0, 5), to: a.available_to.slice(0, 5) })
    }
    setAvailability(availMap)

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
    setLoading(false)
  }

  async function loadGameDetail(game: GameSummary) {
    setSelectedGame(game)
    setSlotLoading(true)
    setGameSlots([])
    setVolSlots([])
    setHomePlayers([])
    setAwayPlayers([])
    setCheckins([])
    setTrainerDispatch(null)
    setShowDispatchForm(false)
    const sb = createClient()
    const [
      { data: slots },
      { data: vols },
      { data: home },
      { data: away },
      { data: ci },
      { data: dispatch },
    ] = await Promise.all([
      sb
        .from('ref_assignments')
        .select(`role, referee_id, referee:referees(name)`)
        .eq('game_id', game.id),
      sb
        .from('vol_assignments')
        .select(
          `role, volunteer_id, referee_id, volunteer:volunteers(name), referee:referees(name)`
        )
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
      sb
        .from('medical_incidents')
        .select('*')
        .eq('game_id', game.id)
        .order('dispatched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setGameSlots((slots ?? []) as unknown as RefSlot[])
    setVolSlots((vols ?? []) as unknown as VolSlot[])
    setHomePlayers(home ?? [])
    setAwayPlayers(away ?? [])
    setCheckins((ci ?? []).map((c: any) => c.player_id))
    if (dispatch) setTrainerDispatch(dispatch as TrainerDispatch)
    setSlotLoading(false)
  }

  async function takePosition(role: string) {
    if (!selectedGame || !userRole?.referee_id) return
    const sb = createClient()
    const { error } = await sb.from('ref_assignments').insert({
      game_id: selectedGame.id,
      referee_id: userRole.referee_id,
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
    if (!selectedGame || !userRole?.referee_id) return
    const sb = createClient()
    await sb
      .from('ref_assignments')
      .delete()
      .eq('game_id', selectedGame.id)
      .eq('referee_id', userRole.referee_id)
      .eq('role', role)
    toast('Dropped position', { icon: '↩' })
    const remaining = gameSlots.filter(
      (s) => s.referee_id === userRole.referee_id && s.role !== role
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

  async function takeVolPosition(role: string) {
    if (!selectedGame || !userRole?.referee_id) return
    const sb = createClient()
    const { error } = await sb.from('vol_assignments').insert({
      game_id: selectedGame.id,
      referee_id: userRole.referee_id,
      volunteer_id: null,
      role,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Assigned as ${role}`)
    setMyAssignedGameIds((prev) => new Set([...prev, selectedGame.id]))
    setMyAssignmentRoles((prev) => {
      const next = new Map(prev)
      next.set(selectedGame.id, [...(next.get(selectedGame.id) ?? []), role])
      return next
    })
    loadGameDetail(selectedGame)
  }

  async function dropVolPosition(role: string) {
    if (!selectedGame || !userRole?.referee_id) return
    const sb = createClient()
    await sb
      .from('vol_assignments')
      .delete()
      .eq('game_id', selectedGame.id)
      .eq('referee_id', userRole.referee_id)
      .eq('role', role)
    toast('Dropped position', { icon: '↩' })
    setMyAssignmentRoles((prev) => {
      const next = new Map(prev)
      const remaining = (next.get(selectedGame.id) ?? []).filter((r) => r !== role)
      if (remaining.length === 0) {
        next.delete(selectedGame.id)
        setMyAssignedGameIds((ids) => {
          const s = new Set(ids)
          s.delete(selectedGame.id)
          return s
        })
      } else {
        next.set(selectedGame.id, remaining)
      }
      return next
    })
    loadGameDetail(selectedGame)
  }

  async function quickAssignToGame(game: GameSummary) {
    if (!userRole?.referee_id || quickAssigning !== null) return
    setQuickAssigning(game.id)
    const sb = createClient()
    const isRef = REF_POSITIONS.includes(quickAssignPos)
    if (isRef) {
      await sb
        .from('ref_assignments')
        .upsert(
          { game_id: game.id, referee_id: userRole.referee_id, role: quickAssignPos },
          { onConflict: 'game_id,referee_id,role' }
        )
    } else {
      await sb.from('vol_assignments').insert({
        game_id: game.id,
        referee_id: userRole.referee_id,
        volunteer_id: null,
        role: quickAssignPos,
      })
    }
    setMyAssignedGameIds((prev) => new Set([...prev, game.id]))
    setMyAssignmentRoles((prev) => {
      const next = new Map(prev)
      next.set(game.id, [...(next.get(game.id) ?? []), quickAssignPos])
      return next
    })
    setQuickAssigning(null)
    toast.success(`Assigned as ${quickAssignPos}`)
  }

  async function handleGameAction(action: { status: string; quarter?: number }) {
    if (!selectedGame) return
    const sb = createClient()
    const update: Record<string, unknown> = { status: action.status }
    if (action.quarter !== undefined) update.quarter = action.quarter
    const { error } = await sb.from('games').update(update).eq('id', selectedGame.id)
    if (error) {
      toast.error(error.message)
      return
    }
    const updated = {
      ...selectedGame,
      status: action.status,
      quarter: action.quarter ?? selectedGame.quarter,
    }
    setSelectedGame(updated)
    setAllGames((prev) => prev.map((g) => (g.id === selectedGame.id ? updated : g)))
    toast.success(`Game: ${action.status}${action.quarter ? ` Q${action.quarter}` : ''}`)
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `${ref?.name} updated ${selectedGame.home_team.name} vs ${selectedGame.away_team.name} → ${action.status}${action.quarter ? ` Q${action.quarter}` : ''}`,
      log_type: 'info',
      occurred_at: new Date().toISOString(),
    })
  }

  async function handleDispatchTrainer() {
    if (!selectedGame) return
    setDispatching(true)
    const sb = createClient()
    const now = new Date().toISOString()
    const { data: incident, error } = await sb
      .from('medical_incidents')
      .insert({
        event_id: portalEventId,
        game_id: selectedGame.id,
        field_id: selectedGame.field_id,
        player_name: dispatchPlayerName || 'Unknown',
        team_name: '',
        injury_type: dispatchInjuryType,
        trainer_name: 'Awaiting Acceptance',
        status: 'Dispatched',
        dispatched_at: now,
      })
      .select('*')
      .single()
    if (error) {
      toast.error(error.message)
      setDispatching(false)
      return
    }
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `🚨 TRAINER DISPATCHED — ${selectedGame.home_team.name} vs ${selectedGame.away_team.name} (${selectedGame.field.name}) — Patient: ${dispatchPlayerName || 'Unknown'} — ${dispatchInjuryType}`,
      log_type: 'warning',
      occurred_at: now,
    })
    setTrainerDispatch(incident as TrainerDispatch)
    setShowDispatchForm(false)
    setDispatchPlayerName('')
    setDispatchInjuryType('General / Unknown')
    setDispatching(false)
    toast.success('Trainer dispatched — admin notified')
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
      message: `${ref?.name} updated ${selectedGame.home_team.name} vs ${selectedGame.away_team.name} → ${newStatus}`,
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
    if (!userRole?.referee_id) return
    setCheckingIn(true)
    const sb = createClient()
    const newState = !checkedIn
    await sb.from('referees').update({ checked_in: newState }).eq('id', userRole.referee_id)
    await sb.from('portal_checkins').insert({
      person_type: 'referee',
      person_id: userRole.referee_id,
      event_id: portalEventId,
      checked_in: newState,
    })
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `Referee ${ref?.name} ${newState ? 'checked in' : 'checked out'} via portal`,
      log_type: newState ? 'ok' : 'info',
      occurred_at: new Date().toISOString(),
    })
    setCheckedIn(newState)
    setCheckingIn(false)
    toast.success(newState ? '✓ You are checked in!' : 'Checked out')
  }

  async function toggleAvailability(date: string) {
    if (!userRole?.referee_id) return
    const sb = createClient()
    const current = availability.get(date)
    if (current) {
      await sb
        .from('referee_availability')
        .delete()
        .eq('referee_id', userRole.referee_id)
        .eq('date', date)
      setAvailability((prev) => {
        const next = new Map(prev)
        next.delete(date)
        return next
      })
    } else {
      const { error } = await sb.from('referee_availability').insert({
        referee_id: userRole.referee_id,
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
    if (!userRole?.referee_id) return
    const current = availability.get(date)
    if (!current) return
    const updated = { ...current, [field]: value }
    setAvailability((prev) => new Map(prev).set(date, updated))
    setSavingAvail(date)
    const sb = createClient()
    await sb
      .from('referee_availability')
      .update({
        available_from: updated.from,
        available_to: updated.to,
      })
      .eq('referee_id', userRole.referee_id)
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
    ? gameSlots.some((s) => s.referee_id === userRole?.referee_id)
    : false

  return (
    <div className="h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch flex-shrink-0">
        <div className="flex items-center gap-3 py-3 px-2">
          <div className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">
            REFEREE PORTAL
          </div>
        </div>
        <nav className="flex flex-1 ml-4">
          {[
            { id: 'checkin', label: 'My Check-In' },
            { id: 'games', label: `Games (${allGames.length})` },
            { id: 'approvals', label: 'Approvals' },
            { id: 'availability', label: 'Availability' },
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
          <span className="font-cond text-[11px] text-white">{ref?.name}</span>
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
          {/* ── MY CHECK-IN ── */}
          {tab === 'checkin' && (
            <div>
              {/* Date picker */}
              <EventDatePicker
                dates={eventDates}
                selectedId={selectedDateId}
                onChange={setSelectedDateId}
                className="mb-4"
              />
              {todayLabel && (
                <div className="bg-navy/40 border border-border rounded-lg px-4 py-2.5 mb-4 text-center">
                  <span className="font-cond text-[11px] font-black tracking-widest text-blue-300 uppercase">
                    {todayLabel}
                  </span>
                </div>
              )}
              <div className="bg-surface-card border border-border rounded-xl p-6 text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-900/30 border-2 border-red-700/50 flex items-center justify-center mx-auto mb-3">
                  <span className="font-cond font-black text-2xl text-red-300">
                    {ref?.name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="font-cond font-black text-[20px] text-white mb-0.5">
                  {ref?.name}
                </div>
                <div className="font-cond text-[12px] text-muted mb-4">{ref?.grade_level}</div>
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
                            <div className="mt-0.5">
                              <div className="flex items-center gap-1 font-cond font-black text-[13px] text-white">
                                {game.home_team.logo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={game.home_team.logo_url}
                                    alt=""
                                    className="w-4 h-4 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                {game.home_team.name}
                              </div>
                              <div className="font-cond text-[9px] text-muted pl-5">vs</div>
                              <div className="flex items-center gap-1 font-cond font-black text-[13px] text-white">
                                {game.away_team.logo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={game.away_team.logo_url}
                                    alt=""
                                    className="w-4 h-4 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                {game.away_team.name}
                              </div>
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
                                      className="font-cond text-[9px] font-black text-red-300 bg-red-900/30 px-1.5 py-0.5 rounded"
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
              <EventDatePicker
                dates={eventDates}
                selectedId={selectedDateId}
                onChange={(id) => {
                  setSelectedDateId(id)
                  setSelectedFieldId(null)
                  setSelectedGame(null)
                }}
                className="mb-4"
              />

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
                      onClick={() => {
                        setSelectedFieldId(null)
                        setQuickAssignMode(false)
                      }}
                      className="text-muted hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="font-cond font-black text-[14px] text-white flex-1">
                      {fields.find((f) => f.id === selectedFieldId)?.name}
                    </div>
                    <button
                      onClick={() => {
                        setQuickAssignMode((v) => !v)
                      }}
                      className={cn(
                        'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                        quickAssignMode
                          ? 'bg-red border-red text-white'
                          : 'border-border text-muted hover:text-white'
                      )}
                    >
                      QUICK ASSIGN
                    </button>
                  </div>

                  {/* Quick assign position picker */}
                  {quickAssignMode && (
                    <div className="bg-surface-card border border-border rounded-xl p-3 mb-3">
                      <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
                        SELECT POSITION — TAP GAME TO ASSIGN
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[...REF_POSITIONS, ...VOL_POSITIONS].map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setQuickAssignPos(pos)}
                            className={cn(
                              'font-cond text-[10px] font-black tracking-widest px-2.5 py-1 rounded border transition-colors',
                              quickAssignPos === pos
                                ? REF_POSITIONS.includes(pos)
                                  ? 'bg-red border-red text-white'
                                  : 'bg-blue-700 border-blue-600 text-white'
                                : 'border-border text-muted hover:text-white'
                            )}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                        const isAssigning = quickAssigning === game.id
                        return (
                          <button
                            key={game.id}
                            onClick={() =>
                              quickAssignMode ? quickAssignToGame(game) : loadGameDetail(game)
                            }
                            disabled={isAssigning}
                            className={cn(
                              'w-full text-left rounded-xl p-4 border transition-all',
                              quickAssignMode
                                ? 'bg-surface-card border-blue-800/60 hover:border-blue-400 hover:bg-blue-900/10'
                                : mine
                                  ? 'bg-green-900/15 border-green-800/50 hover:border-green-400'
                                  : 'bg-surface-card border-border hover:border-blue-400'
                            )}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-mono text-[13px] font-bold text-blue-300">
                                {game.scheduled_time}
                              </span>
                              <div className="flex items-center gap-2">
                                {isAssigning && (
                                  <span className="font-cond text-[9px] text-muted">
                                    ASSIGNING...
                                  </span>
                                )}
                                {!quickAssignMode && mine && roles.length > 0 && (
                                  <div className="flex gap-1">
                                    {roles.map((r) => (
                                      <span
                                        key={r}
                                        className="font-cond text-[9px] font-black text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded"
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
                                  {getQuarterLabel(game) || game.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="mt-0.5">
                              <div className="flex items-center gap-1 font-cond font-black text-[14px] text-white">
                                {game.home_team.logo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={game.home_team.logo_url}
                                    alt=""
                                    className="w-4 h-4 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                {game.home_team.name}
                              </div>
                              <div className="font-cond text-[9px] text-muted pl-5">vs</div>
                              <div className="flex items-center gap-1 font-cond font-black text-[14px] text-white">
                                {game.away_team.logo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={game.away_team.logo_url}
                                    alt=""
                                    className="w-4 h-4 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                {game.away_team.name}
                              </div>
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
                      <div className="flex items-center gap-1.5">
                        {selectedGame.home_team.logo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedGame.home_team.logo_url}
                            alt=""
                            className="w-4 h-4 rounded object-cover flex-shrink-0"
                          />
                        )}
                        {selectedGame.home_team.name}
                        <span className="text-muted font-normal text-[11px]">vs</span>
                        {selectedGame.away_team.logo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedGame.away_team.logo_url}
                            alt=""
                            className="w-4 h-4 rounded object-cover flex-shrink-0"
                          />
                        )}
                        {selectedGame.away_team.name}
                      </div>
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
                          <div className="flex items-center gap-1.5">
                            {selectedGame.home_team.logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedGame.home_team.logo_url}
                                alt=""
                                className="w-5 h-5 rounded object-cover flex-shrink-0"
                              />
                            )}
                            {selectedGame.home_team.name}
                            <span className="text-muted font-normal text-[13px]">vs</span>
                            {selectedGame.away_team.logo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedGame.away_team.logo_url}
                                alt=""
                                className="w-5 h-5 rounded object-cover flex-shrink-0"
                              />
                            )}
                            {selectedGame.away_team.name}
                          </div>
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
                      {/* ── GAME CONTROL (assigned refs only) ── */}
                      {isAssigned && selectedGame.status !== 'Cancelled' && (
                        <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase">
                              GAME CONTROL
                            </div>
                            {selectedGame.quarter && selectedGame.status !== 'Final' && (
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((q) => (
                                  <span
                                    key={q}
                                    className={cn(
                                      'font-cond text-[10px] font-black px-2 py-0.5 rounded',
                                      q === selectedGame.quarter
                                        ? selectedGame.status === 'Halftime'
                                          ? 'bg-yellow-700/60 text-yellow-200'
                                          : 'bg-green-700/60 text-green-200'
                                        : (selectedGame.quarter ?? 0) > q
                                          ? 'bg-border/40 text-muted'
                                          : 'border border-border/40 text-border'
                                    )}
                                  >
                                    Q{q}
                                  </span>
                                ))}
                                {selectedGame.status === 'Halftime' && (
                                  <span className="font-cond text-[10px] font-black px-2 py-0.5 rounded bg-yellow-700/60 text-yellow-200">
                                    HT
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Score controls */}
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
                                  className="bg-surface rounded-lg p-3 text-center border border-border/50"
                                >
                                  <div className="font-cond text-[10px] text-muted uppercase tracking-wide mb-1 truncate">
                                    {label}
                                  </div>
                                  <div className="font-mono text-[36px] font-bold text-white leading-none mb-2">
                                    {score}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => updateScore(team, -1)}
                                      className="flex-1 font-mono text-[18px] font-bold bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg py-1.5 transition-colors"
                                    >
                                      −
                                    </button>
                                    <button
                                      onClick={() => updateScore(team, 1)}
                                      className="flex-1 font-mono text-[18px] font-bold bg-green-900/30 hover:bg-green-900/50 text-green-300 rounded-lg py-1.5 transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Trainers on duty */}
                          <div className="mb-3">
                            <div className="font-cond text-[9px] font-black tracking-widest text-muted uppercase mb-1.5">
                              TRAINERS ON DUTY
                            </div>
                            {trainers.filter((t) => t.checked_in).length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {trainers
                                  .filter((t) => t.checked_in)
                                  .map((t) => (
                                    <span
                                      key={t.id}
                                      className="font-cond text-[11px] font-black text-green-300 bg-green-900/30 px-2.5 py-1 rounded-lg border border-green-700/40"
                                    >
                                      {t.name}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <div className="font-cond text-[11px] text-muted">
                                No trainers checked in
                              </div>
                            )}
                          </div>

                          {/* Game state control panel — all states, tap any to jump */}
                          <div>
                            <div className="font-cond text-[9px] font-black tracking-widest text-muted uppercase mb-2">
                              SET GAME STATE
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(
                                [
                                  { label: 'PRE-GAME', status: 'Scheduled', quarter: undefined },
                                  { label: 'Q1', status: 'Live', quarter: 1 },
                                  { label: 'Q2', status: 'Live', quarter: 2 },
                                  { label: 'HALF', status: 'Halftime', quarter: undefined },
                                  { label: 'Q3', status: 'Live', quarter: 3 },
                                  { label: 'Q4', status: 'Live', quarter: 4 },
                                  { label: 'FINAL', status: 'Final', quarter: undefined },
                                  { label: 'DELAY', status: 'Delayed', quarter: undefined },
                                ] as {
                                  label: string
                                  status: string
                                  quarter: number | undefined
                                }[]
                              ).map((btn) => {
                                const isActive =
                                  btn.status === selectedGame.status &&
                                  (btn.quarter === undefined
                                    ? btn.status !== 'Live'
                                      ? true
                                      : false
                                    : btn.quarter === (selectedGame.quarter ?? 1))
                                const activeBg =
                                  btn.status === 'Live'
                                    ? 'bg-green-700 text-white'
                                    : btn.status === 'Halftime'
                                      ? 'bg-yellow-700 text-white'
                                      : btn.status === 'Final'
                                        ? 'bg-slate-600 text-white'
                                        : btn.status === 'Delayed'
                                          ? 'bg-red-700 text-white'
                                          : 'bg-blue-700 text-white'
                                return (
                                  <button
                                    key={btn.label}
                                    onClick={() =>
                                      handleGameAction({ status: btn.status, quarter: btn.quarter })
                                    }
                                    className={cn(
                                      'font-cond font-black text-[11px] tracking-widest py-2.5 rounded-lg transition-colors',
                                      isActive
                                        ? activeBg
                                        : 'bg-surface border border-border text-muted hover:text-white hover:border-white/30'
                                    )}
                                  >
                                    {btn.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-border/40 mt-4 mb-4" />

                          {/* Dispatch trainer section */}
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                            <div className="font-cond text-[10px] font-black tracking-widest text-red-300 uppercase">
                              DISPATCH TRAINER
                            </div>
                          </div>

                          {trainerDispatch ? (
                            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                                <span className="font-cond text-[10px] font-black tracking-widest text-red-300 uppercase">
                                  TRAINER DISPATCHED
                                </span>
                              </div>
                              <div className="font-cond font-black text-[16px] text-white mb-2">
                                {trainerDispatch.trainer_name}
                              </div>
                              <div className="space-y-1 text-[11px] font-cond">
                                <div className="flex justify-between">
                                  <span className="text-muted">Patient</span>
                                  <span className="text-white font-bold">
                                    {trainerDispatch.player_name}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted">Injury</span>
                                  <span className="text-white">{trainerDispatch.injury_type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted">Dispatched</span>
                                  <span className="text-white">
                                    {format(new Date(trainerDispatch.dispatched_at), 'h:mm a')}
                                  </span>
                                </div>
                                {trainerDispatch.notes && (
                                  <div className="flex justify-between">
                                    <span className="text-muted">Notes</span>
                                    <span className="text-white">{trainerDispatch.notes}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-muted">Status</span>
                                  <span
                                    className={cn(
                                      'font-bold',
                                      trainerDispatch.status === 'Available'
                                        ? 'text-green-400'
                                        : 'text-red-300'
                                    )}
                                  >
                                    {trainerDispatch.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : !showDispatchForm ? (
                            <button
                              onClick={() => setShowDispatchForm(true)}
                              className="w-full font-cond font-black text-[13px] tracking-widest py-3 rounded-lg bg-red-800/50 hover:bg-red-700 border border-red-700/60 text-red-200 transition-colors"
                            >
                              DISPATCH TRAINER TO FIELD
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <div className="font-cond text-[10px] text-muted uppercase mb-1">
                                  Player / Person
                                </div>
                                <input
                                  type="text"
                                  value={dispatchPlayerName}
                                  onChange={(e) => setDispatchPlayerName(e.target.value)}
                                  placeholder="Player name (optional)"
                                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white placeholder:text-muted focus:outline-none focus:border-red-500"
                                />
                              </div>
                              <div>
                                <div className="font-cond text-[10px] text-muted uppercase mb-1">
                                  Injury Type
                                </div>
                                <select
                                  value={dispatchInjuryType}
                                  onChange={(e) => setDispatchInjuryType(e.target.value)}
                                  className="w-full bg-[#040e24] border border-border rounded-lg px-3 py-2 font-cond text-[12px] text-white focus:outline-none focus:border-red-500"
                                >
                                  {INJURY_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleDispatchTrainer}
                                  disabled={dispatching}
                                  className="flex-1 font-cond font-black text-[12px] tracking-widest py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
                                >
                                  {dispatching ? 'DISPATCHING...' : 'DISPATCH'}
                                </button>
                                <button
                                  onClick={() => setShowDispatchForm(false)}
                                  className="font-cond text-[12px] text-muted hover:text-white px-4 py-2.5 rounded-lg border border-border transition-colors"
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── REFEREE POSITIONS ── */}
                      <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                        <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                          REFEREE POSITIONS
                        </div>
                        <div className="space-y-2">
                          {REF_POSITIONS.map((pos) => {
                            const slot = gameSlots.find((s) => s.role === pos)
                            const isMe = slot?.referee_id === userRole?.referee_id
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
                                      {isMe ? '(You)' : ((slot.referee as any)?.name ?? 'Assigned')}
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

                      {/* ── VOLUNTEER POSITIONS ── */}
                      <div className="bg-surface-card border border-border rounded-xl p-4 mb-4">
                        <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                          VOLUNTEER POSITIONS
                        </div>
                        <div className="space-y-2">
                          {VOL_POSITIONS.map((pos) => {
                            const slot = volSlots.find((s) => s.role === pos)
                            const isMe = slot?.referee_id === userRole?.referee_id
                            const isEmpty = !slot
                            const personName = slot
                              ? slot.volunteer_id
                                ? ((slot.volunteer as any)?.name ?? 'Volunteer')
                                : ((slot.referee as any)?.name ?? 'Referee')
                              : null
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
                                      {isMe ? '(You)' : personName}
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
                                    onClick={() => dropVolPosition(pos)}
                                    className="font-cond text-[10px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800/50 hover:bg-red-900/20 transition-colors"
                                  >
                                    DROP
                                  </button>
                                ) : isEmpty ? (
                                  <button
                                    onClick={() => takeVolPosition(pos)}
                                    className="font-cond text-[10px] font-bold text-blue-400 px-2 py-1 rounded border border-blue-700/50 bg-blue-900/20 hover:bg-blue-800/40 transition-colors"
                                  >
                                    TAKE
                                  </button>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Player roster check-in (assigned only) */}
                      {isAssigned && (homePlayers.length > 0 || awayPlayers.length > 0) && (
                        <div>
                          <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-3">
                            PLAYER CHECK-IN
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: selectedGame.home_team.name, players: homePlayers },
                              { label: selectedGame.away_team.name, players: awayPlayers },
                            ].map(({ label, players }) => (
                              <div
                                key={label}
                                className="bg-surface-card border border-border rounded-xl overflow-hidden"
                              >
                                <div className="bg-navy/60 px-3 py-2 border-b border-border flex justify-between items-center">
                                  <div className="font-cond font-black text-[12px] text-white truncate">
                                    {label}
                                  </div>
                                  <div className="font-cond text-[11px] text-green-400 font-bold flex-shrink-0 ml-1">
                                    {players.filter((p) => checkins.includes(p.id)).length}/
                                    {players.length}
                                  </div>
                                </div>
                                <div className="divide-y divide-border/30">
                                  {players.map((p) => {
                                    const checked = checkins.includes(p.id)
                                    return (
                                      <button
                                        key={p.id}
                                        onClick={() => togglePlayerCheckin(p.id)}
                                        className={cn(
                                          'w-full flex items-center gap-2 px-3 py-2 transition-colors text-left',
                                          checked ? 'bg-green-900/15' : 'hover:bg-white/5'
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            'w-7 h-7 rounded-full flex items-center justify-center font-cond font-black text-[11px] flex-shrink-0',
                                            checked
                                              ? 'bg-green-700 text-white'
                                              : 'bg-navy text-muted'
                                          )}
                                        >
                                          {p.number ?? '—'}
                                        </div>
                                        <span
                                          className={cn(
                                            'font-cond font-bold text-[11px] flex-1 min-w-0 truncate',
                                            checked ? 'text-green-300' : 'text-white'
                                          )}
                                        >
                                          {p.name}
                                        </span>
                                        {checked ? (
                                          <CheckCircle
                                            size={13}
                                            className="text-green-400 flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-3.5 h-3.5 rounded-full border-2 border-border flex-shrink-0" />
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
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

          {/* ── APPROVALS ── */}
          {tab === 'approvals' && (
            <ApprovalsPanel
              personName={ref?.name ?? 'Referee'}
              personType="referee"
              eventId={portalEventId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared approvals panel ──────────────────────────────────
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
    const res = await fetch('/api/eligibility', {
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
    if (res.ok) setApprovals((prev) => prev.filter((a) => a.id !== id))
    setApprovingId(null)
  }

  if (loading) return <div className="text-center py-8 text-muted font-cond">LOADING...</div>

  return (
    <div>
      <div className="font-cond font-black text-[13px] tracking-wide mb-1">
        MULTI-GAME APPROVAL REQUESTS
      </div>
      <div className="font-cond text-[11px] text-muted mb-4 leading-relaxed">
        As a {personType}, you can approve or deny multi-game requests on behalf of the opposing
        team&apos;s coach.
      </div>
      {approvals.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
          <div className="font-cond font-black text-[14px] text-green-400 mb-1">✓ ALL CLEAR</div>
          <div className="font-cond text-[12px] text-muted">No pending multi-game approvals</div>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => {
            const p = a.player
            const team = p?.team as any
            return (
              <div
                key={a.id}
                className="bg-surface-card border border-yellow-800/40 rounded-xl p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center font-cond font-black text-yellow-300 flex-shrink-0">
                    {p?.number ?? '?'}
                  </div>
                  <div>
                    <div className="font-cond font-black text-[15px] text-white">{p?.name}</div>
                    <div className="font-cond text-[11px] text-blue-300">
                      {team?.name} · {team?.division}
                    </div>
                    <div className="font-cond text-[11px] text-muted mt-0.5">
                      Playing 2nd game · Opposing team:{' '}
                      <span className="text-white">{a.opposing_team_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(a.id, 'approve')}
                    disabled={approvingId === a.id}
                    className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                  >
                    {approvingId === a.id ? '...' : '✓ APPROVE'}
                  </button>
                  <button
                    onClick={() => act(a.id, 'deny')}
                    disabled={approvingId === a.id}
                    className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg bg-surface-card border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    ✗ DENY
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
