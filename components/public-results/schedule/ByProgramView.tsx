'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { PublicGame, PublicTeam } from '@/lib/public-results/data'
import { timeToMinutes } from '@/lib/public-results/utils'
import { AddToCalendarBtn } from '@/components/public-results/AddToCalendarBtn'

function teamLogo(
  team: { logo_url?: string | null; programs?: unknown } | null | undefined
): string | null {
  if (!team) return null
  if (team.logo_url) return team.logo_url
  const prog = Array.isArray(team.programs)
    ? (team.programs as { logo_url?: string | null }[])[0]
    : (team.programs as { logo_url?: string | null } | null | undefined)
  return prog?.logo_url ?? null
}

function getProgram(team: PublicTeam): { name: string; logo_url: string | null } {
  const prog = Array.isArray(team.programs)
    ? (team.programs as { name?: string | null; logo_url?: string | null }[])[0]
    : (team.programs as { name?: string | null; logo_url?: string | null } | null | undefined)
  return {
    name: prog?.name ?? 'Independent',
    logo_url: prog?.logo_url ?? null,
  }
}

interface Props {
  games: PublicGame[]
  teams: PublicTeam[]
  slug: string
  activeDay: number
  divFilter: string
  teamId: number | null
  hideScores?: boolean
}

function GameRow({ game, hideScores = false }: { game: PublicGame; hideScores?: boolean }) {
  const isLive = game.status === 'Live' || game.status === 'Halftime'
  const isFinal = game.status === 'Final'

  return (
    <div
      className={`bg-[#0e2040] border rounded-xl px-4 py-3 flex items-center gap-4 ${
        isLive ? 'border-green-400/30' : 'border-[#253f6e]'
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        <div className="font-mono text-[12px] text-white">{game.scheduled_time ?? '—'}</div>
        <div className="font-cond text-[10px] text-[#8aa4cc] uppercase">
          {game.field?.name ?? ''}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {teamLogo(game.home_team) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={teamLogo(game.home_team)!}
                alt=""
                className="w-5 h-5 rounded object-cover shrink-0"
              />
            )}
            <span className="font-cond font-bold text-[14px] text-white truncate">
              {game.home_team?.name ?? 'TBD'}
            </span>
          </div>
          {!hideScores && (isFinal || isLive) && (
            <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
              {game.home_score}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {teamLogo(game.away_team) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={teamLogo(game.away_team)!}
                alt=""
                className="w-5 h-5 rounded object-cover shrink-0"
              />
            )}
            <span className="font-cond font-bold text-[14px] text-white truncate">
              {game.away_team?.name ?? 'TBD'}
            </span>
          </div>
          {!hideScores && (isFinal || isLive) && (
            <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
              {game.away_score}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase ${
            isLive ? 'text-green-400' : isFinal ? 'text-slate-500' : 'text-slate-200'
          }`}
        >
          {game.status}
        </div>
        <div className="font-cond text-[10px] text-[#8aa4cc] uppercase">{game.division}</div>
      </div>
    </div>
  )
}

