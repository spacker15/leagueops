'use client'
import type { PublicGame } from '@/lib/public-results/data'
import { groupBy, timeToMinutes } from '@/lib/public-results/utils'

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
  hideScores?: boolean
}

function statusColor(status: string): string {
  if (status === 'Live' || status === 'Halftime') return 'text-green-400'
  if (status === 'Final') return 'text-slate-500'
  return 'text-slate-200'
}

export function ByFieldView({ games, hideScores = false }: Props) {
  if (games.length === 0) {
    return (
      <div className="text-center py-20 border border-[#2e5090] rounded-xl bg-[#1a3566]">
        <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#8aa4cc] uppercase">
          No games scheduled on this date.
        </div>
      </div>
    )
  }

  const byField = groupBy(games, (g) => g.field?.name ?? 'Unassigned')
  const fieldNames = Object.keys(byField).sort((a, b) => {
    const numA = Number(games.find((g) => (g.field?.name ?? 'Unassigned') === a)?.field?.number ?? 9999)
    const numB = Number(games.find((g) => (g.field?.name ?? 'Unassigned') === b)?.field?.number ?? 9999)
    return numA - numB
  })

  return (
    <div className="space-y-4">
      {fieldNames.map((fieldName) => {
        const fieldGames = [...byField[fieldName]].sort((a, b) => {
          const aFinal = a.status === 'Final' ? 1 : 0
          const bFinal = b.status === 'Final' ? 1 : 0
          if (aFinal !== bFinal) return aFinal - bFinal
          return timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
        })
        const isLiveField = fieldGames.some((g) => g.status === 'Live' || g.status === 'Halftime')
        const upcoming = fieldGames.filter((g) => g.status !== 'Final')
        const nextGame = upcoming[0]

        return (
          <div
            key={fieldName}
            className={`bg-[#1a3566] border rounded-xl p-4 ${
              isLiveField ? 'border-green-400/40' : 'border-[#2e5090]'
            }`}
          >
            {/* Field header */}
            <div className="flex items-center justify-between mb-3">
              <div className="font-cond text-[13px] font-bold text-white">
                {fieldName}{' '}
                <span className="text-[#8aa4cc] ml-2 font-normal">
                  {fieldGames.length} {fieldGames.length === 1 ? 'game' : 'games'}
                </span>
              </div>
              {nextGame && (
                <div className="font-cond text-[10px] font-bold text-slate-300">
                  NEXT: {nextGame.scheduled_time}
                </div>
              )}
            </div>

            {/* Games list */}
            <div className="divide-y divide-[#253f6e]/60">
              {fieldGames.map((game) => {
                const showScore =
                  !hideScores &&
                  (game.status === 'Final' || game.status === 'Live' || game.status === 'Halftime')
                return (
                  <div
                    key={game.id}
                    className={`py-2 first:pt-0 last:pb-0 flex items-center gap-3 ${game.status === 'Final' ? 'opacity-50' : ''}`}
                  >
                    {/* Time */}
                    <div className="w-12 shrink-0">
                      <div className="font-mono text-[12px] text-white">
                        {game.scheduled_time ?? '—'}
                      </div>
                    </div>

                    {/* Teams + scores */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {teamLogo(game.home_team) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={teamLogo(game.home_team)!}
                              alt=""
                              className="w-4 h-4 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="font-cond font-bold text-[13px] text-white truncate">
                            {game.home_team?.name ?? 'TBD'}
                          </span>
                        </div>
                        {showScore && (
                          <span className="font-mono font-bold text-[13px] text-white tabular-nums ml-2 shrink-0">
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
                              className="w-4 h-4 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="font-cond font-bold text-[13px] text-white truncate">
                            {game.away_team?.name ?? 'TBD'}
                          </span>
                        </div>
                        {showScore && (
                          <span className="font-mono font-bold text-[13px] text-white tabular-nums ml-2 shrink-0">
                            {game.away_score}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase ${statusColor(game.status)}`}
                      >
                        {game.status}
                      </div>
                      <div className="font-cond text-[10px] text-[#8aa4cc] uppercase">
                        {game.division}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
