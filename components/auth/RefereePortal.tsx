'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, MapPin, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

interface AssignedGame {
  id: number
  scheduled_time: string
  division: string
  status: string
  role: string
  field: { name: string }
  home_team: { name: string }
  away_team: { name: string }
}

export function RefereePortal() {
  const { userRole, signOut } = useAuth()
  const [ref, setRef]           = useState<any>(null)
  const [games, setGames]       = useState<AssignedGame[]>([])
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    if (!userRole?.referee_id) return
    loadData()
  }, [userRole])

  async function loadData() {
    const sb = createClient()
    setLoading(true)

    // Load referee details
    const { data: refData } = await sb
      .from('referees')
      .select('*')
      .eq('id', userRole!.referee_id!)
      .single()
    setRef(refData)
    setCheckedIn(refData?.checked_in ?? false)

    // Load their assigned games for today
    const { data: assignments } = await sb
      .from('ref_assignments')
      .select(`
        role,
        game:games(
          id, scheduled_time, division, status,
          field:fields(name),
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        )
      `)
      .eq('referee_id', userRole!.referee_id!)

    const gameList = (assignments ?? [])
      .map((a: any) => ({ ...a.game, role: a.role }))
      .filter(Boolean)
      .sort((a: any, b: any) => a.scheduled_time.localeCompare(b.scheduled_time))

    setGames(gameList)
    setLoading(false)
  }

  async function handleCheckIn() {
    if (!userRole?.referee_id) return
    setCheckingIn(true)
    const sb = createClient()
    const newState = !checkedIn

    await sb.from('referees').update({ checked_in: newState }).eq('id', userRole.referee_id)

    // Log the portal check-in
    await sb.from('portal_checkins').insert({
      person_type:   'referee',
      person_id:     userRole.referee_id,
      event_id:      userRole.event_id ?? 1,
      checked_in:    newState,
      checked_in_at: new Date().toISOString(),
    })

    await sb.from('ops_log').insert({
      event_id:    userRole.event_id ?? 1,
      message:     `Referee ${ref?.name} ${newState ? 'checked in' : 'checked out'} via portal`,
      log_type:    newState ? 'ok' : 'info',
      occurred_at: new Date().toISOString(),
    })

    setCheckedIn(newState)
    setCheckingIn(false)
    toast.success(newState ? 'You are checked in!' : 'Checked out')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="font-cond text-xl font-black tracking-widest text-white">LEAGUEOPS</div>
          <div className="font-cond text-[11px] text-muted tracking-widest">REFEREE PORTAL</div>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 font-cond text-[11px] text-muted hover:text-white transition-colors">
          <LogOut size={13} />
          SIGN OUT
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Referee name card */}
        <div className="bg-surface-card border border-border rounded-xl p-6 mb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 border-2 border-red-700/50 flex items-center justify-center mx-auto mb-3">
            <span className="font-cond font-black text-2xl text-red-300">
              {ref?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div className="font-cond font-black text-[20px] text-white mb-1">{ref?.name}</div>
          <div className="font-cond text-[12px] text-muted mb-4">{ref?.grade_level}</div>

          {/* Big check-in button */}
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className={cn(
              'w-full py-4 rounded-xl font-cond font-black text-[16px] tracking-widest transition-all',
              checkedIn
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-navy hover:bg-navy-light text-white border-2 border-border'
            )}
          >
            {checkingIn ? 'UPDATING...' : checkedIn ? '✓ CHECKED IN — TAP TO CHECK OUT' : 'TAP TO CHECK IN'}
          </button>
        </div>

        {/* Today's games */}
        <div>
          <div className="font-cond text-[11px] font-black tracking-widest text-muted uppercase mb-3">
            YOUR GAMES TODAY ({games.length})
          </div>

          {games.length === 0 ? (
            <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
              <div className="font-cond text-muted text-sm">No games assigned today</div>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map(game => (
                <div key={game.id} className={cn(
                  'bg-surface-card border rounded-xl p-4',
                  game.status === 'Live' || game.status === 'Halftime'
                    ? 'border-green-700/60 bg-green-900/10'
                    : game.status === 'Final'
                      ? 'border-border/50 opacity-70'
                      : 'border-border'
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-muted" />
                      <span className="font-mono text-[13px] font-bold text-blue-300">{game.scheduled_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-cond text-[10px] font-bold bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">
                        {game.role}
                      </span>
                      <span className={cn('font-cond text-[10px] font-black px-2 py-0.5 rounded',
                        game.status === 'Live' ? 'badge-live' :
                        game.status === 'Final' ? 'badge-final' :
                        game.status === 'Delayed' ? 'badge-delayed' : 'badge-scheduled'
                      )}>{game.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="font-cond font-black text-[15px] text-white mb-1">
                    {game.home_team?.name ?? '?'} vs {game.away_team?.name ?? '?'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-muted" />
                    <span className="font-cond text-[11px] text-muted">{game.field?.name ?? '—'}</span>
                    <span className="text-muted">·</span>
                    <span className="font-cond text-[11px] text-muted">{game.division}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
