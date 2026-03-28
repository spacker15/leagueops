'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, MapPin, LogOut, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

type PortalTab = 'checkin' | 'games' | 'gameday' | 'approvals'

interface AssignedGame {
  id: number
  scheduled_time: string
  sort_order?: number | null
  division: string
  status: string
  role: string
  home_score: number
  away_score: number
  field: { id: number; name: string } | null
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
}

interface FieldGame {
  id: number
  scheduled_time: string
  sort_order?: number | null
  division: string
  status: string
  home_score: number
  away_score: number
  field_id: number
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
}

interface Player {
  id: number
  name: string
  number: number | null
  position: string | null
  usa_lacrosse_number: string | null
  checked_in?: boolean
}

const STATUS_NEXT: Record<string, string | null> = {
  Scheduled: 'Starting',
  Starting: 'Live',
  Live: 'Halftime',
  Halftime: 'Live',
  Final: null,
}
const STATUS_BTN: Record<string, string> = {
  Scheduled: 'START GAME',
  Starting: 'GO LIVE',
  Live: 'HALFTIME',
  Halftime: '2ND HALF',
}

export function RefereePortal() {
  const { userRole, signOut } = useAuth()
  const portalEventId = userRole?.event_id
  const [tab, setTab] = useState<PortalTab>('checkin')
  const [ref, setRef] = useState<any>(null)
  const [games, setGames] = useState<AssignedGame[]>([])
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  // Game day state
  const [fields, setFields] = useState<{ id: number; name: string }[]>([])
  const [fieldGames, setFieldGames] = useState<FieldGame[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)
  const [activeGame, setActiveGame] = useState<FieldGame | null>(null)
  const [savingScore, setSavingScore] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [fieldDayLoading, setFieldDayLoading] = useState(false)

  // Game check-in state
  const [selectedGame, setSelectedGame] = useState<AssignedGame | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [checkins, setCheckins] = useState<number[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  useEffect(() => {
    if (!portalEventId || !userRole?.referee_id) {
      setLoading(false)
      return
    }
    loadData()
  }, [userRole])

  async function loadData() {
    const sb = createClient()
    setLoading(true)
    const { data: refData } = await sb
      .from('referees')
      .select('*')
      .eq('id', userRole!.referee_id!)
      .single()
    setRef(refData)
    setCheckedIn(refData?.checked_in ?? false)

    const { data: assignments } = await sb
      .from('ref_assignments')
      .select(
        `role, game:games(id, scheduled_time, sort_order, division, status, home_score, away_score, field:fields(id, name), home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name))`
      )
      .eq('referee_id', userRole!.referee_id!)

    const gameList = (assignments ?? [])
      .map((a: any) => ({ ...a.game, role: a.role }))
      .filter(Boolean)
      .sort((a: any, b: any) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
    setGames(gameList)

    const liveGame = gameList.find((g: any) => ['Live', 'Halftime', 'Starting'].includes(g.status))
    if (liveGame) setSelectedGame(liveGame)

    setLoading(false)
  }

  async function loadFieldGames() {
    if (!portalEventId) return
    setFieldDayLoading(true)
    const sb = createClient()

    // Get today's event date
    const today = new Date().toISOString().slice(0, 10)
    const { data: dates } = await sb
      .from('event_dates')
      .select('id, date')
      .eq('event_id', portalEventId)
      .order('date')
    const eventDate = dates?.find((d: any) => d.date <= today) ?? dates?.[dates.length - 1]

    const [{ data: fieldList }, { data: gameList }] = await Promise.all([
      sb.from('fields').select('id, name').eq('event_id', portalEventId).order('name'),
      eventDate
        ? sb
            .from('games')
            .select(
              'id, scheduled_time, sort_order, division, status, home_score, away_score, field_id, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)'
            )
            .eq('event_date_id', eventDate.id)
            .not('status', 'in', '("Cancelled","Unscheduled")')
            .order('sort_order', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] }),
    ])

    setFields((fieldList as { id: number; name: string }[]) ?? [])
    setFieldGames((gameList as FieldGame[]) ?? [])
    setFieldDayLoading(false)
  }

  async function selfAssign(game: FieldGame) {
    if (!userRole?.referee_id || !portalEventId) return
    const sb = createClient()
    const { error } = await sb.from('ref_assignments').upsert(
      {
        game_id: game.id,
        referee_id: userRole.referee_id,
        role: 'Field',
      },
      { onConflict: 'game_id,referee_id' }
    )
    if (error) {
      toast.error('Could not assign — ' + error.message)
      return
    }
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `${ref?.name ?? 'Referee'} self-assigned to ${game.home_team.name} vs ${game.away_team.name} (${game.scheduled_time})`,
      log_type: 'info',
      occurred_at: new Date().toISOString(),
    })
    toast.success('Assigned to field!')
    setActiveGame(game)
  }

  async function updateScore(gameId: number, home: number, away: number) {
    setSavingScore(true)
    const sb = createClient()
    await sb.from('games').update({ home_score: home, away_score: away }).eq('id', gameId)
    if (activeGame) {
      const updated = { ...activeGame, home_score: home, away_score: away }
      setActiveGame(updated)
      setFieldGames((prev) => prev.map((g) => (g.id === gameId ? updated : g)))
      await sb.from('ops_log').insert({
        event_id: portalEventId,
        message: `Score: ${activeGame.home_team.name} ${home}–${away} ${activeGame.away_team.name} (${ref?.name ?? 'Referee'})`,
        log_type: 'info',
        occurred_at: new Date().toISOString(),
      })
    }
    setSavingScore(false)
  }

  async function advanceStatus(game: FieldGame) {
    const next = STATUS_NEXT[game.status]
    if (!next) return
    setSavingStatus(true)
    const sb = createClient()
    await sb.from('games').update({ status: next }).eq('id', game.id)
    const updated = { ...game, status: next }
    setActiveGame(updated)
    setFieldGames((prev) => prev.map((g) => (g.id === game.id ? updated : g)))
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `Game status → ${next}: ${game.home_team.name} vs ${game.away_team.name} (${ref?.name ?? 'Referee'})`,
      log_type: next === 'Final' ? 'ok' : 'info',
      occurred_at: new Date().toISOString(),
    })
    toast.success(`Status → ${next}`)
    setSavingStatus(false)
  }

  async function markFinal(game: FieldGame) {
    setSavingStatus(true)
    const sb = createClient()
    await sb.from('games').update({ status: 'Final' }).eq('id', game.id)
    const updated = { ...game, status: 'Final' }
    setActiveGame(updated)
    setFieldGames((prev) => prev.map((g) => (g.id === game.id ? updated : g)))
    await sb.from('ops_log').insert({
      event_id: portalEventId,
      message: `FINAL: ${game.home_team.name} ${game.home_score}–${game.away_score} ${game.away_team.name} (${ref?.name ?? 'Referee'})`,
      log_type: 'ok',
      occurred_at: new Date().toISOString(),
    })
    toast.success('Game marked Final')
    setSavingStatus(false)
  }

  async function loadRoster(game: AssignedGame) {
    setSelectedGame(game)
    setRosterLoading(true)
    const sb = createClient()
    const [{ data: home }, { data: away }, { data: ci }] = await Promise.all([
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
    setHomePlayers((home as Player[]) ?? [])
    setAwayPlayers((away as Player[]) ?? [])
    setCheckins((ci ?? []).map((c: any) => c.player_id))
    setRosterLoading(false)
  }

  async function toggleCheckin(playerId: number) {
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

  if (!portalEventId) return null

  if (!loading && !userRole?.referee_id)
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="font-cond text-xl font-black text-white mb-2 tracking-widest">
            ACCOUNT NOT LINKED
          </div>
          <div className="font-cond text-sm text-muted mb-4">
            Your account is not linked to a referee record. Please contact your administrator to
            complete setup.
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

  if (loading)
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch">
        <div className="flex items-center gap-3 py-3 px-2">
          <div className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">
            REFEREE PORTAL
          </div>
        </div>
        <nav className="flex flex-1 ml-4 overflow-x-auto">
          {[
            { id: 'checkin', label: 'My Check-In' },
            { id: 'games', label: `Games (${games.length})` },
            { id: 'gameday', label: 'Game Day' },
            { id: 'approvals', label: 'Approvals' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as PortalTab)
                if (t.id === 'gameday' && fields.length === 0) loadFieldGames()
              }}
              className={cn(
                'px-4 font-cond text-[12px] font-bold tracking-widest uppercase border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
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

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ── MY CHECK-IN ── */}
        {tab === 'checkin' && (
          <div>
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
              <div className="font-cond font-black text-[20px] text-white mb-0.5">{ref?.name}</div>
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

            <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
              PLAYER CHECK-IN FOR YOUR GAMES
            </div>
            {games.length === 0 ? (
              <div className="bg-surface-card border border-border rounded-xl p-6 text-center text-muted font-cond">
                No games assigned
              </div>
            ) : (
              <div className="space-y-3">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => {
                      loadRoster(game)
                      setTab('games')
                    }}
                    className={cn(
                      'w-full text-left bg-surface-card border rounded-xl p-4 transition-all hover:border-blue-400',
                      selectedGame?.id === game.id ? 'border-blue-400' : 'border-border'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-bold text-blue-300">
                          {game.scheduled_time}
                        </span>
                        <span className="font-cond text-[10px] font-bold bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                          {game.role}
                        </span>
                      </div>
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
                    <div className="font-cond font-black text-[14px] text-white">
                      {game.home_team?.name} vs {game.away_team?.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={10} className="text-muted" />
                      <span className="font-cond text-[11px] text-muted">
                        {game.field?.name} · {game.division}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GAMES + ROSTER CHECK-IN ── */}
        {tab === 'games' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => loadRoster(game)}
                  className={cn(
                    'font-cond text-[11px] font-bold px-3 py-2 rounded-lg border transition-colors',
                    selectedGame?.id === game.id
                      ? 'bg-navy border-blue-400 text-white'
                      : 'bg-surface-card border-border text-muted hover:text-white'
                  )}
                >
                  {game.scheduled_time} · {game.home_team?.name} vs {game.away_team?.name}
                  {['Live', 'Halftime'].includes(game.status) && (
                    <span className="ml-1 text-green-400">●</span>
                  )}
                </button>
              ))}
            </div>

            {rosterLoading && (
              <div className="text-center py-8 text-muted font-cond">LOADING ROSTERS...</div>
            )}

            {!rosterLoading && selectedGame && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: selectedGame.home_team?.name, players: homePlayers },
                  { label: selectedGame.away_team?.name, players: awayPlayers },
                ].map(({ label, players }) => (
                  <div
                    key={label}
                    className="bg-surface-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="bg-navy/60 px-3 py-2.5 border-b border-border flex justify-between items-center">
                      <div className="font-cond font-black text-[13px] text-white">{label}</div>
                      <div className="font-cond text-[11px] text-green-400 font-bold">
                        {players.filter((p) => checkins.includes(p.id)).length}/{players.length}
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
                              onClick={() => toggleCheckin(p.id)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left',
                                checked
                                  ? 'bg-green-900/15 hover:bg-green-900/25'
                                  : 'hover:bg-white/5'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center font-cond font-black text-[12px] flex-shrink-0',
                                  checked ? 'bg-green-700 text-white' : 'bg-navy text-muted'
                                )}
                              >
                                {p.number ?? '—'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={cn(
                                    'font-cond font-bold text-[12px] leading-tight',
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
                                <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GAME DAY ── */}
        {tab === 'gameday' && (
          <div>
            {fieldDayLoading ? (
              <div className="text-center py-12 font-cond text-muted tracking-widest">
                LOADING...
              </div>
            ) : activeGame ? (
              /* ── Active game scoreboard ── */
              <div>
                <button
                  onClick={() => setActiveGame(null)}
                  className="font-cond text-[11px] text-muted hover:text-white mb-4 flex items-center gap-1"
                >
                  ← BACK TO FIELDS
                </button>

                <div className="bg-surface-card border border-border rounded-xl overflow-hidden mb-4">
                  {/* Game header */}
                  <div className="bg-navy/60 px-4 py-3 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="font-cond text-[11px] text-muted">
                        {activeGame.scheduled_time} · {activeGame.division}
                      </div>
                      <div className="font-cond font-black text-[13px] text-white">
                        {fields.find((f) => f.id === activeGame.field_id)?.name ?? 'Field'}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-cond text-[11px] font-black px-3 py-1 rounded-full',
                        activeGame.status === 'Live'
                          ? 'badge-live'
                          : activeGame.status === 'Final'
                            ? 'badge-final'
                            : activeGame.status === 'Halftime'
                              ? 'badge-halftime'
                              : 'badge-scheduled'
                      )}
                    >
                      {activeGame.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Scoreboard */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Home */}
                      <div className="text-center">
                        <div className="font-cond font-black text-[13px] text-muted uppercase mb-3 tracking-wider">
                          {activeGame.home_team.name}
                        </div>
                        <div className="font-mono font-black text-[64px] text-white leading-none mb-4">
                          {activeGame.home_score}
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() =>
                              updateScore(
                                activeGame.id,
                                Math.max(0, activeGame.home_score - 1),
                                activeGame.away_score
                              )
                            }
                            disabled={savingScore || activeGame.status === 'Final'}
                            className="w-12 h-12 rounded-full bg-surface border border-border text-white font-bold text-xl hover:bg-navy disabled:opacity-30 transition-colors flex items-center justify-center"
                          >
                            <Minus size={18} />
                          </button>
                          <button
                            onClick={() =>
                              updateScore(
                                activeGame.id,
                                activeGame.home_score + 1,
                                activeGame.away_score
                              )
                            }
                            disabled={savingScore || activeGame.status === 'Final'}
                            className="w-12 h-12 rounded-full bg-navy border border-blue-600 text-white font-bold text-xl hover:bg-navy-light disabled:opacity-30 transition-colors flex items-center justify-center"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Away */}
                      <div className="text-center">
                        <div className="font-cond font-black text-[13px] text-muted uppercase mb-3 tracking-wider">
                          {activeGame.away_team.name}
                        </div>
                        <div className="font-mono font-black text-[64px] text-white leading-none mb-4">
                          {activeGame.away_score}
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() =>
                              updateScore(
                                activeGame.id,
                                activeGame.home_score,
                                Math.max(0, activeGame.away_score - 1)
                              )
                            }
                            disabled={savingScore || activeGame.status === 'Final'}
                            className="w-12 h-12 rounded-full bg-surface border border-border text-white font-bold text-xl hover:bg-navy disabled:opacity-30 transition-colors flex items-center justify-center"
                          >
                            <Minus size={18} />
                          </button>
                          <button
                            onClick={() =>
                              updateScore(
                                activeGame.id,
                                activeGame.home_score,
                                activeGame.away_score + 1
                              )
                            }
                            disabled={savingScore || activeGame.status === 'Final'}
                            className="w-12 h-12 rounded-full bg-navy border border-blue-600 text-white font-bold text-xl hover:bg-navy-light disabled:opacity-30 transition-colors flex items-center justify-center"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status buttons */}
                  {activeGame.status !== 'Final' && (
                    <div className="px-6 pb-6 flex gap-3">
                      {STATUS_BTN[activeGame.status] && (
                        <button
                          onClick={() => advanceStatus(activeGame)}
                          disabled={savingStatus}
                          className="flex-1 py-3 font-cond font-black text-[13px] tracking-widest bg-navy hover:bg-navy-light text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                          {savingStatus ? '...' : STATUS_BTN[activeGame.status]}
                        </button>
                      )}
                      <button
                        onClick={() => markFinal(activeGame)}
                        disabled={savingStatus}
                        className="flex-1 py-3 font-cond font-black text-[13px] tracking-widest bg-green-800 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {savingStatus ? '...' : 'MARK FINAL'}
                      </button>
                    </div>
                  )}
                  {activeGame.status === 'Final' && (
                    <div className="px-6 pb-6 text-center font-cond text-[12px] text-green-400 font-black">
                      ✓ GAME COMPLETE
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Field picker ── */
              <div>
                <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
                  SELECT A FIELD TO MANAGE
                </div>
                <div className="space-y-2">
                  {fields.map((field) => {
                    const game = fieldGames.find((g) => g.field_id === field.id)
                    const isLive = game && ['Live', 'Halftime', 'Starting'].includes(game.status)
                    return (
                      <div
                        key={field.id}
                        className={cn(
                          'bg-surface-card border rounded-xl p-4',
                          isLive ? 'border-green-700/50' : 'border-border'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-cond font-black text-[15px] text-white">
                            {field.name}
                          </div>
                          {game && (
                            <span
                              className={cn(
                                'font-cond text-[10px] font-black px-2 py-0.5 rounded',
                                game.status === 'Live'
                                  ? 'badge-live'
                                  : game.status === 'Final'
                                    ? 'badge-final'
                                    : game.status === 'Halftime'
                                      ? 'badge-halftime'
                                      : 'badge-scheduled'
                              )}
                            >
                              {game.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {game ? (
                          <div>
                            <div className="font-cond text-[12px] text-white mb-1">
                              {game.home_team.name}{' '}
                              <span className="font-mono font-black text-green-300">
                                {game.home_score}–{game.away_score}
                              </span>{' '}
                              {game.away_team.name}
                            </div>
                            <div className="font-cond text-[11px] text-muted mb-3">
                              {game.scheduled_time} · {game.division}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedFieldId(field.id)
                                selfAssign(game)
                                setActiveGame(game)
                              }}
                              className="w-full py-2 font-cond font-black text-[11px] tracking-widest bg-navy hover:bg-navy-light text-white rounded-lg transition-colors"
                            >
                              TAKE THIS FIELD
                            </button>
                          </div>
                        ) : (
                          <div className="font-cond text-[11px] text-muted">No active game</div>
                        )}
                      </div>
                    )
                  })}
                  {fields.length === 0 && (
                    <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
                      <div className="font-cond text-[12px] text-muted">No fields found</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={loadFieldGames}
                  className="mt-4 w-full py-2 font-cond text-[11px] text-muted border border-border rounded-lg hover:text-white transition-colors"
                >
                  REFRESH
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'approvals' && (
          <ApprovalsPanel
            personName={ref?.name ?? 'Referee'}
            personType="referee"
            eventId={portalEventId}
          />
        )}
      </div>
    </div>
  )
}

// ─── Shared approvals panel for ref + volunteer portals ───────
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
        action: action,
        approval_id: id,
        approved_by: personType,
        approved_by_name: personName,
        denied_by: personName,
        reason: 'Denied by official',
      }),
    })
    if (res.ok) {
      setApprovals((prev) => prev.filter((a) => a.id !== id))
    }
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
