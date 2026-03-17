'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, MapPin, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

type PortalTab = 'checkin' | 'games' | 'approvals'

interface AssignedGame {
  id: number
  scheduled_time: string
  division: string
  status: string
  field: { name: string }
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
}

interface Player {
  id: number; name: string; number: number | null
  position: string | null; usa_lacrosse_number: string | null
}

export function VolunteerPortal() {
  const { userRole, signOut } = useAuth()
  const [tab, setTab]             = useState<PortalTab>('checkin')
  const [vol, setVol]             = useState<any>(null)
  const [games, setGames]         = useState<AssignedGame[]>([])
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  // Game roster state
  const [selectedGame, setSelectedGame] = useState<AssignedGame | null>(null)
  const [homePlayers, setHomePlayers]   = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers]   = useState<Player[]>([])
  const [checkins, setCheckins]         = useState<number[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  useEffect(() => {
    if (!userRole?.volunteer_id) return
    loadData()
  }, [userRole])

  async function loadData() {
    const sb = createClient()
    setLoading(true)
    const { data: volData } = await sb.from('volunteers').select('*').eq('id', userRole!.volunteer_id!).single()
    setVol(volData)
    setCheckedIn(volData?.checked_in ?? false)

    const { data: assignments } = await sb
      .from('vol_assignments')
      .select(`game:games(id, scheduled_time, division, status, field:fields(name), home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name))`)
      .eq('volunteer_id', userRole!.volunteer_id!)

    const gameList = (assignments ?? []).map((a: any) => a.game).filter(Boolean)
      .sort((a: any, b: any) => a.scheduled_time.localeCompare(b.scheduled_time))
    setGames(gameList)
    setLoading(false)
  }

  async function loadRoster(game: AssignedGame) {
    setSelectedGame(game)
    setRosterLoading(true)
    const sb = createClient()
    const [{ data: home }, { data: away }, { data: ci }] = await Promise.all([
      sb.from('players').select('id, name, number, position, usa_lacrosse_number').eq('team_id', game.home_team.id).order('name'),
      sb.from('players').select('id, name, number, position, usa_lacrosse_number').eq('team_id', game.away_team.id).order('name'),
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
      await sb.from('player_checkins').delete().eq('game_id', selectedGame.id).eq('player_id', playerId)
      setCheckins(prev => prev.filter(id => id !== playerId))
      toast('Player checked out', { icon: '↩' })
    } else {
      await sb.from('player_checkins').upsert({ game_id: selectedGame.id, player_id: playerId, checked_in_at: new Date().toISOString() })
      setCheckins(prev => [...prev, playerId])
      toast.success('Player checked in')
    }
  }

  async function handleSelfCheckIn() {
    if (!userRole?.volunteer_id) return
    setCheckingIn(true)
    const sb = createClient()
    const newState = !checkedIn
    await sb.from('volunteers').update({ checked_in: newState }).eq('id', userRole.volunteer_id)
    await sb.from('portal_checkins').insert({ person_type: 'volunteer', person_id: userRole.volunteer_id, event_id: 1, checked_in: newState })
    await sb.from('ops_log').insert({ event_id: 1, message: `Volunteer ${vol?.name} (${vol?.role}) ${newState ? 'checked in' : 'checked out'} via portal`, log_type: newState ? 'ok' : 'info', occurred_at: new Date().toISOString() })
    setCheckedIn(newState)
    setCheckingIn(false)
    toast.success(newState ? '✓ You are checked in!' : 'Checked out')
  }

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="font-cond text-muted tracking-widest">LOADING...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-navy-dark border-b-2 border-red px-4 py-0 flex items-stretch">
        <div className="flex items-center gap-3 py-3 px-2">
          <div className="font-cond text-lg font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest border-l border-border pl-3">VOLUNTEER PORTAL</div>
        </div>
        <nav className="flex flex-1 ml-4">
          {[{ id: 'checkin', label: 'My Check-In' }, { id: 'games', label: `Games (${games.length})` }, { id: 'approvals', label: 'Approvals' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as PortalTab)}
              className={cn('px-4 font-cond text-[12px] font-bold tracking-widest uppercase border-b-2 transition-colors',
                tab === t.id ? 'border-red text-white' : 'border-transparent text-muted hover:text-white'
              )}>{t.label}</button>
          ))}
        </nav>
        <div className="flex items-center gap-3 px-4">
          <div className={cn('w-2 h-2 rounded-full', checkedIn ? 'bg-green-400' : 'bg-red-400')} />
          <span className="font-cond text-[11px] text-white">{vol?.name}</span>
          <button onClick={signOut} className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white"><LogOut size={13} /> OUT</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {tab === 'checkin' && (
          <div>
            <div className="bg-surface-card border border-border rounded-xl p-6 text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-900/30 border-2 border-blue-700/50 flex items-center justify-center mx-auto mb-3">
                <span className="font-cond font-black text-2xl text-blue-300">
                  {vol?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="font-cond font-black text-[20px] text-white mb-0.5">{vol?.name}</div>
              <div className="font-cond text-[12px] text-muted mb-4">{vol?.role}</div>
              <button onClick={handleSelfCheckIn} disabled={checkingIn}
                className={cn('w-full py-4 rounded-xl font-cond font-black text-[16px] tracking-widest transition-all',
                  checkedIn ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-navy hover:bg-navy-light text-white border-2 border-border'
                )}>
                {checkingIn ? 'UPDATING...' : checkedIn ? '✓ CHECKED IN — TAP TO CHECK OUT' : 'TAP TO CHECK IN'}
              </button>
            </div>

            <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">YOUR ASSIGNMENTS</div>
            {games.length === 0 ? (
              <div className="bg-surface-card border border-border rounded-xl p-6 text-center text-muted font-cond">No games assigned</div>
            ) : (
              <div className="space-y-3">
                {games.map(game => (
                  <button key={game.id} onClick={() => { loadRoster(game); setTab('games') }}
                    className="w-full text-left bg-surface-card border border-border hover:border-blue-400 rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-[13px] font-bold text-blue-300">{game.scheduled_time}</span>
                      <span className={cn('font-cond text-[10px] font-black px-2 py-0.5 rounded',
                        game.status === 'Live' ? 'badge-live' : 'badge-scheduled'
                      )}>{game.status.toUpperCase()}</span>
                    </div>
                    <div className="font-cond font-black text-[14px] text-white">{game.home_team?.name} vs {game.away_team?.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={10} className="text-muted" />
                      <span className="font-cond text-[11px] text-muted">{game.field?.name} · {game.division}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'games' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {games.map(game => (
                <button key={game.id} onClick={() => loadRoster(game)}
                  className={cn('font-cond text-[11px] font-bold px-3 py-2 rounded-lg border transition-colors',
                    selectedGame?.id === game.id ? 'bg-navy border-blue-400 text-white' : 'bg-surface-card border-border text-muted hover:text-white'
                  )}>
                  {game.scheduled_time} · {game.home_team?.name} vs {game.away_team?.name}
                  {['Live','Halftime'].includes(game.status) && <span className="ml-1 text-green-400">●</span>}
                </button>
              ))}
            </div>

            {rosterLoading && <div className="text-center py-8 text-muted font-cond">LOADING...</div>}

            {!rosterLoading && selectedGame && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: selectedGame.home_team?.name, players: homePlayers },
                  { label: selectedGame.away_team?.name, players: awayPlayers },
                ].map(({ label, players }) => (
                  <div key={label} className="bg-surface-card border border-border rounded-xl overflow-hidden">
                    <div className="bg-navy/60 px-3 py-2.5 border-b border-border flex justify-between items-center">
                      <div className="font-cond font-black text-[13px] text-white">{label}</div>
                      <div className="font-cond text-[11px] text-green-400 font-bold">
                        {players.filter(p => checkins.includes(p.id)).length}/{players.length}
                      </div>
                    </div>
                    {players.length === 0 ? (
                      <div className="p-4 text-center text-muted font-cond text-[12px]">No roster</div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {players.map(p => {
                          const checked = checkins.includes(p.id)
                          return (
                            <button key={p.id} onClick={() => toggleCheckin(p.id)}
                              className={cn('w-full flex items-center gap-3 px-3 py-2.5 transition-colors',
                                checked ? 'bg-green-900/15' : 'hover:bg-white/5'
                              )}>
                              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-cond font-black text-[12px] flex-shrink-0',
                                checked ? 'bg-green-700 text-white' : 'bg-navy text-muted'
                              )}>{p.number ?? '—'}</div>
                              <div className="flex-1 text-left min-w-0">
                                <div className={cn('font-cond font-bold text-[12px]', checked ? 'text-green-300' : 'text-white')}>{p.name}</div>
                                {p.usa_lacrosse_number && <div className="font-mono text-[9px] text-muted">USA #{p.usa_lacrosse_number}</div>}
                              </div>
                              {checked ? <CheckCircle size={14} className="text-green-400" /> : <div className="w-4 h-4 rounded-full border-2 border-border" />}
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
        {tab === 'approvals' && (
          <ApprovalsPanel personName={vol?.name ?? 'Volunteer'} personType="volunteer" />
        )}
      </div>
    </div>
  )
}

function ApprovalsPanel({ personName, personType }: { personName: string; personType: 'referee' | 'volunteer' }) {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/eligibility?all=1&event_id=1')
    if (res.ok) setApprovals(await res.json())
    setLoading(false)
  }

  async function act(id: number, action: 'approve' | 'deny') {
    setApprovingId(id)
    await fetch('/api/eligibility', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, approval_id: id, approved_by: personType, approved_by_name: personName, denied_by: personName, reason: 'Denied by official' }),
    })
    setApprovals(prev => prev.filter(a => a.id !== id))
    setApprovingId(null)
  }

  if (loading) return <div className="text-center py-8 text-muted font-cond">LOADING...</div>

  return (
    <div>
      <div className="font-cond font-black text-[13px] tracking-wide mb-1">MULTI-GAME APPROVALS</div>
      <div className="font-cond text-[11px] text-muted mb-4">Approve or deny on behalf of the opposing team's coach.</div>
      {approvals.length === 0
        ? <div className="bg-surface-card border border-border rounded-xl p-8 text-center"><div className="font-cond font-black text-[14px] text-green-400">✓ ALL CLEAR</div></div>
        : approvals.map(a => {
            const p = a.player; const team = (p as any)?.team
            return (
              <div key={a.id} className="bg-surface-card border border-yellow-800/40 rounded-xl p-4 mb-3">
                <div className="font-cond font-black text-[15px] text-white mb-0.5">{p?.name}</div>
                <div className="font-cond text-[11px] text-muted mb-3">Playing 2nd game · Opposing: <span className="text-white">{a.opposing_team_name}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => act(a.id, 'approve')} disabled={approvingId === a.id}
                    className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg bg-green-700 text-white">✓ APPROVE</button>
                  <button onClick={() => act(a.id, 'deny')} disabled={approvingId === a.id}
                    className="flex-1 font-cond text-[13px] font-bold py-2.5 rounded-lg border border-red-800/50 text-red-400">✗ DENY</button>
                </div>
              </div>
            )
          })
      }
    </div>
  )
}
