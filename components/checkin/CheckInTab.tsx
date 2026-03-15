'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import * as db from '@/lib/db'
import type { Player, PlayerCheckin } from '@/types'
import toast from 'react-hot-toast'

export function CheckInTab() {
  const { state } = useApp()
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [homePlayers, setHomePlayers]       = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers]       = useState<Player[]>([])
  const [checkins, setCheckins]             = useState<PlayerCheckin[]>([])
  const [loading, setLoading]              = useState(false)

  const selectedGame = state.games.find(g => g.id === selectedGameId) ?? null

  useEffect(() => {
    if (!selectedGameId || !selectedGame) return
    setLoading(true)
    Promise.all([
      db.getPlayersByTeam(selectedGame.home_team_id),
      db.getPlayersByTeam(selectedGame.away_team_id),
      db.getCheckins(selectedGameId),
    ]).then(([home, away, ci]) => {
      setHomePlayers(home)
      setAwayPlayers(away)
      setCheckins(ci)
      setLoading(false)
    })
  }, [selectedGameId])

  const isCheckedIn = (playerId: number) => checkins.some(c => c.player_id === playerId)

  async function togglePlayer(playerId: number) {
    if (!selectedGameId || !selectedGame) return
    const alreadyIn = isCheckedIn(playerId)

    if (!alreadyIn) {
      // Conflict check: same time slot, same player
      const conflict = await db.getPlayerCheckinConflict(
        playerId,
        selectedGame.scheduled_time,
        selectedGameId,
        selectedGame.event_date_id
      )
      if (conflict) {
        const player = [...homePlayers, ...awayPlayers].find(p => p.id === playerId)
        toast.error(
          `⚠️ DUPLICATE: ${player?.name} already checked into ${conflict.home_team?.name} vs ${conflict.away_team?.name} at ${selectedGame.scheduled_time}`,
          { duration: 5000 }
        )
        return
      }
      await db.checkInPlayer(selectedGameId, playerId)
      setCheckins(prev => [...prev, { id: Date.now(), game_id: selectedGameId, player_id: playerId, checked_in_at: new Date().toISOString() }])
    } else {
      await db.checkOutPlayer(selectedGameId, playerId)
      setCheckins(prev => prev.filter(c => c.player_id !== playerId))
    }
  }

  const homeIn  = homePlayers.filter(p => isCheckedIn(p.id)).length
  const awayIn  = awayPlayers.filter(p => isCheckedIn(p.id)).length

  return (
    <div>
      <SectionHeader>PLAYER GAME CHECK-IN</SectionHeader>

      <div className="mb-4">
        <select
          className="bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[13px] font-bold w-full max-w-md outline-none focus:border-blue-400"
          value={selectedGameId ?? ''}
          onChange={e => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select a game to begin check-in…</option>
          {state.games.map(g => (
            <option key={g.id} value={g.id}>
              {g.scheduled_time} — {g.home_team?.name ?? '?'} vs {g.away_team?.name ?? '?'} ({g.field?.name ?? `F${g.field_id}`})
            </option>
          ))}
        </select>
      </div>

      {!selectedGame && (
        <div className="text-center py-16 text-muted font-cond font-bold tracking-widest text-sm">
          SELECT A GAME TO BEGIN PLAYER CHECK-IN
        </div>
      )}

      {selectedGame && loading && (
        <div className="text-center py-10 text-muted font-cond font-bold tracking-widest text-sm">
          LOADING ROSTERS…
        </div>
      )}

      {selectedGame && !loading && (
        <div className="grid grid-cols-2 gap-4">
          <RosterCheckinPanel
            teamName={selectedGame.home_team?.name ?? 'Home'}
            players={homePlayers}
            checkedIn={homeIn}
            isChecked={isCheckedIn}
            onToggle={togglePlayer}
          />
          <RosterCheckinPanel
            teamName={selectedGame.away_team?.name ?? 'Away'}
            players={awayPlayers}
            checkedIn={awayIn}
            isChecked={isCheckedIn}
            onToggle={togglePlayer}
          />
        </div>
      )}
    </div>
  )
}

function RosterCheckinPanel({
  teamName, players, checkedIn, isChecked, onToggle
}: {
  teamName: string
  players: Player[]
  checkedIn: number
  isChecked: (id: number) => boolean
  onToggle: (id: number) => void
}) {
  const pct = players.length > 0 ? Math.round((checkedIn / players.length) * 100) : 0

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="font-cond text-[13px] font-black tracking-wide text-white">{teamName.toUpperCase()}</div>
        <div className="font-cond text-[11px] font-bold text-green-400">{checkedIn}/{players.length} VERIFIED</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded overflow-hidden mb-3">
        <div
          className="h-full bg-green-500 rounded transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-navy">
            {['#','PLAYER','POSITION','IN'].map(h => (
              <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-2 py-1.5 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(player => {
            const checked = isChecked(player.id)
            return (
              <tr
                key={player.id}
                className={cn(
                  'border-b border-border/40 cursor-pointer transition-colors',
                  checked ? 'bg-green-900/15' : 'hover:bg-white/5'
                )}
                onClick={() => onToggle(player.id)}
              >
                <td className="font-mono text-[11px] text-muted px-2 py-1.5">{player.number ?? '—'}</td>
                <td className={cn('font-cond font-bold text-[12px] px-2 py-1.5', checked ? 'text-green-300' : 'text-white')}>
                  {player.name}
                </td>
                <td className="text-[10px] text-muted px-2 py-1.5">{player.position ?? '—'}</td>
                <td className="px-2 py-1.5">
                  <div className={cn(
                    'w-5 h-5 rounded border flex items-center justify-center transition-all',
                    checked
                      ? 'bg-green-500 border-green-500'
                      : 'border-border bg-transparent'
                  )}>
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
