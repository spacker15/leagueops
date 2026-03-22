'use client'

import { useState } from 'react'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, MapPin } from 'lucide-react'

interface Props {
  token: string
  player: {
    id: number
    name: string
    number: number | null
    position: string | null
    team: { id: number; name: string; division: string }
  }
  games: Array<{
    id: number
    scheduled_time: string
    status: string
    division: string
    field: { name: string }
    home_team: { id: number; name: string }
    away_team: { id: number; name: string }
  }>
  checkedInGameIds: number[]
  eventId: number
}

export function QRCheckinClient({
  token,
  player,
  games,
  checkedInGameIds: initialCheckins,
  eventId,
}: Props) {
  const [checkedInIds, setCheckedInIds] = useState<number[]>(initialCheckins)
  const [loading, setLoading] = useState<number | null>(null)
  const [success, setSuccess] = useState<number | null>(null)

  async function checkIn(gameId: number) {
    if (checkedInIds.includes(gameId)) return
    setLoading(gameId)
    const sb = createClient()

    // Check in the player
    const { error } = await sb.from('player_checkins').upsert({
      game_id: gameId,
      player_id: player.id,
      checked_in_at: new Date().toISOString(),
    })

    // Log QR scan
    await sb.from('qr_checkin_log').insert({
      token,
      player_id: player.id,
      game_id: gameId,
      event_id: eventId,
      success: !error,
      message: error?.message ?? 'Checked in via QR',
      scanned_at: new Date().toISOString(),
    })

    // Ops log
    if (!error) {
      await sb.from('ops_log').insert({
        event_id: eventId,
        message: `QR check-in: ${player.name} (${player.team?.name}) checked in for Game #${gameId}`,
        log_type: 'ok',
        occurred_at: new Date().toISOString(),
      })
      setCheckedInIds((prev) => [...prev, gameId])
      setSuccess(gameId)
      setTimeout(() => setSuccess(null), 3000)
    }

    setLoading(null)
  }

  // Find the most relevant game — next upcoming or current live
  const nextGame = games.find((g) => !checkedInIds.includes(g.id))

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-start pt-8 px-4 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="font-cond text-2xl font-black tracking-widest text-white mb-1">
          LEAGUEOPS
        </div>
        <div className="font-cond text-[11px] text-muted tracking-widest">PLAYER CHECK-IN</div>
      </div>

      {/* Player card */}
      <div className="w-full max-w-sm bg-surface-card border border-border rounded-2xl p-6 mb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-navy border-2 border-blue-700/50 flex items-center justify-center mx-auto mb-4">
          {player.number ? (
            <span className="font-cond font-black text-3xl text-blue-300">#{player.number}</span>
          ) : (
            <span className="font-cond font-black text-2xl text-blue-300">
              {player.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </span>
          )}
        </div>
        <div className="font-cond font-black text-[22px] text-white mb-1">{player.name}</div>
        <div className="font-cond text-[13px] text-blue-300 mb-1">{player.team?.name}</div>
        <div className="font-cond text-[11px] text-muted">
          {player.team?.division}
          {player.position ? ` · ${player.position}` : ''}
        </div>
      </div>

      {/* Games */}
      <div className="w-full max-w-sm">
        {games.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-xl p-8 text-center">
            <div className="font-cond text-muted text-[13px]">
              No upcoming games found for your team
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase text-center mb-2">
              TAP TO CHECK IN
            </div>
            {games.map((game) => {
              const isCheckedIn = checkedInIds.includes(game.id)
              const isLoading = loading === game.id
              const isSuccess = success === game.id
              const isMyTeam =
                game.home_team?.id === player.team?.id || game.away_team?.id === player.team?.id

              return (
                <button
                  key={game.id}
                  onClick={() => !isCheckedIn && checkIn(game.id)}
                  disabled={isCheckedIn || isLoading}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-all',
                    isCheckedIn
                      ? 'bg-green-900/20 border-green-700/60 cursor-default'
                      : isLoading
                        ? 'bg-navy/60 border-border opacity-70 cursor-wait'
                        : 'bg-surface-card border-border hover:border-blue-400 active:scale-[0.98]'
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-muted" />
                      <span className="font-mono text-[14px] font-bold text-blue-300">
                        {game.scheduled_time}
                      </span>
                    </div>
                    {isCheckedIn ? (
                      <div className="flex items-center gap-1.5 font-cond text-[11px] font-bold text-green-400">
                        <CheckCircle size={14} />
                        CHECKED IN
                      </div>
                    ) : isLoading ? (
                      <span className="font-cond text-[11px] text-muted">CHECKING IN...</span>
                    ) : (
                      <span
                        className={cn(
                          'font-cond text-[10px] font-black px-2 py-0.5 rounded',
                          game.status === 'Live'
                            ? 'badge-live'
                            : game.status === 'Starting'
                              ? 'badge-starting'
                              : 'badge-scheduled'
                        )}
                      >
                        {game.status.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="font-cond font-black text-[15px] text-white mb-1">
                    {game.home_team?.name} vs {game.away_team?.name}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-muted" />
                    <span className="font-cond text-[11px] text-muted">{game.field?.name}</span>
                    <span className="text-muted">·</span>
                    <span className="font-cond text-[11px] text-muted">{game.division}</span>
                  </div>

                  {!isCheckedIn && !isLoading && (
                    <div className="mt-3 bg-navy/60 rounded-lg py-2 text-center">
                      <span className="font-cond font-black text-[13px] text-white tracking-wide">
                        TAP TO CHECK IN
                      </span>
                    </div>
                  )}

                  {isSuccess && (
                    <div className="mt-2 bg-green-900/40 rounded-lg py-2 text-center">
                      <span className="font-cond font-black text-[13px] text-green-400">
                        ✓ YOU'RE CHECKED IN!
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-6 font-cond text-[10px] text-muted text-center tracking-wide">
        LeagueOps · Powered by Knights Lacrosse
      </div>
    </div>
  )
}
