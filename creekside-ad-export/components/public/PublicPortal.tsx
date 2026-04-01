'use client'

import { useEffect, useState, useMemo } from 'react'
import { cn, fmtDate, fmtTime } from '@/lib/utils'
import * as db from '@/lib/db'
import type { School, Sport, Team, Player, Game } from '@/types'

const SEASON_ORDER: Record<string, number> = { fall: 0, winter: 1, spring: 2 }

interface SportDetail {
  sport: Sport
  teams: Team[]
  games: Game[]
}

interface PublicPortalProps {
  schoolSlug?: string
  schoolId?: number
}

export function PublicPortal({ schoolSlug, schoolId: propSchoolId }: PublicPortalProps) {
  const [school, setSchool] = useState<School | null>(null)
  const [sports, setSports] = useState<Sport[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Record<number, Player[]>>({})
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null)
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      let resolvedSchool: School | null = null
      if (schoolSlug) {
        resolvedSchool = await db.getSchoolBySlug(schoolSlug)
      } else if (propSchoolId) {
        resolvedSchool = await db.getSchool(propSchoolId)
      } else {
        resolvedSchool = await db.getSchool(1)
      }
      if (!resolvedSchool) { setLoading(false); return }
      setSchool(resolvedSchool)

      const [fetchedSports, fetchedTeams, fetchedGames] = await Promise.all([
        db.getSports(resolvedSchool.id),
        db.getTeams(resolvedSchool.id),
        db.getGames(resolvedSchool.id),
      ])
      setSports(fetchedSports)
      setTeams(fetchedTeams)
      setGames(fetchedGames)
      setLoading(false)
    }
    load()
  }, [schoolSlug, propSchoolId])

  // Load players for selected sport's teams
  useEffect(() => {
    if (!selectedSportId) return
    const sportTeams = teams.filter((t) => t.sport_id === selectedSportId)
    const unloaded = sportTeams.filter((t) => !(t.id in players))
    if (unloaded.length === 0) return
    setLoadingPlayers(true)
    Promise.all(unloaded.map((t) => db.getPlayers(t.id).then((p) => ({ teamId: t.id, players: p }))))
      .then((results) => {
        setPlayers((prev) => {
          const next = { ...prev }
          for (const r of results) { next[r.teamId] = r.players }
          return next
        })
        setLoadingPlayers(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSportId, teams])

  const sportsBySeason = useMemo(() => {
    const grouped: Record<string, Sport[]> = {}
    for (const sport of sports) {
      if (!grouped[sport.season]) grouped[sport.season] = []
      grouped[sport.season].push(sport)
    }
    return Object.entries(grouped).sort(([a], [b]) => (SEASON_ORDER[a] ?? 9) - (SEASON_ORDER[b] ?? 9))
  }, [sports])

  const selectedDetail = useMemo<SportDetail | null>(() => {
    if (!selectedSportId) return null
    const sport = sports.find((s) => s.id === selectedSportId)
    if (!sport) return null
    const sportTeams = teams.filter((t) => t.sport_id === selectedSportId)
    const sportGames = games.filter((g) => sportTeams.some((t) => t.id === g.team_id))
    return { sport, teams: sportTeams, games: sportGames }
  }, [selectedSportId, sports, teams, games])

  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0B3D91] border-t-transparent rounded-full animate-spin" />
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-[#5a6e9a]">
            Loading
          </span>
        </div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-[#020810] flex items-center justify-center">
        <p className="font-cond text-[#5a6e9a] text-[14px]">School not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020810] text-white font-sans">
      {/* Header */}
      <header className="bg-[#081428] border-b border-[#1a2d50]">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#D62828] rounded-lg flex items-center justify-center shrink-0">
            <span className="font-cond font-black text-white text-[13px]">
              {school.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <h1 className="font-cond font-black tracking-widest uppercase text-[18px] text-white leading-tight">
              {school.name}
            </h1>
            {school.mascot && (
              <p className="font-cond text-[13px] text-[#5a6e9a] tracking-wide">
                {school.mascot}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-[#5a6e9a]">
              Athletics
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Sidebar: Sports list */}
        <aside className="lg:w-56 shrink-0">
          {sportsBySeason.map(([season, seasonSports]) => (
            <div key={season} className="mb-4">
              <div className="font-cond font-black tracking-widest uppercase text-[10px] text-[#5a6e9a] mb-2 px-1">
                {season.charAt(0).toUpperCase() + season.slice(1)}
              </div>
              <div className="flex flex-col gap-1">
                {seasonSports.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() =>
                      setSelectedSportId(selectedSportId === sport.id ? null : sport.id)
                    }
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg font-cond font-bold text-[12px] tracking-wide transition-colors',
                      selectedSportId === sport.id
                        ? 'bg-[#0B3D91] text-white'
                        : 'text-[#5a6e9a] hover:text-white hover:bg-white/5'
                    )}
                  >
                    {sport.name}
                    {sport.gender && (
                      <span className="ml-1 text-[10px] opacity-60">{sport.gender}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {sports.length === 0 && (
            <p className="font-cond text-[12px] text-[#5a6e9a] px-1">No sports listed.</p>
          )}
        </aside>

        {/* Main: Sport detail */}
        <main className="flex-1 min-w-0">
          {!selectedDetail ? (
            <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-8 text-center">
              <p className="font-cond font-black tracking-widest uppercase text-[13px] text-[#5a6e9a] mb-1">
                Select a Sport
              </p>
              <p className="font-cond text-[12px] text-[#5a6e9a]/70">
                Choose a sport from the list to view schedules, results, and rosters.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Sport header */}
              <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-4">
                <h2 className="font-cond font-black tracking-widest uppercase text-[16px] text-white">
                  {selectedDetail.sport.name}
                </h2>
                <p className="font-cond text-[12px] text-[#5a6e9a] mt-0.5">
                  {selectedDetail.sport.season.charAt(0).toUpperCase() + selectedDetail.sport.season.slice(1)} Season
                  {selectedDetail.sport.gender ? ` · ${selectedDetail.sport.gender}` : ''}
                  {' · '}
                  {selectedDetail.teams.length} {selectedDetail.teams.length === 1 ? 'team' : 'teams'}
                </p>
              </div>

              {/* Upcoming schedule */}
              <section>
                <div className="border-b border-[#1a2d50] pb-2 mb-3">
                  <span className="font-cond font-black tracking-widest uppercase text-[11px] text-[#5a6e9a]">
                    Upcoming Schedule
                  </span>
                </div>
                {(() => {
                  const upcoming = selectedDetail.games
                    .filter((g) => g.scheduled_date >= today && g.status !== 'Final' && g.status !== 'Cancelled')
                    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
                    .slice(0, 10)
                  return upcoming.length === 0 ? (
                    <p className="font-cond text-[12px] text-[#5a6e9a] py-2">No upcoming games.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {upcoming.map((g) => (
                        <div
                          key={g.id}
                          className="bg-[#081428] border border-[#1a2d50] rounded-xl px-4 py-3 flex items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-cond font-bold text-[13px] text-white truncate">
                              {g.home_team_name}
                              <span className="text-[#5a6e9a] mx-1.5 font-normal">vs</span>
                              {g.away_team_name}
                            </div>
                            <div className="font-cond text-[11px] text-[#5a6e9a] mt-0.5">
                              {fmtDate(g.scheduled_date)}
                              {g.scheduled_time ? ` · ${fmtTime(g.scheduled_time)}` : ''}
                              {g.location ? ` · ${g.location}` : ''}
                            </div>
                          </div>
                          <span
                            className={cn(
                              'font-cond font-black tracking-wide text-[11px] uppercase px-2.5 py-0.5 rounded-full shrink-0',
                              g.status === 'Live'
                                ? 'bg-green-900/50 text-green-400 border border-green-700/40'
                                : 'bg-blue-950/50 text-blue-300 border border-blue-800/40'
                            )}
                          >
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </section>

              {/* Recent results */}
              <section>
                <div className="border-b border-[#1a2d50] pb-2 mb-3">
                  <span className="font-cond font-black tracking-widest uppercase text-[11px] text-[#5a6e9a]">
                    Recent Results
                  </span>
                </div>
                {(() => {
                  const results = selectedDetail.games
                    .filter((g) => g.status === 'Final' || (g.scheduled_date < today && g.status !== 'Cancelled'))
                    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
                    .slice(0, 10)
                  return results.length === 0 ? (
                    <p className="font-cond text-[12px] text-[#5a6e9a] py-2">No results yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {results.map((g) => (
                        <div
                          key={g.id}
                          className="bg-[#081428] border border-[#1a2d50] rounded-xl px-4 py-3 flex items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-cond font-bold text-[13px] text-white truncate">
                              {g.home_team_name}
                              <span className="text-[#5a6e9a] mx-1.5 font-normal">vs</span>
                              {g.away_team_name}
                            </div>
                            <div className="font-cond text-[11px] text-[#5a6e9a] mt-0.5">
                              {fmtDate(g.scheduled_date)}
                            </div>
                          </div>
                          {g.status === 'Final' && (
                            <span className="font-mono text-[14px] text-white font-bold shrink-0">
                              {g.home_score} – {g.away_score}
                            </span>
                          )}
                          <span className="font-cond font-black tracking-wide text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-[#111520] text-[#5a6e9a] border border-[#1e2d40] shrink-0">
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </section>

              {/* Roster */}
              {selectedDetail.teams.map((team) => (
                <section key={team.id}>
                  <div className="border-b border-[#1a2d50] pb-2 mb-3">
                    <span className="font-cond font-black tracking-widest uppercase text-[11px] text-[#5a6e9a]">
                      Roster — {team.name}
                    </span>
                  </div>
                  {loadingPlayers && !players[team.id] ? (
                    <div className="flex items-center gap-2 py-3">
                      <div className="w-4 h-4 border border-[#0B3D91] border-t-transparent rounded-full animate-spin" />
                      <span className="font-cond text-[12px] text-[#5a6e9a]">Loading roster…</span>
                    </div>
                  ) : !players[team.id] || players[team.id].length === 0 ? (
                    <p className="font-cond text-[12px] text-[#5a6e9a] py-2">No players listed.</p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {players[team.id].map((p) => (
                        <div
                          key={p.id}
                          className="bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-2 flex items-center gap-3"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#0B3D91]/30 border border-[#0B3D91]/50 flex items-center justify-center shrink-0">
                            <span className="font-mono text-[11px] text-blue-300 font-bold">
                              {p.jersey_number != null ? `#${p.jersey_number}` : '—'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-cond font-bold text-[12px] text-white truncate">
                              {p.name}
                            </div>
                            {(p.position || p.grade_level) && (
                              <div className="font-cond text-[11px] text-[#5a6e9a] truncate">
                                {[p.position, p.grade_level].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a2d50] mt-8 py-4">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="font-cond text-[11px] text-[#5a6e9a]/60">
            {school.name} Athletic Department · Read-only portal
          </p>
        </div>
      </footer>
    </div>
  )
}
