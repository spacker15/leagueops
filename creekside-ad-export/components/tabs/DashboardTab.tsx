'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { calcStandings, fmtDate, fmtTime, cn } from '@/lib/utils'
import { Card, SectionHeader, StatusBadge, CoverageBar, Pill } from '@/components/ui'
import * as db from '@/lib/db'
import type { VolunteerAssignment, Game } from '@/types'

const TODAY = new Date().toISOString().split('T')[0]

const SEVEN_DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return d.toISOString().split('T')[0]
})

const INCIDENT_PILL: Record<string, 'red' | 'yellow' | 'blue' | 'gray' | 'green'> = {
  Injury: 'red',
  Ejection: 'red',
  Unsportsmanlike: 'yellow',
  Equipment: 'blue',
  Weather: 'yellow',
  Other: 'gray',
}

const SEVERITY_PILL: Record<string, 'red' | 'yellow' | 'gray'> = {
  serious: 'red',
  moderate: 'yellow',
  minor: 'gray',
}

interface GameCoverage {
  game: Game
  assignments: VolunteerAssignment[]
}

export function DashboardTab() {
  const { school, sports, teams, games, incidents } = useApp()
  const [coverage, setCoverage] = useState<GameCoverage[]>([])
  const [expandedIncident, setExpandedIncident] = useState<number | null>(null)

  const todayGames = games.filter((g) => g.scheduled_date === TODAY)

  const standings = calcStandings(teams, games)

  // Group standings by sport
  const standingsBySport = sports
    .map((sport) => {
      const sportTeams = teams.filter((t) => t.sport_id === sport.id)
      const sportStandings = standings.filter((s) => sportTeams.some((t) => t.id === s.team.id))
      const nextGame = games
        .filter(
          (g) =>
            sportTeams.some((t) => t.id === g.team_id) &&
            g.scheduled_date >= TODAY &&
            g.status === 'Scheduled'
        )
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0]
      return { sport, standings: sportStandings, nextGame }
    })
    .filter((s) => s.standings.length > 0)

  const recentIncidents = incidents.slice(0, 5)

  // Load volunteer coverage for upcoming 7-day games
  useEffect(() => {
    const upcomingGames = games.filter((g) => SEVEN_DAYS.includes(g.scheduled_date))
    if (upcomingGames.length === 0) {
      setCoverage([])
      return
    }
    Promise.all(
      upcomingGames.map(async (game) => {
        const assignments = await db.getVolunteerAssignments(game.id)
        return { game, assignments }
      })
    ).then(setCoverage)
  }, [games])

  return (
    <div className="tab-content space-y-6">
      {/* Today's Games */}
      <section>
        <SectionHeader>Today&apos;s Games — {fmtDate(TODAY)}</SectionHeader>
        {todayGames.length === 0 ? (
          <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-4">
            No games today.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {todayGames.map((game) => (
              <Card key={game.id} className="p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-cond font-black text-[13px] text-white leading-tight truncate">
                      {game.home_team_name}
                    </span>
                    <span className="font-cond text-[11px] text-muted tracking-wide">
                      vs {game.away_team_name}
                    </span>
                  </div>
                  <StatusBadge status={game.status} />
                </div>
                {(game.status === 'Live' ||
                  game.status === 'Halftime' ||
                  game.status === 'Final') && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[20px] text-white">
                      {game.home_score}
                    </span>
                    <span className="text-muted text-[12px]">–</span>
                    <span className="font-mono font-bold text-[20px] text-white">
                      {game.away_score}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-muted text-[11px] font-cond">
                  {game.scheduled_time && <span>{fmtTime(game.scheduled_time)}</span>}
                  {game.location && <span className="truncate">{game.location}</span>}
                </div>
                {game.team?.sport && (
                  <span className="text-muted text-[10px] font-cond font-black tracking-widest uppercase">
                    {game.team.sport.name} · {game.team?.name}
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Season Snapshot */}
      <section>
        <SectionHeader>Season Snapshot</SectionHeader>
        {standingsBySport.length === 0 ? (
          <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-2">
            No teams configured yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {standingsBySport.map(({ sport, standings, nextGame }) => (
              <Card key={sport.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-cond font-black tracking-widest uppercase text-[11px] text-white">
                    {sport.name}
                  </span>
                  <span className="font-cond text-[10px] text-muted uppercase tracking-widest">
                    {sport.season}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {standings.map((s) => (
                    <div key={s.team.id} className="flex items-center justify-between py-1.5">
                      <span className="font-cond text-[12px] text-white truncate max-w-[120px]">
                        {s.team.name}
                      </span>
                      <span className="font-mono text-[12px] text-white shrink-0">
                        {s.wins}–{s.losses}
                        {s.ties > 0 ? `–${s.ties}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {nextGame && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="font-cond text-[10px] text-muted">
                      Next: {fmtDate(nextGame.scheduled_date)}
                      {nextGame.scheduled_time ? ` · ${fmtTime(nextGame.scheduled_time)}` : ''}
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Incidents */}
        <section>
          <SectionHeader>Recent Incidents</SectionHeader>
          {recentIncidents.length === 0 ? (
            <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-2">
              No incidents logged.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentIncidents.map((inc) => (
                <Card
                  key={inc.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors hover:border-[#2a4070]',
                    expandedIncident === inc.id && 'border-[#2a4070]'
                  )}
                  onClick={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill variant={INCIDENT_PILL[inc.type] ?? 'gray'}>{inc.type}</Pill>
                        {inc.severity && (
                          <Pill variant={SEVERITY_PILL[inc.severity] ?? 'gray'}>
                            {inc.severity}
                          </Pill>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-white text-[12px] font-cond',
                          expandedIncident !== inc.id && 'truncate'
                        )}
                      >
                        {inc.description}
                      </p>
                      <div className="flex items-center gap-3 text-muted text-[10px] font-cond font-black tracking-widest uppercase flex-wrap">
                        {inc.team && <span>{inc.team.name}</span>}
                        {inc.player && <span>{inc.player.name}</span>}
                        <span>{fmtDate(inc.occurred_at.split('T')[0])}</span>
                        {inc.occurred_at.includes('T') && (
                          <span>{fmtTime(inc.occurred_at.split('T')[1]?.slice(0, 5))}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedIncident === inc.id && inc.action_taken && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="font-cond font-black tracking-widest uppercase text-[10px] text-muted block mb-1">
                        Action Taken
                      </span>
                      <p className="text-white text-[12px] font-cond">{inc.action_taken}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Volunteer Coverage */}
        <section>
          <SectionHeader>Volunteer Coverage — Next 7 Days</SectionHeader>
          {coverage.length === 0 ? (
            <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-2">
              No upcoming games in the next 7 days.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {coverage.map(({ game, assignments }) => {
                const filled = assignments.filter((a) => a.checked_in).length
                const total = assignments.length
                return (
                  <Card key={game.id} className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-cond font-bold text-[12px] text-white truncate">
                          {game.home_team_name} vs {game.away_team_name}
                        </span>
                        <span className="font-cond text-[10px] text-muted">
                          {fmtDate(game.scheduled_date)}
                          {game.scheduled_time ? ` · ${fmtTime(game.scheduled_time)}` : ''}
                          {game.location ? ` · ${game.location}` : ''}
                        </span>
                      </div>
                    </div>
                    <CoverageBar
                      label="Volunteers Checked In"
                      value={filled}
                      total={total === 0 ? 1 : total}
                    />
                    {total === 0 && (
                      <span className="text-muted text-[10px] font-cond">
                        No volunteers assigned
                      </span>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
