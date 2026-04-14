'use client'
import type { BracketMatchup } from '@/lib/public-results/data'

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
  matchup: BracketMatchup
  liveGameIds: Set<number>
  liveScores: Map<number, { home_score: number; away_score: number }>
  flashingIds: Set<number>
}

export function BracketMatchupCard({ matchup, liveGameIds, liveScores, flashingIds }: Props) {
  const isLive = matchup.game_id !== null && liveGameIds.has(matchup.game_id)
  const isFlashing = matchup.game_id !== null && flashingIds.has(matchup.game_id)

  // Use live score overrides when game is live
  const displayScoreTop =
    isLive && matchup.game_id !== null && liveScores.has(matchup.game_id)
      ? liveScores.get(matchup.game_id)!.home_score
      : matchup.score_top

  const displayScoreBottom =
    isLive && matchup.game_id !== null && liveScores.has(matchup.game_id)
      ? liveScores.get(matchup.game_id)!.away_score
      : matchup.score_bottom

  const teamTop = matchup.team_top
  const teamBottom = matchup.team_bottom
  const isTopWinner =
    matchup.winner_id !== null && teamTop !== null && matchup.winner_id === teamTop.id
  const isBottomWinner =
    matchup.winner_id !== null && teamBottom !== null && matchup.winner_id === teamBottom.id

  return (
    <div
      className={`w-40 bg-[#081428] border rounded-lg overflow-hidden ${
        isLive ? 'border-green-400/30 border-l-2 border-l-green-400' : 'border-[#1a2d50]'
      }`}
      aria-label={`${teamTop?.name ?? 'TBD'} vs ${teamBottom?.name ?? 'TBD'}`}
    >
      {/* Top team slot */}
      <div
        className={`px-3 py-2 flex items-center justify-between gap-1 border-b border-[#1a2d50]/50 ${
          isTopWinner ? 'bg-[#0B3D91]/20' : ''
        }`}
      >
        <div className="flex items-center min-w-0 flex-1 gap-1">
          {matchup.seed_top !== null && (
            <span className="font-cond text-[10px] text-[#5a6e9a] shrink-0">
              #{matchup.seed_top}
            </span>
          )}
          {teamLogo(teamTop) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo(teamTop)!}
              alt=""
              className="w-4 h-4 rounded object-cover shrink-0"
            />
          )}
          <span
            className={`font-cond text-[12px] font-bold truncate ${teamTop ? 'text-white' : 'text-[#5a6e9a]'}`}
          >
            {teamTop?.name ?? 'TBD'}
          </span>
        </div>
        <span
          className={`${isFlashing ? 'score-flash' : ''} font-mono text-[18px] font-bold tabular-nums shrink-0 ${
            isLive ? 'text-green-400' : 'text-white'
          }`}
        >
          {displayScoreTop}
        </span>
      </div>

      {/* Bottom team slot */}
      <div
        className={`px-3 py-2 flex items-center justify-between gap-1 ${
          isBottomWinner ? 'bg-[#0B3D91]/20' : ''
        }`}
      >
        <div className="flex items-center min-w-0 flex-1 gap-1">
          {matchup.seed_bottom !== null && (
            <span className="font-cond text-[10px] text-[#5a6e9a] shrink-0">
              #{matchup.seed_bottom}
            </span>
          )}
          {teamLogo(teamBottom) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo(teamBottom)!}
              alt=""
              className="w-4 h-4 rounded object-cover shrink-0"
            />
          )}
          <span
            className={`font-cond text-[12px] font-bold truncate ${teamBottom ? 'text-white' : 'text-[#5a6e9a]'}`}
          >
            {teamBottom?.name ?? 'TBD'}
          </span>
        </div>
        <span
          className={`${isFlashing ? 'score-flash' : ''} font-mono text-[18px] font-bold tabular-nums shrink-0 ${
            isLive ? 'text-green-400' : 'text-white'
          }`}
        >
          {displayScoreBottom}
        </span>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="px-3 py-1 text-center border-t border-green-400/20">
          <span className="font-cond text-[10px] font-bold text-green-400 uppercase tracking-[.1em]">
            LIVE
          </span>
        </div>
      )}
    </div>
  )
}
