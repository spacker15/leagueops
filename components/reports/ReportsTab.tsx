'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { createClient } from '@/supabase/client'
import { getAllGamesByEvent } from '@/lib/db'
import type { Game, Team, Referee } from '@/types'

type SubTab = 'results' | 'standings' | 'leaders' | 'matchups' | 'ref-schedule'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'results',      label: 'RESULTS' },
  { id: 'standings',    label: 'STANDINGS' },
  { id: 'leaders',      label: 'STAT LEADERS' },
  { id: 'matchups',     label: 'MATCHUPS' },
  { id: 'ref-schedule', label: 'REF SCHEDULE' },
]

export function ReportsTab() {
  const { state } = useApp()
  const [sub, setSub] = useState<SubTab>('results')
  const [allGames, setAllGames] = useState<Game[]>([])

  useEffect(() => {
    if (!state.event?.id) return
    getAllGamesByEvent(state.event.id).then(setAllGames)
  }, [state.event?.id, state.games]) // re-fetch when state.games changes (scores/status updated)

  const finalGames = useMemo(
    () => allGames.filter(g => g.status === 'Final'),
    [allGames]
  )

  const divisions = useMemo(() => {
    const divs = [...new Set(allGames.map(g => g.division))].sort()
    return ['ALL', ...divs]
  }, [allGames])

  const [divFilter, setDivFilter] = useState('ALL')

  const showDivFilter = sub !== 'ref-schedule'

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
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              'font-cond text-[11px] font-black tracking-[.12em] px-4 py-2 transition-colors relative',
              sub === t.id ? 'text-white' : 'text-[#5a6e9a] hover:text-white'
            )}
          >
            {t.label}
            {sub === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red" />
            )}
          </button>
        ))}

        {/* Division filter */}
        {showDivFilter && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">Division</span>
            <select
              value={divFilter}
              onChange={e => setDivFilter(e.target.value)}
              className="bg-[#081428] border border-[#1a2d50] text-white px-2 py-1 rounded text-[11px] font-cond font-bold outline-none focus:border-blue-400"
            >
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {sub === 'results'      && <ResultsView   games={finalGames} teams={state.teams} divFilter={divFilter} />}
      {sub === 'standings'    && <StandingsView games={finalGames} teams={state.teams} divFilter={divFilter} />}
      {sub === 'leaders'      && <LeadersView   games={finalGames} teams={state.teams} divFilter={divFilter} />}
      {sub === 'matchups'     && <MatchupsView  teams={state.teams} eventId={state.event?.id ?? null} divFilter={divFilter} />}
      {sub === 'ref-schedule' && <RefScheduleView games={allGames} fields={state.fields} referees={state.referees} eventId={state.event?.id ?? null} />}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ games, teams, divFilter }: { games: Game[]; teams: Team[]; divFilter: string }) {
  const filtered = divFilter === 'ALL' ? games : games.filter(g => g.division === divFilter)

  if (filtered.length === 0) {
    return <Empty message="No final games yet." />
  }

  const byDiv = groupBy(filtered, g => g.division)

  return (
    <div className="space-y-5">
      {Object.entries(byDiv).sort(([a], [b]) => a.localeCompare(b)).map(([div, divGames]) => (
        <div key={div}>
          <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-2">{div}</div>
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
                    <tr key={g.id}
                      style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                      <Td>
                        <TeamName name={g.home_team?.name ?? `Team ${g.home_team_id}`} win={homeWin} />
                      </Td>
                      <Td align="center">
                        <span className="font-mono text-[15px] font-bold text-white tracking-wider">
                          {g.home_score} – {g.away_score}
                        </span>
                      </Td>
                      <Td>
                        <TeamName name={g.away_team?.name ?? `Team ${g.away_team_id}`} win={awayWin} />
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

function StandingsView({ games, teams, divFilter }: { games: Game[]; teams: Team[]; divFilter: string }) {
  const allGames = games
  const filtered = divFilter === 'ALL' ? allGames : allGames.filter(g => g.division === divFilter)

  const records = buildRecords(filtered, teams)
  const byDiv = groupBy(Object.values(records), r => {
    const team = teams.find(t => t.id === r.teamId)
    return team?.division ?? 'Unknown'
  })

  if (Object.keys(records).length === 0) {
    return <Empty message="No final games to build standings from." />
  }

  return (
    <div className="space-y-5">
      {Object.entries(byDiv).sort(([a], [b]) => a.localeCompare(b)).map(([div, rows]) => {
        const sorted = [...rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        return (
          <div key={div}>
            <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-2">{div}</div>
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
                    <tr key={r.teamId}
                      style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                      <Td>
                        <span className="font-mono text-[12px] text-muted">{i + 1}</span>
                      </Td>
                      <Td>
                        <span className="font-cond text-[13px] font-bold text-white">{r.name}</span>
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
                        <span className="font-mono text-[13px] font-bold text-white">{r.pts}</span>
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

function LeadersView({ games, teams, divFilter }: { games: Game[]; teams: Team[]; divFilter: string }) {
  const filtered = divFilter === 'ALL' ? games : games.filter(g => g.division === divFilter)
  const records = buildRecords(filtered, teams)
  const rows = Object.values(records)

  if (rows.length === 0) {
    return <Empty message="No final games for stat leaders." />
  }

  const topOffense   = [...rows].sort((a, b) => b.gf - a.gf).slice(0, 8)
  const topDefense   = [...rows].filter(r => r.ga >= 0).sort((a, b) => a.ga - b.ga).slice(0, 8)
  const topWinPct    = [...rows].filter(r => r.w + r.l + r.t > 0)
    .sort((a, b) => winPct(b) - winPct(a))
    .slice(0, 8)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <LeaderBoard title="TOP OFFENSE" subtitle="Goals For" rows={topOffense}
        value={r => r.gf} valueLabel="GF" />
      <LeaderBoard title="TOP DEFENSE" subtitle="Fewest Goals Against" rows={topDefense}
        value={r => r.ga} valueLabel="GA" ascending />
      <LeaderBoard title="WIN %" subtitle="Min 1 game played" rows={topWinPct}
        value={r => Math.round(winPct(r) * 100)} valueLabel="W%" />
    </div>
  )
}

function LeaderBoard({ title, subtitle, rows, value, valueLabel, ascending = false }: {
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
          const barPct = ascending
            ? (1 - val / maxVal) * 100
            : (val / maxVal) * 100

          return (
            <div key={r.teamId} className="flex items-center gap-3 px-4 py-2"
              style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
              <span className="font-mono text-[11px] text-muted w-4 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-cond text-[12px] font-bold text-white truncate">{r.name}</div>
                <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: '#1a2d50' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${barPct}%`, background: i === 0 ? '#D62828' : '#0B3D91' }} />
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

function MatchupsView({ teams, eventId, divFilter }: {
  teams: Team[]
  eventId: number | null
  divFilter: string
}) {
  const [allGames, setAllGames] = useState<AllGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId) { setLoading(false); return }
    const sb = createClient()
    sb.from('games')
      .select('id, home_team_id, away_team_id, division')
      .eq('event_id', eventId)
      .then(({ data }) => {
        setAllGames((data as AllGame[]) ?? [])
        setLoading(false)
      })
  }, [eventId])

  const filteredTeams = useMemo(() => {
    if (divFilter === 'ALL') return [...teams].sort((a, b) => a.name.localeCompare(b.name))
    return teams.filter(t => t.division === divFilter).sort((a, b) => a.name.localeCompare(b.name))
  }, [teams, divFilter])

  const filteredGames = useMemo(() => {
    if (divFilter === 'ALL') return allGames
    return allGames.filter(g => g.division === divFilter)
  }, [allGames, divFilter])

  // Build matrix: matrix[rowTeamId][colTeamId] = count
  const matrix = useMemo(() => {
    const m: Record<number, Record<number, number>> = {}
    for (const g of filteredGames) {
      if (!m[g.home_team_id]) m[g.home_team_id] = {}
      if (!m[g.away_team_id]) m[g.away_team_id] = {}
      m[g.home_team_id][g.away_team_id] = (m[g.home_team_id][g.away_team_id] ?? 0) + 1
      m[g.away_team_id][g.home_team_id] = (m[g.away_team_id][g.home_team_id] ?? 0) + 1
    }
    return m
  }, [filteredGames])

  if (loading) return <Empty message="Loading matchup data…" />
  if (filteredTeams.length === 0) return <Empty message="No teams found for this division." />

  const maxCount = Math.max(1, ...filteredTeams.flatMap(row =>
    filteredTeams.map(col => row.id !== col.id ? (matrix[row.id]?.[col.id] ?? 0) : 0)
  ))

  return (
    <div>
      <div className="font-cond text-[10px] font-black tracking-[.15em] text-muted uppercase mb-3">
        Games Played Between Teams · {filteredGames.length} total games
      </div>
      <div className="overflow-auto rounded-lg border border-[#1a2d50]">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr style={{ background: '#081428' }}>
              {/* Top-left corner cell */}
              <th className="px-3 py-2 border-r border-b border-[#1a2d50] sticky left-0 z-10" style={{ background: '#081428', minWidth: 140 }}>
                <span className="font-cond text-[9px] font-black tracking-[.12em] text-muted uppercase">
                  vs →
                </span>
              </th>
              {filteredTeams.map(col => (
                <th key={col.id} className="px-2 py-2 border-b border-[#1a2d50]" style={{ minWidth: 64 }}>
                  <div
                    className="font-cond text-[10px] font-black text-[#8a9ec0] whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 100 }}
                    title={col.name}
                  >
                    {col.name.length > 14 ? col.name.slice(0, 13) + '…' : col.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((row, ri) => (
              <tr key={row.id} style={{ background: ri % 2 === 0 ? '#050f20' : '#030c1a' }}>
                {/* Row header */}
                <td
                  className="px-3 py-1.5 border-r border-[#1a2d50] sticky left-0 z-10"
                  style={{ background: ri % 2 === 0 ? '#050f20' : '#030c1a' }}
                >
                  <span className="font-cond text-[11px] font-bold text-white whitespace-nowrap" title={row.name}>
                    {row.name.length > 18 ? row.name.slice(0, 17) + '…' : row.name}
                  </span>
                  <span className="ml-1.5 font-cond text-[9px] text-muted">{row.division}</span>
                </td>
                {/* Matrix cells */}
                {filteredTeams.map(col => {
                  const isSelf = row.id === col.id
                  const count = isSelf ? null : (matrix[row.id]?.[col.id] ?? 0)
                  const intensity = isSelf ? 0 : (count ?? 0) / maxCount

                  return (
                    <td key={col.id} className="text-center px-1 py-1.5 border-[#1a2d50]"
                      style={{ borderLeft: '1px solid #0d1e3a' }}>
                      {isSelf ? (
                        <div className="w-8 h-6 mx-auto rounded"
                          style={{ background: '#0d1e3a' }} />
                      ) : count === 0 ? (
                        <span className="font-mono text-[12px] text-[#1a2d50]">—</span>
                      ) : (
                        <div
                          className="w-8 h-6 mx-auto rounded flex items-center justify-center"
                          style={{
                            background: `rgba(214,40,40,${0.15 + intensity * 0.7})`,
                            border: `1px solid rgba(214,40,40,${0.3 + intensity * 0.5})`,
                          }}
                        >
                          <span className="font-mono text-[13px] font-bold text-white">{count}</span>
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
      <div className="flex items-center gap-4 mt-2">
        <span className="font-cond text-[9px] text-muted tracking-wide">
          Cell = number of times teams have faced each other (home + away combined)
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="font-cond text-[9px] text-muted">0</span>
          {[0.2, 0.5, 0.8, 1.0].map(v => (
            <div key={v} className="w-4 h-4 rounded"
              style={{ background: `rgba(214,40,40,${0.15 + v * 0.7})` }} />
          ))}
          <span className="font-cond text-[9px] text-muted">{maxCount}</span>
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
  // Grade 8 = Youth entry-level; Grade 7 and below = Adult
  const lvl = gradeLevel?.toLowerCase() ?? ''
  if (lvl.includes('youth')) return true
  const num = parseInt(gradeLevel.replace(/\D/g, ''))
  return !isNaN(num) && num >= 8
}

function hhLabel(hour: number): string {
  if (hour === 0)  return '12:00 AM'
  if (hour < 12)  return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

function RefScheduleView({ games, fields, referees, eventId }: {
  games: Game[]
  fields: { id: number; name: string }[]
  referees: Referee[]
  eventId: number | null
}) {
  const [assignments, setAssignments] = useState<RefAssignmentRow[]>([])
  const [refRules, setRefRules] = useState<RefRules>({
    U8: { adult: 0, youth: 2 }, U10: { adult: 1, youth: 1 }, default: { adult: 2, youth: 0 },
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId) { setLoading(false); return }
    const sb = createClient()
    // Fetch ref_requirements from event config
    sb.from('events').select('ref_requirements').eq('id', eventId).single()
      .then(({ data }) => {
        if (data && (data as any).ref_requirements) {
          setRefRules((data as any).ref_requirements)
        }
      })
    if (games.length === 0) { setLoading(false); return }
    const gameIds = games.map(g => g.id)
    sb.from('ref_assignments')
      .select('id, game_id, referee_id, role, referee:referees(id, name, grade_level)')
      .in('game_id', gameIds)
      .then(({ data }) => {
        setAssignments((data as unknown as RefAssignmentRow[]) ?? [])
        setLoading(false)
      })
  }, [eventId, games])

  // Build: fieldId → hour → { adult: RefAssignmentRow[], youth: RefAssignmentRow[], divisions: string[] }
  const schedule = useMemo(() => {
    type Slot = { adult: RefAssignmentRow[]; youth: RefAssignmentRow[]; divisions: string[] }
    const byField: Record<number, Record<number, Slot>> = {}

    // Index games by id
    const gameById: Record<number, Game> = {}
    for (const g of games) gameById[g.id] = g

    // Collect divisions per field/hour slot (from games, not assignments)
    for (const g of games) {
      const hour = g.scheduled_time ? parseInt(g.scheduled_time.split(':')[0]) : -1
      if (!byField[g.field_id]) byField[g.field_id] = {}
      if (!byField[g.field_id][hour]) byField[g.field_id][hour] = { adult: [], youth: [], divisions: [] }
      byField[g.field_id][hour].divisions.push(g.division)
    }

    for (const a of assignments) {
      const game = gameById[a.game_id]
      if (!game) continue
      const fieldId = game.field_id
      const hour = game.scheduled_time ? parseInt(game.scheduled_time.split(':')[0]) : -1
      if (!byField[fieldId]) byField[fieldId] = {}
      if (!byField[fieldId][hour]) byField[fieldId][hour] = { adult: [], youth: [], divisions: [] }
      const slot = byField[fieldId][hour]
      if (a.referee && isYouthRef(a.referee.grade_level)) {
        slot.youth.push(a)
      } else {
        slot.adult.push(a)
      }
    }
    return byField
  }, [assignments, games])

  // Collect all unique hours across all fields
  const allHours = useMemo(() => {
    const hrs = new Set<number>()
    for (const g of games) {
      if (g.scheduled_time) hrs.add(parseInt(g.scheduled_time.split(':')[0]))
    }
    return [...hrs].sort((a, b) => a - b)
  }, [games])

  // Fields that have at least one game
  const activeFieldIds = useMemo(() => {
    const ids = new Set(games.map(g => g.field_id))
    return fields.filter(f => ids.has(f.id))
  }, [games, fields])

  if (loading) return <Empty message="Loading ref schedule…" />
  if (games.length === 0) return <Empty message="No games scheduled for today." />

  // Summarize unassigned games per field/hour
  const gamesByFieldHour: Record<number, Record<number, number>> = {}
  for (const g of games) {
    const hour = g.scheduled_time ? parseInt(g.scheduled_time.split(':')[0]) : -1
    if (!gamesByFieldHour[g.field_id]) gamesByFieldHour[g.field_id] = {}
    gamesByFieldHour[g.field_id][hour] = (gamesByFieldHour[g.field_id][hour] ?? 0) + 1
  }

  const totalAssigned = assignments.length
  const totalAdult = assignments.filter(a => a.referee && !isYouthRef(a.referee.grade_level)).length
  const totalYouth = assignments.filter(a => a.referee && isYouthRef(a.referee.grade_level)).length

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'TOTAL ASSIGNED', value: totalAssigned, color: '#8a9ec0' },
          { label: 'ADULT REFS',     value: totalAdult,    color: '#60a5fa' },
          { label: 'YOUTH REFS',     value: totalYouth,    color: '#34d399' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-[#1a2d50] px-4 py-3" style={{ background: '#081428' }}>
            <div className="font-cond text-[9px] font-black tracking-[.15em] text-muted uppercase">{s.label}</div>
            <div className="font-mono text-[28px] font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Per-field tables */}
      {activeFieldIds.map(field => {
        const fieldSlots = schedule[field.id] ?? {}
        const fieldGames = gamesByFieldHour[field.id] ?? {}

        return (
          <div key={field.id}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 rounded-sm" style={{ background: '#0B3D91' }} />
              <span className="font-cond text-[11px] font-black tracking-[.12em] text-white uppercase">
                {field.name}
              </span>
            </div>
            <div className="rounded-lg overflow-hidden border border-[#1a2d50]">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#081428' }}>
                    <Th>Hour</Th>
                    <Th align="center">Games</Th>
                    <Th align="center">
                      <span style={{ color: '#60a5fa' }}>Adult</span>
                      <span className="text-muted"> Need</span>
                    </Th>
                    <Th align="center">
                      <span style={{ color: '#60a5fa' }}>Adult</span>
                      <span className="text-muted"> Have</span>
                    </Th>
                    <Th align="center">
                      <span style={{ color: '#34d399' }}>Youth</span>
                      <span className="text-muted"> Need</span>
                    </Th>
                    <Th align="center">
                      <span style={{ color: '#34d399' }}>Youth</span>
                      <span className="text-muted"> Have</span>
                    </Th>
                    <Th>Assigned Refs</Th>
                  </tr>
                </thead>
                <tbody>
                  {allHours.filter(h => (fieldGames[h] ?? 0) > 0).map((hour, i) => {
                    const slot = fieldSlots[hour] ?? { adult: [], youth: [], divisions: [] }
                    const gameCount = fieldGames[hour] ?? 0
                    const allRefs = [...slot.adult, ...slot.youth]

                    // Sum expected refs across all games in this slot
                    const divs = slot.divisions
                    let needAdult = 0, needYouth = 0
                    for (const div of divs) {
                      const exp = getExpected(div, refRules)
                      needAdult += exp.adult
                      needYouth += exp.youth
                    }
                    const shortAdult = slot.adult.length < needAdult
                    const shortYouth = slot.youth.length < needYouth

                    return (
                      <tr key={hour} style={{ background: i % 2 === 0 ? '#050f20' : '#030c1a' }}>
                        <Td>
                          <span className="font-mono text-[12px] font-bold text-white">{hhLabel(hour)}</span>
                        </Td>
                        <Td align="center">
                          <span className="font-mono text-[12px] text-[#8a9ec0]">{gameCount}</span>
                        </Td>
                        {/* Adult Need */}
                        <Td align="center">
                          <span className="font-mono text-[12px] text-[#60a5fa]">{needAdult}</span>
                        </Td>
                        {/* Adult Have */}
                        <Td align="center">
                          <span className={cn(
                            'font-mono text-[13px] font-bold',
                            shortAdult ? 'text-red-400' : slot.adult.length > 0 ? 'text-[#60a5fa]' : 'text-[#1a2d50]'
                          )}>
                            {slot.adult.length}
                            {shortAdult && <span className="font-cond text-[9px] ml-0.5">▲</span>}
                          </span>
                        </Td>
                        {/* Youth Need */}
                        <Td align="center">
                          <span className="font-mono text-[12px] text-[#34d399]">{needYouth}</span>
                        </Td>
                        {/* Youth Have */}
                        <Td align="center">
                          <span className={cn(
                            'font-mono text-[13px] font-bold',
                            shortYouth ? 'text-red-400' : slot.youth.length > 0 ? 'text-[#34d399]' : 'text-[#1a2d50]'
                          )}>
                            {slot.youth.length}
                            {shortYouth && <span className="font-cond text-[9px] ml-0.5">▲</span>}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {allRefs.length === 0 ? (
                              <span className="font-cond text-[10px] text-[#1a2d50]">none assigned</span>
                            ) : allRefs.map(a => {
                              const youth = a.referee ? isYouthRef(a.referee.grade_level) : false
                              return (
                                <span
                                  key={a.id}
                                  title={a.referee?.grade_level}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-cond text-[10px] font-bold"
                                  style={{
                                    background: youth ? 'rgba(52,211,153,0.12)' : 'rgba(96,165,250,0.12)',
                                    border: `1px solid ${youth ? 'rgba(52,211,153,0.3)' : 'rgba(96,165,250,0.3)'}`,
                                    color: youth ? '#34d399' : '#60a5fa',
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: youth ? '#34d399' : '#60a5fa' }}
                                  />
                                  {a.referee?.name ?? `Ref ${a.referee_id}`}
                                </span>
                              )
                            })}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 flex-wrap">
        <span className="font-cond text-[9px] text-muted">Grade Level:</span>
        <span className="flex items-center gap-1.5 font-cond text-[10px] font-bold" style={{ color: '#60a5fa' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
          Adult (Grade 7 and below)
        </span>
        <span className="flex items-center gap-1.5 font-cond text-[10px] font-bold" style={{ color: '#34d399' }}>
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
      const team = teamsArr.find(t => t.id === teamId)
      records[teamId] = {
        teamId, name: team?.name ?? `Team ${teamId}`,
        w: 0, l: 0, t: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      }
    }
    return records[teamId]
  }

  for (const g of games) {
    const home = getOrCreate(g.home_team_id, teams)
    const away = getOrCreate(g.away_team_id, teams)

    home.gf += g.home_score; home.ga += g.away_score
    away.gf += g.away_score; away.ga += g.home_score

    if (g.home_score > g.away_score) {
      home.w++; away.l++
      home.pts += 3
    } else if (g.away_score > g.home_score) {
      away.w++; home.l++
      away.pts += 3
    } else {
      home.t++; away.t++
      home.pts += 1; away.pts += 1
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
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(`1970-01-01T${t}`)
  if (isNaN(d.getTime())) return t
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── Small components ──────────────────────────────────────────────────────────

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <th className={cn(
      'font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase px-3 py-2',
      align === 'center' && 'text-center',
      align === 'right'  && 'text-right',
    )}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <td className={cn(
      'font-cond text-[12px] text-[#8a9ec0] px-3 py-2',
      align === 'center' && 'text-center',
      align === 'right'  && 'text-right',
    )}>
      {children}
    </td>
  )
}

function StatCell({ children, highlight, dim }: { children: React.ReactNode; highlight?: boolean; dim?: boolean }) {
  return (
    <td className="text-center px-3 py-2">
      <span className={cn(
        'font-mono text-[12px]',
        highlight ? 'text-emerald-400 font-bold' : dim ? 'text-red-400' : 'text-[#8a9ec0]'
      )}>
        {children}
      </span>
    </td>
  )
}

function TeamName({ name, win }: { name: string; win: boolean }) {
  return (
    <span className={cn(
      'font-cond text-[13px] font-bold',
      win ? 'text-white' : 'text-[#5a6e9a]'
    )}>
      {win && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 mb-0.5" />}
      {name}
    </span>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted font-cond text-[13px] tracking-wide">
      {message}
    </div>
  )
}
