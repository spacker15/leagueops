'use client'
import Link from 'next/link'
import type { PublicGame, PublicTeam } from '@/lib/data'
import { TeamSearchInput } from './TeamSearchInput'
import { timeToMinutes } from '@/lib/utils'

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

interface Props {
  games: PublicGame[]
  teams: PublicTeam[]
  slug: string
  activeDay: number
  divFilter: string
  teamId: number | null
}

function GameRow({ game }: { game: PublicGame }) {
  const isLive = game.status === 'Live' || game.status === 'Halftime'
  const isFinal = game.status === 'Final'

  return (
    <div
      className={`bg-[#081428] border rounded-xl px-4 py-3 flex items-center gap-4 ${
        isLive ? 'border-green-400/30' : 'border-[#1a2d50]'
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        <div className="font-mono text-[12px] text-white">{game.scheduled_time ?? '—'}</div>
        <div className="font-cond text-[10px] text-[#5a6e9a] uppercase">
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
          <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
            {isFinal || isLive ? game.home_score : ''}
          </span>
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
          <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
            {isFinal || isLive ? game.away_score : ''}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase ${
            isLive ? 'text-green-400' : isFinal ? 'text-[#5a6e9a]' : 'text-blue-400'
          }`}
        >
          {game.status}
        </div>
        <div className="font-cond text-[10px] text-[#5a6e9a] uppercase">{game.division}</div>
      </div>
    </div>
  )
}

export function ByTeamView({ games, teams, slug, activeDay, divFilter, teamId }: Props) {
  // Single team mode
  if (teamId !== null) {
    const team = teams.find((t) => t.id === teamId)
    const teamGames = games.filter((g) => g.home_team?.id === teamId || g.away_team?.id === teamId)
    const sorted = [...teamGames].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )

    return (
      <div>
        {/* Back link */}
        <Link
          href={`/e/${slug}?tab=schedule&view=team&day=${activeDay}&div=${divFilter}`}
          className="font-cond text-[12px] font-bold text-[#5a6e9a] hover:text-white transition-colors mb-3 inline-block"
        >
          ← All Teams
        </Link>

        {/* Team name header */}
        {team && (
          <div className="flex items-center gap-2 mb-3">
            {teamLogo(team) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogo(team)!} alt="" className="w-7 h-7 rounded object-cover" />
            )}
            <div className="font-cond text-[14px] font-bold text-white">{team.name}</div>
          </div>
        )}

        {/* Games */}
        {sorted.length === 0 ? (
          <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
            <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
              No games scheduled for this selection.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Team list mode
  return (
    <div>
      {/* Client island for type-ahead search + team list */}
      <TeamSearchInput teams={teams} slug={slug} activeDay={activeDay} divFilter={divFilter} />
    </div>
  )
}
