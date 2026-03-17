'use client'

import React, { useState, useMemo } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Game, Team } from '@/types'

type SubTab = 'results' | 'standings' | 'leaders'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'results',   label: 'RESULTS' },
  { id: 'standings', label: 'STANDINGS' },
  { id: 'leaders',   label: 'STAT LEADERS' },
]

export function ReportsTab() {
  const { state } = useApp()
  const [sub, setSub] = useState<SubTab>('results')

  const finalGames = useMemo(
    () => state.games.filter(g => g.status === 'Final'),
    [state.games]
  )

  const divisions = useMemo(() => {
    const divs = [...new Set(state.games.map(g => g.division))].sort()
    return ['ALL', ...divs]
  }, [state.games])

  const [divFilter, setDivFilter] = useState('ALL')

  return (
    <div className="p-4 max-w-5xl">
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
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid #1a2d50' }}>
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
      </div>

      {sub === 'results'   && <ResultsView   games={finalGames} teams={state.teams} divFilter={divFilter} />}
      {sub === 'standings' && <StandingsView games={finalGames} teams={state.teams} divFilter={divFilter} />}
      {sub === 'leaders'   && <LeadersView   games={finalGames} teams={state.teams} divFilter={divFilter} />}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ games, teams, divFilter }: { games: Game[]; teams: Team[]; divFilter: string }) {
  const filtered = divFilter === 'ALL' ? games : games.filter(g => g.division === divFilter)

  if (filtered.length === 0) {
    return <Empty message="No final games yet." />
  }

  // Group by division
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
  const allGames = games  // all final games passed in
  const filtered = divFilter === 'ALL' ? allGames : allGames.filter(g => g.division === divFilter)

  // Build records
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
          const maxVal = ascending
            ? Math.max(...rows.map(value)) || 1
            : Math.max(...rows.map(value)) || 1
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