export function ByProgramView({
  games,
  teams,
  slug,
  activeDay,
  divFilter,
  teamId,
  hideScores = false,
}: Props) {
  // ── Single team mode ──
  if (teamId !== null) {
    const team = teams.find((t) => t.id === teamId)
    const teamGames = games.filter((g) => g.home_team?.id === teamId || g.away_team?.id === teamId)
    const sorted = [...teamGames].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )

    return (
      <div>
        <Link
          href={`/results/e/${slug}?tab=schedule&view=program&day=${activeDay}&div=${divFilter}`}
          className="font-cond text-[12px] font-bold text-[#8aa4cc] hover:text-white transition-colors mb-3 inline-block"
        >
          ← All Programs
        </Link>

        {team && (
          <div className="flex items-center gap-2 mb-3">
            {teamLogo(team) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogo(team)!} alt="" className="w-7 h-7 rounded object-cover" />
            )}
            <div className="font-cond text-[14px] font-bold text-white">{team.name}</div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="text-center py-20 border border-[#253f6e] rounded-xl bg-[#0e2040]">
            <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#8aa4cc] uppercase">
              No games scheduled for this selection.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((game) => (
              <GameRow key={game.id} game={game} hideScores={hideScores} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Program list mode: group by program → division → team ──
  const programMap = new Map<
    string,
    { logo: string | null; divisions: Map<string, PublicTeam[]> }
  >()

  for (const team of teams) {
    const prog = getProgram(team)
    if (!programMap.has(prog.name)) {
      programMap.set(prog.name, { logo: prog.logo_url, divisions: new Map() })
    }
    const entry = programMap.get(prog.name)!
    if (!entry.divisions.has(team.division)) {
      entry.divisions.set(team.division, [])
    }
    entry.divisions.get(team.division)!.push(team)
  }

  const sortedPrograms = [...programMap.entries()].sort(([a], [b]) => a.localeCompare(b))

  if (sortedPrograms.length === 0) {
    return (
      <div className="text-center py-20 border border-[#253f6e] rounded-xl bg-[#0e2040]">
        <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#8aa4cc] uppercase">
          No teams found.
        </div>
      </div>
    )
  }

  return (
    <ProgramList
      sortedPrograms={sortedPrograms}
      games={games}
      hideScores={hideScores}
      slug={slug}
    />
  )
}

function ProgramList({
  sortedPrograms,
  games,
  hideScores,
  slug,
}: {
  sortedPrograms: [string, { logo: string | null; divisions: Map<string, PublicTeam[]> }][]
  games: PublicGame[]
  hideScores: boolean
  slug: string
}) {
  // Start with all programs expanded (empty set = nothing collapsed)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {sortedPrograms.map(([programName, { logo, divisions }]) => {
        const isCollapsed = collapsed.has(programName)
        const sortedDivisions = [...divisions.entries()].sort(([a], [b]) => a.localeCompare(b))
        const teamCount = [...divisions.values()].reduce((n, t) => n + t.length, 0)

        return (
          <div
            key={programName}
            className="bg-[#0e2040] border border-[#253f6e] rounded-xl overflow-hidden"
          >
            {/* Program header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#253f6e]">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              )}
              <button
                onClick={() => toggle(programName)}
                className="flex items-center gap-2 flex-1 text-left min-w-0"
              >
                <span className="font-cond text-[15px] font-bold text-white flex-1 truncate">
                  {programName}
                </span>
                <span className="font-cond text-[10px] text-[#8aa4cc] shrink-0">
                  {teamCount} team{teamCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[#8aa4cc] text-[12px] shrink-0">{isCollapsed ? '▶' : '▼'}</span>
              </button>
              <AddToCalendarBtn slug={slug} program={programName} />
            </div>

            {/* Divisions + teams + games (hidden when program collapsed) */}
            {!isCollapsed && <div className="px-4 pb-4 space-y-5">
              {sortedDivisions.map(([divisionName, divTeams]) => (
                <div key={divisionName} className="pt-4">
                  <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#8aa4cc] uppercase mb-3">
                    {divisionName}
                  </div>
                  <div className="space-y-4">
                    {divTeams.map((team) => {
                      const teamGames = games
                        .filter(
                          (g) => g.home_team?.id === team.id || g.away_team?.id === team.id
                        )
                        .sort(
                          (a, b) =>
                            timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
                        )

                      return (
                        <div key={team.id}>
                          <div className="flex items-center gap-2 mb-2">
                            {teamLogo(team) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={teamLogo(team)!}
                                alt=""
                                className="w-5 h-5 rounded object-cover shrink-0"
                              />
                            )}
                            <span className="font-cond text-[13px] font-bold text-white">
                              {team.name}
                            </span>
                            <span className="font-cond text-[10px] text-[#8aa4cc]">
                              {teamGames.length} game{teamGames.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {teamGames.length === 0 ? (
                            <div className="font-cond text-[11px] text-[#8aa4cc] pl-1">
                              No games scheduled
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {teamGames.map((game) => (
                                <GameRow key={game.id} game={game} hideScores={hideScores} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )
      })}
    </div>
  )
}
