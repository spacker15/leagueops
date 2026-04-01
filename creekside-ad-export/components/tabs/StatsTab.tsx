'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, fmtDate, fmtTime, SPORT_STAT_KEYS } from '@/lib/utils'
import type { Game, GameStat, Player, Team } from '@/types'
import * as db from '@/lib/db'
import { useApp } from '@/lib/store'
import { Select, SectionHeader } from '@/components/ui'

type View = 'enter' | 'totals'
type SortDir = 'asc' | 'desc'

// Pending edits keyed by player_id
type PendingStats = Record<number, Record<string, string>>

export function StatsTab() {
  const { games, teams } = useApp()

  const [view, setView] = useState<View>('enter')

  // Enter Stats state
  const [enterTeamId, setEnterTeamId] = useState<string>('')
  const [enterGameId, setEnterGameId] = useState<string>('')
  const [gamePlayers, setGamePlayers] = useState<Player[]>([])
  const [existingStats, setExistingStats] = useState<GameStat[]>([])
  const [pending, setPending] = useState<PendingStats>({})
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  // Season Totals state
  const [totalsTeamId, setTotalsTeamId] = useState<string>('')
  const [totalsPlayers, setTotalsPlayers] = useState<Player[]>([])
  const [totalsStats, setTotalsStats] = useState<GameStat[]>([])
  const [loadingTotals, setLoadingTotals] = useState(false)
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Games for the enter-stats team selector
  const teamGames: Game[] = useMemo(() => {
    if (!enterTeamId) return []
    return games
      .filter((g) => String(g.team_id) === enterTeamId)
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
  }, [games, enterTeamId])

  // Determine stat columns from sport name
  const selectedTeam: Team | undefined = useMemo(
    () => teams.find((t) => t.id === Number(enterTeamId)),
    [teams, enterTeamId]
  )

  const statKeys = useMemo(() => {
    const sportName = selectedTeam?.sport?.name ?? ''
    return SPORT_STAT_KEYS[sportName] ?? []
  }, [selectedTeam])

  const selectedGame: Game | undefined = useMemo(
    () => games.find((g) => g.id === Number(enterGameId)),
    [games, enterGameId]
  )

  // Load players + existing stats when game selected
  useEffect(() => {
    if (!enterTeamId || !enterGameId) {
      setGamePlayers([])
      setExistingStats([])
      setPending({})
      return
    }
    let cancelled = false
    async function load() {
      setLoadingPlayers(true)
      try {
        const [players, stats] = await Promise.all([
          db.getPlayers(Number(enterTeamId)),
          db.getGameStats(Number(enterGameId)),
        ])
        if (cancelled) return
        setGamePlayers(players)
        setExistingStats(stats)
        // Seed pending from existing stats
        const init: PendingStats = {}
        for (const p of players) {
          const existing = stats.find((s) => s.player_id === p.id)
          const row: Record<string, string> = {}
          for (const sk of SPORT_STAT_KEYS[selectedTeam?.sport?.name ?? ''] ?? []) {
            row[sk.key] = existing ? String(existing.stats[sk.key] ?? 0) : '0'
          }
          init[p.id] = row
        }
        setPending(init)
      } finally {
        if (!cancelled) setLoadingPlayers(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterTeamId, enterGameId])

  function handleCellChange(playerId: number, key: string, value: string) {
    setPending((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [key]: value },
    }))
  }

  async function handleBlurSave(playerId: number) {
    if (!enterGameId || !enterTeamId) return
    const playerPending = pending[playerId]
    if (!playerPending) return
    const stats: Record<string, number> = {}
    for (const [k, v] of Object.entries(playerPending)) {
      stats[k] = parseInt(v) || 0
    }
    try {
      await db.upsertGameStat({
        game_id: Number(enterGameId),
        player_id: playerId,
        team_id: Number(enterTeamId),
        stats,
      })
    } catch {
      // Silently fail on blur; user can Save All for feedback
    }
  }

  async function handleSaveAll() {
    if (!enterGameId || !enterTeamId) return
    setSavingAll(true)
    try {
      await Promise.all(
        gamePlayers.map((p) => {
          const playerPending = pending[p.id] ?? {}
          const stats: Record<string, number> = {}
          for (const [k, v] of Object.entries(playerPending)) {
            stats[k] = parseInt(v) || 0
          }
          return db.upsertGameStat({
            game_id: Number(enterGameId),
            player_id: p.id,
            team_id: Number(enterTeamId),
            stats,
          })
        })
      )
      toast.success('Stats saved')
      const updated = await db.getGameStats(Number(enterGameId))
      setExistingStats(updated)
    } catch {
      toast.error('Failed to save stats')
    } finally {
      setSavingAll(false)
    }
  }

  // Season Totals
  const totalsTeam: Team | undefined = useMemo(
    () => teams.find((t) => t.id === Number(totalsTeamId)),
    [teams, totalsTeamId]
  )

  const totalsStatKeys = useMemo(() => {
    const sportName = totalsTeam?.sport?.name ?? ''
    return SPORT_STAT_KEYS[sportName] ?? []
  }, [totalsTeam])

  useEffect(() => {
    if (!totalsTeamId) {
      setTotalsPlayers([])
      setTotalsStats([])
      return
    }
    let cancelled = false
    async function load() {
      setLoadingTotals(true)
      try {
        const teamGamesAll = games.filter((g) => String(g.team_id) === totalsTeamId)
        const [players, ...statArrays] = await Promise.all([
          db.getPlayers(Number(totalsTeamId)),
          ...teamGamesAll.map((g) => db.getGameStats(g.id)),
        ])
        if (cancelled) return
        const allStats = statArrays.flat()
        setTotalsPlayers(players)
        setTotalsStats(allStats)
      } finally {
        if (!cancelled) setLoadingTotals(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalsTeamId, games])

  // Aggregate totals per player
  const aggregated: { player: Player; totals: Record<string, number> }[] = useMemo(() => {
    return totalsPlayers.map((p) => {
      const playerStats = totalsStats.filter((s) => s.player_id === p.id)
      const totals: Record<string, number> = {}
      for (const sk of totalsStatKeys) {
        totals[sk.key] = playerStats.reduce((sum, s) => sum + (s.stats[sk.key] ?? 0), 0)
      }
      return { player: p, totals }
    })
  }, [totalsPlayers, totalsStats, totalsStatKeys])

  const sorted = useMemo(() => {
    return [...aggregated].sort((a, b) => {
      let av: number | string, bv: number | string
      if (sortKey === 'name') {
        av = a.player.name
        bv = b.player.name
      } else if (sortKey === 'jersey') {
        av = a.player.jersey_number ?? 999
        bv = b.player.jersey_number ?? 999
      } else {
        av = a.totals[sortKey] ?? 0
        bv = b.totals[sortKey] ?? 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [aggregated, sortKey, sortDir])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronUp size={10} className="text-muted/40" />
    return sortDir === 'asc' ? (
      <ChevronUp size={10} className="text-blue-400" />
    ) : (
      <ChevronDown size={10} className="text-blue-400" />
    )
  }

  const isGK = (p: Player) =>
    p.position?.toLowerCase().includes('goalie') ||
    p.position?.toLowerCase().includes('gk') ||
    p.position?.toLowerCase().includes('goalkeeper')

  return (
    <div className="tab-content">
      {/* View toggle */}
      <div className="flex gap-1 mb-5 bg-surface-card border border-border rounded-lg p-1 w-fit">
        {(['enter', 'totals'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-4 py-1.5 rounded-md text-[12px] font-cond font-bold tracking-wide transition-colors',
              view === v ? 'bg-navy text-white' : 'text-muted hover:text-white'
            )}
          >
            {v === 'enter' ? 'Enter Stats' : 'Season Totals'}
          </button>
        ))}
      </div>

      {/* ── Enter Stats ─────────────────────────────────────── */}
      {view === 'enter' && (
        <div>
          {/* Selectors */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                Team
              </span>
              <select
                value={enterTeamId}
                onChange={(e) => {
                  setEnterTeamId(e.target.value)
                  setEnterGameId('')
                }}
                className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {enterTeamId && (
              <div className="flex flex-col gap-1 min-w-[240px]">
                <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                  Game
                </span>
                <select
                  value={enterGameId}
                  onChange={(e) => setEnterGameId(e.target.value)}
                  className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
                >
                  <option value="">Select game…</option>
                  {teamGames.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {fmtDate(g.scheduled_date)}
                      {g.scheduled_time ? ` ${fmtTime(g.scheduled_time)}` : ''} —{' '}
                      {g.is_home ? g.away_team_name : g.home_team_name} ({g.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Stat entry table */}
          {!enterGameId ? (
            <div className="text-center text-muted text-[13px] py-16">
              Select a team and game to enter stats.
            </div>
          ) : loadingPlayers ? (
            <div className="text-center text-muted text-[13px] py-16">Loading players…</div>
          ) : gamePlayers.length === 0 ? (
            <div className="text-center text-muted text-[13px] py-16">
              No active players on this team.
            </div>
          ) : statKeys.length === 0 ? (
            <div className="text-center text-muted text-[13px] py-16">
              No stat columns configured for this sport.
            </div>
          ) : (
            <>
              {selectedGame && (
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                    {selectedGame.home_team_name} vs {selectedGame.away_team_name} —{' '}
                    {fmtDate(selectedGame.scheduled_date)}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="font-cond font-black tracking-widest uppercase text-[10px] text-muted pb-2 pr-3 w-6">
                        #
                      </th>
                      <th className="font-cond font-black tracking-widest uppercase text-[10px] text-muted pb-2 pr-6">
                        Player
                      </th>
                      {statKeys.map((sk) => (
                        <th
                          key={sk.key}
                          className={cn(
                            'font-cond font-black tracking-widest uppercase text-[10px] pb-2 px-2 text-center',
                            sk.gkOnly ? 'text-blue-400/60' : 'text-muted'
                          )}
                        >
                          {sk.label}
                          {sk.gkOnly && <span className="ml-0.5 text-[8px]">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gamePlayers.map((p) => {
                      const gk = isGK(p)
                      return (
                        <tr key={p.id} className="border-b border-border/40 hover:bg-white/[0.015]">
                          <td className="font-mono text-[11px] text-muted py-2 pr-3">
                            {p.jersey_number ?? '—'}
                          </td>
                          <td className="py-2 pr-6">
                            <div className="flex items-center gap-2">
                              <span className="font-cond font-bold text-[12px] text-white">
                                {p.name}
                              </span>
                              {p.position && (
                                <span className="font-cond text-[10px] text-muted uppercase">
                                  {p.position}
                                </span>
                              )}
                            </div>
                          </td>
                          {statKeys.map((sk) => {
                            const disabled = sk.gkOnly && !gk
                            return (
                              <td key={sk.key} className="py-2 px-2">
                                {disabled ? (
                                  <span className="block w-14 text-center text-muted/30 text-[11px]">
                                    —
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={pending[p.id]?.[sk.key] ?? '0'}
                                    onChange={(e) => handleCellChange(p.id, sk.key, e.target.value)}
                                    onBlur={() => handleBlurSave(p.id)}
                                    className="w-14 bg-[#040e24] border border-[#1e3060] text-white px-1.5 py-1 rounded text-[12px] font-mono text-center outline-none focus:border-blue-400/60 transition-colors"
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[11px] text-muted">
                  * GK-only stats (saves, goals against) — non-goalies show —
                </p>
                <button
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className={cn(
                    'font-cond font-bold tracking-wide rounded-lg transition-colors inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px]',
                    'bg-navy hover:bg-navy-light text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {savingAll ? 'Saving…' : 'Save All'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Season Totals ───────────────────────────────────── */}
      {view === 'totals' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                Team
              </span>
              <select
                value={totalsTeamId}
                onChange={(e) => setTotalsTeamId(e.target.value)}
                className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!totalsTeamId ? (
            <div className="text-center text-muted text-[13px] py-16">
              Select a team to view season totals.
            </div>
          ) : loadingTotals ? (
            <div className="text-center text-muted text-[13px] py-16">Loading…</div>
          ) : totalsPlayers.length === 0 ? (
            <div className="text-center text-muted text-[13px] py-16">
              No active players on this team.
            </div>
          ) : totalsStatKeys.length === 0 ? (
            <div className="text-center text-muted text-[13px] py-16">
              No stat columns configured for this sport.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className="font-cond font-black tracking-widest uppercase text-[10px] text-muted pb-2 pr-3 w-6 cursor-pointer hover:text-white select-none"
                      onClick={() => handleSort('jersey')}
                    >
                      <span className="inline-flex items-center gap-1">
                        # <SortIcon col="jersey" />
                      </span>
                    </th>
                    <th
                      className="font-cond font-black tracking-widest uppercase text-[10px] text-muted pb-2 pr-6 cursor-pointer hover:text-white select-none"
                      onClick={() => handleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Player <SortIcon col="name" />
                      </span>
                    </th>
                    {totalsStatKeys.map((sk) => (
                      <th
                        key={sk.key}
                        onClick={() => handleSort(sk.key)}
                        className={cn(
                          'font-cond font-black tracking-widest uppercase text-[10px] pb-2 px-3 text-center cursor-pointer hover:text-white select-none',
                          sk.gkOnly ? 'text-blue-400/60' : 'text-muted'
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {sk.label}
                          {sk.gkOnly && <span className="text-[8px]">*</span>}
                          <SortIcon col={sk.key} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ player, totals }) => (
                    <tr
                      key={player.id}
                      className="border-b border-border/40 hover:bg-white/[0.015]"
                    >
                      <td className="font-mono text-[11px] text-muted py-2.5 pr-3">
                        {player.jersey_number ?? '—'}
                      </td>
                      <td className="py-2.5 pr-6">
                        <div className="flex items-center gap-2">
                          <span className="font-cond font-bold text-[12px] text-white">
                            {player.name}
                          </span>
                          {player.position && (
                            <span className="font-cond text-[10px] text-muted uppercase">
                              {player.position}
                            </span>
                          )}
                        </div>
                      </td>
                      {totalsStatKeys.map((sk) => {
                        const gk = isGK(player)
                        const disabled = sk.gkOnly && !gk
                        return (
                          <td
                            key={sk.key}
                            className="font-mono text-[12px] py-2.5 px-3 text-center"
                          >
                            <span className={disabled ? 'text-muted/30' : 'text-white'}>
                              {disabled ? '—' : (totals[sk.key] ?? 0)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
