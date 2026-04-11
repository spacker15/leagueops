'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { createClient } from '@/supabase/client'
import { getAllGamesByEvent } from '@/lib/db'
import type { Game, Team, Referee, Incident, MedicalIncident } from '@/types'

type SubTab = 'results' | 'standings' | 'leaders' | 'matchups' | 'ref-schedule' | 'incidents'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'results', label: 'RESULTS' },
  { id: 'standings', label: 'STANDINGS' },
  { id: 'leaders', label: 'STAT LEADERS' },
  { id: 'matchups', label: 'MATCHUPS' },
  { id: 'ref-schedule', label: 'REF SCHEDULE' },
  { id: 'incidents', label: 'INCIDENTS' },
]

function timeToMin(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

export function ReportsTab() {
  const { state, currentDate, changeDate } = useApp()
  const [sub, setSub] = useState<SubTab>('results')
  const [allGames, setAllGames] = useState<Game[]>([])

  useEffect(() => {
    if (!state.event?.id) return
    getAllGamesByEvent(state.event.id).then(setAllGames)
  }, [state.event?.id, state.games]) // re-fetch when state.games changes (scores/status updated)

  const finalGames = useMemo(() => allGames.filter((g) => g.status === 'Final'), [allGames])

  // Fetch registration_divisions from settings so divisions with no games still appear
  const [settingsDivisions, setSettingsDivisions] = useState<string[]>([])
  useEffect(() => {
    if (!state.event?.id) return
    const sb = createClient()
    sb.from('registration_divisions')
      .select('name')
      .eq('event_id', state.event.id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setSettingsDivisions((data ?? []).map((d: { name: string }) => d.name))
      })
  }, [state.event?.id])

  // Event-scoped divisions: only from registration_divisions for this event
  // If no registration_divisions exist, fall back to divisions found in THIS event's games only
  const divisions = useMemo(() => {
    if (settingsDivisions.length > 0) {
      return ['ALL', ...settingsDivisions]
    }
    // Fallback: divisions from this event's games only (already scoped by getAllGamesByEvent)
    const gameDivs = [...new Set(allGames.map((g) => g.division))].sort()
    return ['ALL', ...gameDivs]
  }, [allGames, settingsDivisions])

  const [divFilter, setDivFilter] = useState('ALL')

  const showDivFilter = true // show division filter on all tabs including ref-schedule

  return (
    <div className="p-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-sm bg-red" />
        <span className="font-cond text-[13px] font-black tracking-[.15em] text-white uppercase">
          Reports
        </span>
        <span className="font-cond text-[11px] text-muted ml-1">
          — {finalGames.length} final games
        </span>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-5 flex-wrap" style={{ borderBottom: '1px solid #1a2d50' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              'font-cond text-[11px] font-black tracking-[.12em] px-4 py-2 transition-colors relative',
              sub === t.id ? 'text-white' : 'text-[#5a6e9a] hover:text-white'
            )}
          >
            {t.label}
            {sub === t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red" />}
          </button>
        ))}

        {/* Division filter */}
        {showDivFilter && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
              Division
            </span>
            <select
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
              className="bg-[#081428] border border-[#1a2d50] text-white px-2 py-1 rounded text-[11px] font-cond font-bold outline-none focus:border-blue-400"
            >
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {sub === 'results' && (
        <ResultsView games={finalGames} teams={state.teams} divFilter={divFilter} />
      )}
      {sub === 'standings' && (
        <StandingsView games={finalGames} teams={state.teams} divFilter={divFilter} />
      )}
      {sub === 'leaders' && (
        <LeadersView games={finalGames} teams={state.teams} divFilter={divFilter} />
      )}
      {sub === 'matchups' && (
        <MatchupsView teams={state.teams} eventId={state.event?.id ?? null} divFilter={divFilter} />
      )}
      {sub === 'ref-schedule' && (
        <RefScheduleView
          games={allGames}
          fields={state.fields}
          referees={state.referees}
          eventId={state.event?.id ?? null}
          divFilter={divFilter}
          globalDateId={currentDate?.id ?? null}
          globalDateIdx={state.currentDateIdx}
          eventDatesFromState={state.eventDates}
          onDateChange={(dateId) => {
            if (dateId === null) {
              changeDate(-1)
            } else {
              const idx = state.eventDates.findIndex((d) => d.id === dateId)
              if (idx !== -1) changeDate(idx)
            }
          }}
        />
      )}
      {sub === 'incidents' && (
        <IncidentsReportView
          incidents={state.incidents}
          medicalIncidents={state.medicalIncidents}
          eventDates={state.eventDates}
          fields={state.fields}
        />
      )}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

function ResultsView({
  games,
  teams,
  divFilter,
}: {
  games: Game[]
  teams: Team[]
  divFilter: string
}) {
  const filtered = divFilter === 'ALL' ? games : games.filter((g) => g.division === divFilter)

  if (filtered.length === 0) {
    return <Empty message="No final games yet." />
  }

  const byDiv = groupBy(filtered, (g) => g.division)

  return (
    <div className="space-y-5">
      {Object.entries(byDiv)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([div, divGames]) => (
          <div key={div}>
            <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-2">
              {div}
            </div>
            <div className="rounded-lg overflow-hidden border border-[#1a2d50]">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#081428' }}>
                    <Th>Home</Th>
                    <Th align="center">Score</Th>
                    <Th>Away</Th>
                    <Th>Field</Th>
                    <Th>Time</Th>
                  </tr>
                </thead>
                <tbody>
                  {divGames.map((g, i) => {
                    const homeWin = g.home_score > g.away_score
                    const awayWin = g.away_score > g.home_score
                    return (
                      <tr key={g.id} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                        <Td>
                          <TeamName
                            name={g.home_team?.name ?? `Team ${g.home_team_id}`}
                            win={homeWin}
                          />
                        </Td>
                        <Td align="center">
                          <span className="font-mono text-[15px] font-bold text-white tracking-wider">
                            {g.home_score} – {g.away_score}
                          </span>
                        </Td>
                        <Td>
                          <TeamName
                            name={g.away_team?.name ?? `Team ${g.away_team_id}`}
                            win={awayWin}
                          />
                        </Td>
                        <Td>{g.field?.name ?? '—'}</Td>
                        <Td>{formatTime(g.scheduled_time)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  )
}

// ── Standings ─────────────────────────────────────────────────────────────────

interface TeamRecord {
  teamId: number
  name: string
  w: number
  l: number
  t: number
  gf: number
  ga: number
  gd: number
  pts: number
}

function StandingsView({
  games,
  teams,
  divFilter,
}: {
  games: Game[]
  teams: Team[]
  divFilter: string
}) {
  const allGames = games
  const filtered = divFilter === 'ALL' ? allGames : allGames.filter((g) => g.division === divFilter)

  const records = buildRecords(filtered, teams)
  const byDiv = groupBy(Object.values(records), (r) => {
    const team = teams.find((t) => t.id === r.teamId)
    return team?.division ?? 'Unknown'
  })

  if (Object.keys(records).length === 0) {
    return <Empty message="No final games to build standings from." />
  }

  return (
    <div className="space-y-5">
      {Object.entries(byDiv)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([div, rows]) => {
          const sorted = [...rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
          return (
            <div key={div}>
              <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-2">
                {div}
              </div>
              <div className="rounded-lg overflow-hidden border border-[#1a2d50]">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#081428' }}>
                      <Th>#</Th>
                      <Th>Team</Th>
                      <Th align="center">GP</Th>
                      <Th align="center">W</Th>
                      <Th align="center">L</Th>
                      <Th align="center">T</Th>
                      <Th align="center">GF</Th>
                      <Th align="center">GA</Th>
                      <Th align="center">GD</Th>
                      <Th align="center">PTS</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr
                        key={r.teamId}
                        style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}
                      >
                        <Td>
                          <span className="font-mono text-[12px] text-muted">{i + 1}</span>
                        </Td>
                        <Td>
                          <span className="font-cond text-[13px] font-bold text-white">
                            {r.name}
                          </span>
                        </Td>
                        <StatCell>{r.w + r.l + r.t}</StatCell>
                        <StatCell highlight={r.w > 0}>{r.w}</StatCell>
                        <StatCell>{r.l}</StatCell>
                        <StatCell>{r.t}</StatCell>
                        <StatCell>{r.gf}</StatCell>
                        <StatCell>{r.ga}</StatCell>
                        <StatCell highlight={r.gd > 0} dim={r.gd < 0}>
                          {r.gd > 0 ? `+${r.gd}` : r.gd}
                        </StatCell>
                        <Td align="center">
                          <span className="font-mono text-[13px] font-bold text-white">
                            {r.pts}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="font-cond text-[9px] text-muted mt-1 tracking-wide">
                W=3 pts · T=1 pt · Tiebreakers: GD → GF
              </div>
            </div>
          )
        })}
    </div>
  )
}

// ── Stat Leaders ──────────────────────────────────────────────────────────────

function LeadersView({
  games,
  teams,
  divFilter,
}: {
  games: Game[]
  teams: Team[]
  divFilter: string
}) {
  const filtered = divFilter === 'ALL' ? games : games.filter((g) => g.division === divFilter)
  const records = buildRecords(filtered, teams)
  const rows = Object.values(records)

  if (rows.length === 0) {
    return <Empty message="No final games for stat leaders." />
  }

  const topOffense = [...rows].sort((a, b) => b.gf - a.gf).slice(0, 8)
  const topDefense = [...rows]
    .filter((r) => r.ga >= 0)
    .sort((a, b) => a.ga - b.ga)
    .slice(0, 8)
  const topWinPct = [...rows]
    .filter((r) => r.w + r.l + r.t > 0)
    .sort((a, b) => winPct(b) - winPct(a))
    .slice(0, 8)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <LeaderBoard
        title="TOP OFFENSE"
        subtitle="Goals For"
        rows={topOffense}
        value={(r) => r.gf}
        valueLabel="GF"
      />
      <LeaderBoard
        title="TOP DEFENSE"
        subtitle="Fewest Goals Against"
        rows={topDefense}
        value={(r) => r.ga}
        valueLabel="GA"
        ascending
      />
      <LeaderBoard
        title="WIN %"
        subtitle="Min 1 game played"
        rows={topWinPct}
        value={(r) => Math.round(winPct(r) * 100)}
        valueLabel="W%"
      />
    </div>
  )
}

function LeaderBoard({
  title,
  subtitle,
  rows,
  value,
  valueLabel,
  ascending = false,
}: {
  title: string
  subtitle: string
  rows: TeamRecord[]
  value: (r: TeamRecord) => number
  valueLabel: string
  ascending?: boolean
}) {
  return (
    <div className="rounded-lg border border-[#1a2d50] overflow-hidden">
      <div className="px-4 py-2.5" style={{ background: '#081428' }}>
        <div className="font-cond text-[11px] font-black tracking-[.12em] text-white">{title}</div>
        <div className="font-cond text-[9px] text-muted mt-0.5">{subtitle}</div>
      </div>
      <div>
        {rows.map((r, i) => {
          const val = value(r)
          const maxVal = Math.max(...rows.map(value)) || 1
          const barPct = ascending ? (1 - val / maxVal) * 100 : (val / maxVal) * 100

          return (
            <div
              key={r.teamId}
              className="flex items-center gap-3 px-4 py-2"
              style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}
            >
              <span className="font-mono text-[11px] text-muted w-4 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-cond text-[12px] font-bold text-white truncate">{r.name}</div>
                <div
                  className="mt-0.5 h-1 rounded-full overflow-hidden"
                  style={{ background: '#1a2d50' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, background: i === 0 ? '#D62828' : '#0B3D91' }}
                  />
                </div>
              </div>
              <span className="font-mono text-[14px] font-bold text-white flex-shrink-0">
                {valueLabel === 'W%' ? `${val}%` : val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Matchups ──────────────────────────────────────────────────────────────────

interface AllGame {
  id: number
  home_team_id: number
  away_team_id: number
  division: string
}

function MatchupsView({
  teams,
  eventId,
  divFilter,
}: {
  teams: Team[]
  eventId: number | null
  divFilter: string
}) {
  const [allGames, setAllGames] = useState<AllGame[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsDivisions, setSettingsDivisions] = useState<string[]>([])

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    const sb = createClient()
    sb.from('games')
      .select('id, home_team_id, away_team_id, division')
      .eq('event_id', eventId)
      .then(({ data, error }) => {
        if (error) console.error('MatchupsView: failed to load games', error)
        setAllGames((data as AllGame[]) ?? [])
        setLoading(false)
      })
  }, [eventId])

  // Fetch registration_divisions so divisions with no games appear in per-division view
  useEffect(() => {
    if (!eventId) return
    const sb = createClient()
    sb.from('registration_divisions')
      .select('name')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setSettingsDivisions((data ?? []).map((d: { name: string }) => d.name))
      })
  }, [eventId])

  // All unique divisions (from settings + games), sorted
  const allDivisions = useMemo(() => {
    const gameDivs = allGames.map((g) => g.division)
    return [...new Set([...settingsDivisions, ...gameDivs])].sort()
  }, [allGames, settingsDivisions])

  if (loading) return <Empty message="Loading matchup data..." />

  // Helper: find teams that participate in games for a given division
  // (uses game division, NOT team.division — teams can play across divisions)
  function teamsForDivGames(divGames: AllGame[]): Team[] {
    const teamIds = new Set<number>()
    for (const g of divGames) {
      teamIds.add(g.home_team_id)
      teamIds.add(g.away_team_id)
    }
    return teams.filter((t) => teamIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name))
  }

  // When a specific division is selected, show a single matrix
  if (divFilter !== 'ALL') {
    const divGames = allGames.filter((g) => g.division === divFilter)
    const divTeams = teamsForDivGames(divGames)
    if (divTeams.length === 0) return <Empty message="No teams found for this division." />
    return <MatchupMatrix teams={divTeams} games={divGames} showDivisionOnRow={false} />
  }

  // "ALL" — show separate matrices per division
  const divisionsWithGames = allDivisions.filter((div) => allGames.some((g) => g.division === div))
  if (divisionsWithGames.length === 0) return <Empty message="No teams found." />

  return (
    <div className="space-y-8">
      {divisionsWithGames.map((div) => {
        const divGames = allGames.filter((g) => g.division === div)
        const divTeams = teamsForDivGames(divGames)
        return (
          <div key={div}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-sm bg-navy" />
              <span className="font-cond text-[14px] font-black tracking-[.12em] text-blue-300 uppercase">
                {div}
              </span>
              <span className="font-cond text-[11px] text-muted ml-1">
                {divTeams.length} teams · {divGames.length} games
              </span>
            </div>
            <MatchupMatrix teams={divTeams} games={divGames} showDivisionOnRow={false} />
          </div>
        )
      })}
    </div>
  )
}

/** Renders a single matchup matrix table for a set of teams and games */
function MatchupMatrix({
  teams: matrixTeams,
  games,
  showDivisionOnRow,
}: {
  teams: Team[]
  games: AllGame[]
  showDivisionOnRow: boolean
}) {
  // Build matrix: matrix[rowTeamId][colTeamId] = count
  const matrix = useMemo(() => {
    const m: Record<number, Record<number, number>> = {}
    for (const g of games) {
      if (!m[g.home_team_id]) m[g.home_team_id] = {}
      if (!m[g.away_team_id]) m[g.away_team_id] = {}
      m[g.home_team_id][g.away_team_id] = (m[g.home_team_id][g.away_team_id] ?? 0) + 1
      m[g.away_team_id][g.home_team_id] = (m[g.away_team_id][g.home_team_id] ?? 0) + 1
    }
    return m
  }, [games])

  if (matrixTeams.length === 0) {
    return (
      <div className="font-cond text-[10px] text-muted italic py-2">No teams in this division.</div>
    )
  }

  const maxCount = Math.max(
    1,
    ...matrixTeams.flatMap((row) =>
      matrixTeams.map((col) => (row.id !== col.id ? (matrix[row.id]?.[col.id] ?? 0) : 0))
    )
  )

  return (
    <div>
      <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-3">
        Games Played Between Teams · {games.length} total games
      </div>
      <div className="overflow-auto rounded-lg border border-[#1a2d50]">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr style={{ background: '#081428' }}>
              {/* Top-left corner cell */}
              <th
                className="px-3 py-2 border-r border-b border-[#1a2d50] sticky left-0 z-10"
                style={{ background: '#081428', minWidth: 140 }}
              >
                <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                  vs →
                </span>
              </th>
              {matrixTeams.map((col) => (
                <th
                  key={col.id}
                  className="px-2 py-2 border-b border-[#1a2d50]"
                  style={{ minWidth: 64 }}
                >
                  <div
                    className="font-cond text-[10px] font-black text-[#8a9ec0] whitespace-nowrap"
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      maxHeight: 100,
                    }}
                    title={col.name}
                  >
                    {col.name.length > 14 ? col.name.slice(0, 13) + '...' : col.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixTeams.map((row, ri) => (
              <tr key={row.id} style={{ background: ri % 2 === 0 ? '#050f20' : '#030c1a' }}>
                {/* Row header */}
                <td
                  className="px-3 py-1.5 border-r border-[#1a2d50] sticky left-0 z-10"
                  style={{ background: ri % 2 === 0 ? '#050f20' : '#030c1a' }}
                >
                  <span
                    className="font-cond text-[11px] font-bold text-white whitespace-nowrap"
                    title={row.name}
                  >
                    {row.name.length > 18 ? row.name.slice(0, 17) + '...' : row.name}
                  </span>
                  {showDivisionOnRow && (
                    <span className="ml-1.5 font-cond text-[9px] text-muted">{row.division}</span>
                  )}
                </td>
                {/* Matrix cells */}
                {matrixTeams.map((col) => {
                  const isSelf = row.id === col.id
                  const count = isSelf ? null : (matrix[row.id]?.[col.id] ?? 0)
                  const intensity = isSelf ? 0 : (count ?? 0) / maxCount

                  return (
                    <td
                      key={col.id}
                      className="text-center px-1 py-1.5 border-[#1a2d50]"
                      style={{ borderLeft: '1px solid #0d1e3a' }}
                    >
                      {isSelf ? (
                        <div
                          className="w-8 h-6 mx-auto rounded"
                          style={{ background: '#0d1e3a' }}
                        />
                      ) : count === 0 ? (
                        <span className="font-mono text-[12px] text-[#1a2d50]">---</span>
                      ) : (
                        <div
                          className="w-8 h-6 mx-auto rounded flex items-center justify-center"
                          style={
                            (count ?? 0) >= 3
                              ? {
                                  background: 'rgba(214,40,40,0.55)',
                                  border: '1px solid rgba(214,40,40,0.8)',
                                }
                              : (count ?? 0) === 2
                                ? {
                                    background: 'rgba(251,191,36,0.4)',
                                    border: '1px solid rgba(251,191,36,0.7)',
                                  }
                                : {
                                    background: 'rgba(34,197,94,0.35)',
                                    border: '1px solid rgba(34,197,94,0.6)',
                                  }
                          }
                        >
                          <span className="font-mono text-[13px] font-bold text-white">
                            {count}
                          </span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <span className="font-cond text-[9px] text-muted tracking-wide">
          Cell = number of times teams have faced each other (home + away combined)
        </span>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-3 rounded"
              style={{
                background: 'rgba(34,197,94,0.35)',
                border: '1px solid rgba(34,197,94,0.6)',
              }}
            />
            <span className="font-cond text-[9px] text-muted">1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-3 rounded"
              style={{
                background: 'rgba(251,191,36,0.4)',
                border: '1px solid rgba(251,191,36,0.7)',
              }}
            />
            <span className="font-cond text-[9px] text-muted">2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-3 rounded"
              style={{
                background: 'rgba(214,40,40,0.55)',
                border: '1px solid rgba(214,40,40,0.8)',
              }}
            />
            <span className="font-cond text-[9px] text-muted">3+</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ref Schedule ──────────────────────────────────────────────────────────────

interface RefAssignmentRow {
  id: number
  game_id: number
  referee_id: number
  role: string
  referee: { id: number; name: string; grade_level: string } | null
}

type RefRules = Record<string, { adult: number; youth: number }>

function getExpected(division: string, rules: RefRules): { adult: number; youth: number } {
  return rules[division] ?? rules['default'] ?? { adult: 2, youth: 0 }
}

function isYouthRef(gradeLevel: string): boolean {
  return (gradeLevel?.toLowerCase() ?? '') === 'youth'
}

function RefScheduleView({
  games,
  fields,
  referees,
  eventId,
  divFilter,
  globalDateId,
  globalDateIdx,
  eventDatesFromState,
  onDateChange,
}: {
  games: Game[]
  fields: { id: number; name: string }[]
  referees: Referee[]
  eventId: number | null
  divFilter: string
  globalDateId: number | null
  globalDateIdx: number
  eventDatesFromState: { id: number; date: string; label: string | null }[]
  onDateChange: (dateId: number | null) => void
}) {
  const [assignments, setAssignments] = useState<RefAssignmentRow[]>([])
  const [refRules, setRefRules] = useState<RefRules>({
    U8: { adult: 0, youth: 2 },
    U10: { adult: 1, youth: 1 },
    default: { adult: 2, youth: 0 },
  })
  const [loading, setLoading] = useState(true)

  // Local date state, synced with global picker
  const [selectedDateId, setSelectedDateId] = useState<string>(() =>
    globalDateIdx === -1 ? 'all' : String(globalDateId ?? 'all')
  )

  // Sync local → global when dropdown changes
  function handleDateChange(val: string) {
    setSelectedDateId(val)
    onDateChange(val === 'all' ? null : parseInt(val))
  }

  // Sync global → local when global picker changes
  useEffect(() => {
    const derived = globalDateIdx === -1 ? 'all' : String(globalDateId ?? 'all')
    setSelectedDateId(derived)
  }, [globalDateIdx, globalDateId])

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    const sb = createClient()
    // Fetch ref_requirements from event config
    sb.from('events')
      .select('ref_requirements')
      .eq('id', eventId)
      .single()
      .then(({ data }) => {
        if (data && (data as any).ref_requirements) {
          setRefRules((data as any).ref_requirements)
        }
      })
    if (games.length === 0) {
      setLoading(false)
      return
    }
    const gameIds = games.map((g) => g.id)
    sb.from('ref_assignments')
      .select('id, game_id, referee_id, role, referee:referees(id, name, grade_level)')
      .in('game_id', gameIds)
      .then(({ data }) => {
        setAssignments((data as unknown as RefAssignmentRow[]) ?? [])
        setLoading(false)
      })
  }, [eventId, games])

  // Filter games by selected date and division
  const filteredGames = useMemo(() => {
    let filtered = games
    if (selectedDateId !== 'all') {
      const dateId = parseInt(selectedDateId)
      filtered = filtered.filter((g) => g.event_date_id === dateId)
    }
    if (divFilter !== 'ALL') {
      filtered = filtered.filter((g) => g.division === divFilter)
    }
    return filtered
  }, [games, selectedDateId, divFilter])

  // Build: fieldId → timeStr → { adult: RefAssignmentRow[], youth: RefAssignmentRow[], divisions: string[] }
  const schedule = useMemo(() => {
    type Slot = { adult: RefAssignmentRow[]; youth: RefAssignmentRow[]; divisions: string[] }
    const byField: Record<number, Record<string, Slot>> = {}

    // Index filtered games by id
    const gameById: Record<number, Game> = {}
    for (const g of filteredGames) gameById[g.id] = g

    // Collect divisions per field/time slot (from games, not assignments)
    for (const g of filteredGames) {
      const timeKey = g.scheduled_time ?? ''
      if (!byField[g.field_id]) byField[g.field_id] = {}
      if (!byField[g.field_id][timeKey])
        byField[g.field_id][timeKey] = { adult: [], youth: [], divisions: [] }
      byField[g.field_id][timeKey].divisions.push(g.division)
    }

    for (const a of assignments) {
      const game = gameById[a.game_id]
      if (!game) continue
      const fieldId = game.field_id
      const timeKey = game.scheduled_time ?? ''
      if (!byField[fieldId]) byField[fieldId] = {}
      if (!byField[fieldId][timeKey])
        byField[fieldId][timeKey] = { adult: [], youth: [], divisions: [] }
      const slot = byField[fieldId][timeKey]
      if (a.referee && isYouthRef(a.referee.grade_level)) {
        slot.youth.push(a)
      } else {
        slot.adult.push(a)
      }
    }
    return byField
  }, [assignments, filteredGames])

  // Collect all unique time strings across all fields, sorted chronologically
  const allTimes = useMemo(() => {
    const times = new Set<string>()
    for (const g of filteredGames) {
      if (g.scheduled_time) times.add(g.scheduled_time)
    }
    return [...times].sort((a, b) => timeToMin(a) - timeToMin(b))
  }, [filteredGames])

  // Fields that have at least one game
  const activeFieldIds = useMemo(() => {
    const ids = new Set(filteredGames.map((g) => g.field_id))
    return fields.filter((f) => ids.has(f.id))
  }, [filteredGames, fields])

  if (loading) return <Empty message="Loading ref schedule..." />
  if (games.length === 0) return <Empty message="No games scheduled." />

  // Summarize game counts per field/time slot
  const gamesByFieldTime: Record<number, Record<string, number>> = {}
  for (const g of filteredGames) {
    const timeKey = g.scheduled_time ?? ''
    if (!gamesByFieldTime[g.field_id]) gamesByFieldTime[g.field_id] = {}
    gamesByFieldTime[g.field_id][timeKey] = (gamesByFieldTime[g.field_id][timeKey] ?? 0) + 1
  }

  // Only count assignments for filtered games
  const filteredGameIds = new Set(filteredGames.map((g) => g.id))
  const filteredAssignments = assignments.filter((a) => filteredGameIds.has(a.game_id))
  const totalAssigned = filteredAssignments.length
  const totalAdult = filteredAssignments.filter(
    (a) => a.referee && !isYouthRef(a.referee.grade_level)
  ).length
  const totalYouth = filteredAssignments.filter(
    (a) => a.referee && isYouthRef(a.referee.grade_level)
  ).length

  return (
    <div className="space-y-5">
      {/* Date filter */}
      {eventDatesFromState.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
            Game Date
          </label>
          <select
            value={selectedDateId}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-[#040e24] border border-[#1a2d50] rounded px-3 py-1.5 text-sm text-white font-cond focus:outline-none focus:ring-1 focus:ring-[#0B3D91]"
          >
            <option value="all">All Dates</option>
            {eventDatesFromState.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.label || d.date}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'TOTAL ASSIGNED', value: totalAssigned, color: '#8a9ec0' },
          { label: 'ADULT REFS', value: totalAdult, color: '#60a5fa' },
          { label: 'YOUTH REFS', value: totalYouth, color: '#34d399' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[#1a2d50] px-4 py-3"
            style={{ background: '#081428' }}
          >
            <div className="font-cond text-[9px] font-black tracking-[.15em] text-muted uppercase">
              {s.label}
            </div>
            <div className="font-mono text-[28px] font-bold mt-0.5" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Ref Demand Summary: Time (rows) × Division (columns) ── */}
      {(() => {
        type DemandCell = { games: number; adultNeed: number; youthNeed: number }
        const demandMap = new Map<string, DemandCell>()
        const divSet = new Set<string>()
        const timeSet = new Set<string>()

        for (const g of filteredGames) {
          const timeKey = g.scheduled_time ?? ''
          const key = `${timeKey}|${g.division}`
          divSet.add(g.division)
          timeSet.add(timeKey)
          const exp = getExpected(g.division, refRules)
          const existing = demandMap.get(key)
          if (existing) {
            existing.games += 1
            existing.adultNeed += exp.adult
            existing.youthNeed += exp.youth
          } else {
            demandMap.set(key, { games: 1, adultNeed: exp.adult, youthNeed: exp.youth })
          }
        }

        const demandTimes = [...timeSet].sort((a, b) => timeToMin(a) - timeToMin(b))
        const demandDivs = [...divSet].sort()

        if (demandTimes.length === 0) return null

        // Column totals
        const divTotals = Object.fromEntries(
          demandDivs.map((d) => {
            let adult = 0,
              youth = 0,
              games = 0
            for (const t of demandTimes) {
              const cell = demandMap.get(`${t}|${d}`)
              if (cell) {
                adult += cell.adultNeed
                youth += cell.youthNeed
                games += cell.games
              }
            }
            return [d, { adult, youth, games }]
          })
        )
        const grandTotal = demandDivs.reduce(
          (acc, d) => ({
            adult: acc.adult + divTotals[d].adult,
            youth: acc.youth + divTotals[d].youth,
            games: acc.games + divTotals[d].games,
          }),
          { adult: 0, youth: 0, games: 0 }
        )

        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 rounded-sm bg-red" />
              <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
                Referee Demand Summary
              </span>
            </div>
            <div className="rounded-lg overflow-auto border border-[#1a2d50]">
              <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr style={{ background: '#081428' }}>
                    <Th>Time</Th>
                    {demandDivs.map((div) => (
                      <th key={div} className="px-3 py-2 border-b border-[#1a2d50] text-center">
                        <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                          {div}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 border-b border-[#1a2d50] text-center border-l border-[#1a2d50]">
                      <span className="font-cond text-[10px] font-black tracking-[.12em] text-white uppercase">
                        Total
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {demandTimes.map((timeStr, i) => {
                    const rowTotal = demandDivs.reduce(
                      (acc, d) => {
                        const cell = demandMap.get(`${timeStr}|${d}`)
                        return {
                          adult: acc.adult + (cell?.adultNeed ?? 0),
                          youth: acc.youth + (cell?.youthNeed ?? 0),
                          games: acc.games + (cell?.games ?? 0),
                        }
                      },
                      { adult: 0, youth: 0, games: 0 }
                    )
                    return (
                      <tr key={timeStr} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                        <Td>
                          <span className="font-mono text-[12px] font-bold text-white">
                            {formatTime(timeStr)}
                          </span>
                        </Td>
                        {demandDivs.map((div) => {
                          const cell = demandMap.get(`${timeStr}|${div}`)
                          if (!cell) {
                            return (
                              <td
                                key={div}
                                className="px-2 py-2 text-center border-l border-[#0d1e3a]"
                              >
                                <span className="font-mono text-[10px] text-[#1a2d50]">—</span>
                              </td>
                            )
                          }
                          return (
                            <td
                              key={div}
                              className="px-2 py-1.5 text-center border-l border-[#0d1e3a]"
                            >
                              <div className="flex items-center justify-center gap-2">
                                <span
                                  className="font-mono text-[12px] font-bold text-[#60a5fa]"
                                  title={`Adult refs needed`}
                                >
                                  {cell.adultNeed}
                                  <span className="font-cond text-[8px] ml-0.5 text-[#60a5fa]/50">
                                    A
                                  </span>
                                </span>
                                <span
                                  className="font-mono text-[12px] font-bold text-[#34d399]"
                                  title={`Youth refs needed`}
                                >
                                  {cell.youthNeed}
                                  <span className="font-cond text-[8px] ml-0.5 text-[#34d399]/50">
                                    Y
                                  </span>
                                </span>
                              </div>
                              <div className="font-cond text-[8px] text-muted mt-0.5">
                                {cell.games}g
                              </div>
                            </td>
                          )
                        })}
                        <td
                          className="px-2 py-1.5 text-center border-l border-[#1a2d50]"
                          style={{ background: 'rgba(11,61,145,0.15)' }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-[#60a5fa]">
                              {rowTotal.adult}
                              <span className="font-cond text-[8px] ml-0.5 text-[#60a5fa]/50">
                                A
                              </span>
                            </span>
                            <span className="font-mono text-[12px] font-bold text-[#34d399]">
                              {rowTotal.youth}
                              <span className="font-cond text-[8px] ml-0.5 text-[#34d399]/50">
                                Y
                              </span>
                            </span>
                          </div>
                          <div className="font-cond text-[8px] text-muted mt-0.5">
                            {rowTotal.games}g
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr style={{ background: '#081428', borderTop: '2px solid #1a2d50' }}>
                    <Td>
                      <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
                        Total
                      </span>
                    </Td>
                    {demandDivs.map((div) => (
                      <td key={div} className="px-2 py-1.5 text-center border-l border-[#0d1e3a]">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-[12px] font-bold text-[#60a5fa]">
                            {divTotals[div].adult}
                            <span className="font-cond text-[8px] ml-0.5 text-[#60a5fa]/50">A</span>
                          </span>
                          <span className="font-mono text-[12px] font-bold text-[#34d399]">
                            {divTotals[div].youth}
                            <span className="font-cond text-[8px] ml-0.5 text-[#34d399]/50">Y</span>
                          </span>
                        </div>
                        <div className="font-cond text-[8px] text-muted mt-0.5">
                          {divTotals[div].games}g
                        </div>
                      </td>
                    ))}
                    <td
                      className="px-2 py-1.5 text-center border-l border-[#1a2d50]"
                      style={{ background: 'rgba(11,61,145,0.2)' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-[13px] font-bold text-[#60a5fa]">
                          {grandTotal.adult}
                          <span className="font-cond text-[8px] ml-0.5 text-[#60a5fa]/50">A</span>
                        </span>
                        <span className="font-mono text-[13px] font-bold text-[#34d399]">
                          {grandTotal.youth}
                          <span className="font-cond text-[8px] ml-0.5 text-[#34d399]/50">Y</span>
                        </span>
                      </div>
                      <div className="font-cond text-[8px] text-muted mt-0.5">
                        {grandTotal.games}g
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* ── Ref Grid: Time (rows) × Field (columns) ── */}
      {activeFieldIds.length > 0 && allTimes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-sm" style={{ background: '#0B3D91' }} />
            <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
              Ref Assignments by Field &amp; Time
            </span>
          </div>
          <div className="rounded-lg overflow-auto border border-[#1a2d50]">
            <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr style={{ background: '#081428' }}>
                  <Th>Time</Th>
                  {activeFieldIds.map((field) => {
                    // Extract field number from name (e.g., "Field 1" → "1")
                    const fieldNum = field.name.replace(/[^0-9]/g, '') || field.name
                    return (
                      <th
                        key={field.id}
                        className="px-3 py-2 border-b border-[#1a2d50] text-center"
                        colSpan={1}
                      >
                        <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                          Field {fieldNum}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {allTimes.map((timeStr, i) => (
                  <tr key={timeStr} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                    <Td>
                      <span className="font-mono text-[12px] font-bold text-white">
                        {formatTime(timeStr)}
                      </span>
                    </Td>
                    {activeFieldIds.map((field) => {
                      const fieldSlots = schedule[field.id] ?? {}
                      const slot = fieldSlots[timeStr] ?? { adult: [], youth: [], divisions: [] }
                      const gameCount = gamesByFieldTime[field.id]?.[timeStr] ?? 0

                      if (gameCount === 0) {
                        return (
                          <td
                            key={field.id}
                            className="px-2 py-2 text-center border-l border-[#0d1e3a]"
                          >
                            <span className="font-mono text-[10px] text-[#1a2d50]">—</span>
                          </td>
                        )
                      }

                      // Sum expected refs across all games in this slot
                      let needAdult = 0,
                        needYouth = 0
                      for (const div of slot.divisions) {
                        const exp = getExpected(div, refRules)
                        needAdult += exp.adult
                        needYouth += exp.youth
                      }
                      const shortAdult = slot.adult.length < needAdult
                      const shortYouth = slot.youth.length < needYouth
                      const allGood = !shortAdult && !shortYouth && needAdult + needYouth > 0

                      return (
                        <td
                          key={field.id}
                          className="px-2 py-1.5 text-center border-l border-[#0d1e3a]"
                          style={{
                            background: allGood
                              ? 'rgba(52,211,153,0.05)'
                              : shortAdult || shortYouth
                                ? 'rgba(214,40,40,0.06)'
                                : undefined,
                          }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            {/* Adult refs: have/need */}
                            <span
                              className={cn(
                                'font-mono text-[12px] font-bold',
                                shortAdult ? 'text-red-400' : 'text-[#60a5fa]'
                              )}
                              title={`Adult refs: ${slot.adult.length} assigned / ${needAdult} needed`}
                            >
                              {slot.adult.length}/{needAdult}
                              <span className="font-cond text-[8px] ml-0.5 text-[#60a5fa]/50">
                                A
                              </span>
                            </span>
                            {/* Youth refs: have/need */}
                            <span
                              className={cn(
                                'font-mono text-[12px] font-bold',
                                shortYouth ? 'text-red-400' : 'text-[#34d399]'
                              )}
                              title={`Youth refs: ${slot.youth.length} assigned / ${needYouth} needed`}
                            >
                              {slot.youth.length}/{needYouth}
                              <span className="font-cond text-[8px] ml-0.5 text-[#34d399]/50">
                                Y
                              </span>
                            </span>
                          </div>
                          {/* Division tag */}
                          <div className="font-cond text-[8px] text-muted mt-0.5">
                            {[...new Set(slot.divisions)].join(', ')}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 flex-wrap">
        <span className="font-cond text-[9px] text-muted">Grade Level:</span>
        <span
          className="flex items-center gap-1.5 font-cond text-[10px] font-bold"
          style={{ color: '#60a5fa' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
          Adult (Grade 7 and below)
        </span>
        <span
          className="flex items-center gap-1.5 font-cond text-[10px] font-bold"
          style={{ color: '#34d399' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
          Youth (Grade 8)
        </span>
        <span className="flex items-center gap-1.5 font-cond text-[10px] font-bold text-red-400">
          ▲ = below required count · configure in Settings → Advanced
        </span>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRecords(games: Game[], teams: Team[]): Record<number, TeamRecord> {
  const records: Record<number, TeamRecord> = {}

  function getOrCreate(teamId: number, teamsArr: Team[]): TeamRecord {
    if (!records[teamId]) {
      const team = teamsArr.find((t) => t.id === teamId)
      records[teamId] = {
        teamId,
        name: team?.name ?? `Team ${teamId}`,
        w: 0,
        l: 0,
        t: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
      }
    }
    return records[teamId]
  }

  for (const g of games) {
    const home = getOrCreate(g.home_team_id, teams)
    const away = getOrCreate(g.away_team_id, teams)

    home.gf += g.home_score
    home.ga += g.away_score
    away.gf += g.away_score
    away.ga += g.home_score

    if (g.home_score > g.away_score) {
      home.w++
      away.l++
      home.pts += 3
    } else if (g.away_score > g.home_score) {
      away.w++
      home.l++
      away.pts += 3
    } else {
      home.t++
      away.t++
      home.pts += 1
      away.pts += 1
    }
  }

  for (const r of Object.values(records)) {
    r.gd = r.gf - r.ga
  }

  return records
}

function winPct(r: TeamRecord) {
  const gp = r.w + r.l + r.t
  if (gp === 0) return 0
  return (r.w + r.t * 0.5) / gp
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}

function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(`1970-01-01T${t}`)
  if (isNaN(d.getTime())) return t
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── Small components ──────────────────────────────────────────────────────────

function Th({
  children,
  align = 'left',
}: {
  children?: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <th
      className={cn(
        'font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase px-3 py-2',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right'
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
}: {
  children?: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <td
      className={cn(
        'font-cond text-[12px] text-[#8a9ec0] px-3 py-2',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right'
      )}
    >
      {children}
    </td>
  )
}

function StatCell({
  children,
  highlight,
  dim,
}: {
  children: React.ReactNode
  highlight?: boolean
  dim?: boolean
}) {
  return (
    <td className="text-center px-3 py-2">
      <span
        className={cn(
          'font-mono text-[12px]',
          highlight ? 'text-emerald-400 font-bold' : dim ? 'text-red-400' : 'text-[#8a9ec0]'
        )}
      >
        {children}
      </span>
    </td>
  )
}

function TeamName({ name, win }: { name: string; win: boolean }) {
  return (
    <span className={cn('font-cond text-[13px] font-bold', win ? 'text-white' : 'text-[#5a6e9a]')}>
      {win && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 mb-0.5" />
      )}
      {name}
    </span>
  )
}

// ── Incidents Report ────────────────────────────────────────────────────────

function IncidentsReportView({
  incidents,
  medicalIncidents,
  eventDates,
  fields,
}: {
  incidents: Incident[]
  medicalIncidents: MedicalIncident[]
  eventDates: { id: number; date: string; label: string }[]
  fields: { id: number; name: string }[]
}) {
  const [filter, setFilter] = useState<'all' | 'incidents' | 'medical'>('all')

  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f.name]))

  const sortedIncidents = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
    [incidents]
  )
  const sortedMedical = useMemo(
    () => [...medicalIncidents].sort((a, b) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime()),
    [medicalIncidents]
  )

  const incidentCount = incidents.length
  const medicalCount = medicalIncidents.length
  const resolvedMedical = medicalIncidents.filter((m) => m.status === 'Resolved').length
  const activeMedical = medicalCount - resolvedMedical
  const injuryIncidents = incidents.filter((i) => i.type === 'Player Injury').length
  const ejections = incidents.filter((i) => i.type === 'Ejection').length

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL INCIDENTS', value: incidentCount, color: '#f59e0b' },
          { label: 'MEDICAL DISPATCHES', value: medicalCount, color: '#60a5fa' },
          { label: 'ACTIVE MEDICAL', value: activeMedical, color: activeMedical > 0 ? '#ef4444' : '#34d399' },
          { label: 'EJECTIONS', value: ejections, color: ejections > 0 ? '#ef4444' : '#8a9ec0' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border px-4 py-3 bg-surface-card"
          >
            <div className="font-cond text-[9px] font-black tracking-[.15em] text-muted uppercase">
              {s.label}
            </div>
            <div className="font-mono text-[28px] font-bold mt-0.5" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'incidents', 'medical'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors',
              filter === f
                ? 'bg-navy border-blue-500 text-white'
                : 'bg-surface border-border text-muted hover:text-white'
            )}
          >
            {f === 'all' ? `ALL (${incidentCount + medicalCount})` : f === 'incidents' ? `INCIDENTS (${incidentCount})` : `MEDICAL (${medicalCount})`}
          </button>
        ))}
      </div>

      {/* Incidents list */}
      {(filter === 'all' || filter === 'incidents') && sortedIncidents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-sm bg-yellow-500" />
            <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
              Incidents ({incidentCount})
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-card">
                  <Th>Time</Th>
                  <Th>Type</Th>
                  <Th>Field</Th>
                  <Th>Team</Th>
                  <Th>Person</Th>
                  <Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {sortedIncidents.map((inc, i) => {
                  const isAlert = ['Player Injury', 'Ejection'].includes(inc.type)
                  return (
                    <tr key={inc.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-card)' }}>
                      <Td>
                        <span className="font-mono text-[11px] text-white">
                          {new Date(inc.occurred_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </span>
                      </Td>
                      <Td>
                        <span className={cn(
                          'font-cond text-[10px] font-bold px-2 py-0.5 rounded',
                          isAlert ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
                        )}>
                          {inc.type.toUpperCase()}
                        </span>
                      </Td>
                      <Td><span className="text-[11px] text-muted">{inc.field?.name ?? fieldMap[inc.field_id ?? 0] ?? '—'}</span></Td>
                      <Td><span className="text-[11px] text-muted">{inc.team?.name ?? '—'}</span></Td>
                      <Td><span className="text-[11px] text-white font-bold">{inc.person_involved ?? '—'}</span></Td>
                      <Td><span className="text-[11px] text-gray-300">{inc.description}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Medical dispatches list */}
      {(filter === 'all' || filter === 'medical') && sortedMedical.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-sm bg-blue-500" />
            <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
              Medical Dispatches ({medicalCount})
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-card">
                  <Th>Time</Th>
                  <Th>Status</Th>
                  <Th>Player</Th>
                  <Th>Team</Th>
                  <Th>Injury</Th>
                  <Th>Field</Th>
                  <Th>Trainer</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {sortedMedical.map((m, i) => {
                  const statusColor =
                    m.status === 'Resolved' ? 'text-green-400 bg-green-900/30'
                      : m.status === 'Dispatched' ? 'text-red-400 bg-red-900/30'
                        : m.status === 'Transported' ? 'text-orange-400 bg-orange-900/30'
                          : 'text-blue-400 bg-blue-900/30'
                  return (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-card)' }}>
                      <Td>
                        <span className="font-mono text-[11px] text-white">
                          {new Date(m.dispatched_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </span>
                      </Td>
                      <Td>
                        <span className={cn('font-cond text-[10px] font-bold px-2 py-0.5 rounded', statusColor)}>
                          {m.status.toUpperCase()}
                        </span>
                      </Td>
                      <Td><span className="text-[11px] text-white font-bold">{m.player_name || '—'}</span></Td>
                      <Td><span className="text-[11px] text-muted">{m.team_name ?? '—'}</span></Td>
                      <Td><span className="text-[11px] text-muted">{m.injury_type}</span></Td>
                      <Td><span className="text-[11px] text-muted">{m.field?.name ?? fieldMap[m.field_id ?? 0] ?? '—'}</span></Td>
                      <Td><span className="text-[11px] text-white">{m.trainer_name}</span></Td>
                      <Td><span className="text-[11px] text-gray-300">{m.notes ?? '—'}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {incidentCount + medicalCount === 0 && (
        <Empty message="No incidents or medical dispatches logged." />
      )}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted font-cond text-[13px] tracking-wide">
      {message}
    </div>
  )
}
