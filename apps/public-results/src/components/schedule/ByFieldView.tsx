import type { PublicGame } from '@/lib/data'
import { groupBy } from '@/lib/utils'

interface Props {
  games: PublicGame[]
}

function statusColor(status: string): string {
  if (status === 'Live' || status === 'Halftime') return 'text-green-400'
  if (status === 'Final') return 'text-[#5a6e9a]'
  return 'text-blue-400'
}

export function ByFieldView({ games }: Props) {
  if (games.length === 0) {
    return (
      <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
        <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
          No games scheduled on this date.
        </div>
      </div>
    )
  }

  const byField = groupBy(games, (g) => g.field?.name ?? 'Unassigned')
  const fieldNames = Object.keys(byField).sort()

  return (
    <div className="space-y-4">
      {fieldNames.map((fieldName) => {
        const fieldGames = [...byField[fieldName]].sort((a, b) =>
          (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
        )
        const isLiveField = fieldGames.some(
          (g) => g.status === 'Live' || g.status === 'Halftime'
        )

        return (
          <div
            key={fieldName}
            className={`bg-[#081428] border rounded-xl p-4 ${
              isLiveField ? 'border-green-400/30' : 'border-[#1a2d50]'
            }`}
          >
            {/* Field header */}
            <div className="font-cond text-[12px] font-bold text-white mb-3">
              {fieldName}{' '}
              <span className="text-[#5a6e9a] ml-2 font-normal">
                {fieldGames.length} {fieldGames.length === 1 ? 'game' : 'games'}
              </span>
            </div>

            {/* Games list */}
            <div className="divide-y divide-[#1a2d50]/40">
              {fieldGames.map((game) => (
                <div key={game.id} className="py-2 first:pt-0 last:pb-0 flex items-center gap-3">
                  {/* Time */}
                  <div className="w-12 shrink-0">
                    <div className="font-mono text-[12px] text-white">{game.scheduled_time ?? '—'}</div>
                  </div>

                  {/* Teams + scores */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-cond font-bold text-[12px] text-white truncate min-w-0">
                        {game.home_team?.name ?? 'TBD'}
                      </span>
                      {(game.status === 'Final' ||
                        game.status === 'Live' ||
                        game.status === 'Halftime') && (
                        <span className="font-mono font-bold text-[12px] text-white tabular-nums ml-2 shrink-0">
                          {game.home_score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-cond font-bold text-[12px] text-white truncate min-w-0">
                        {game.away_team?.name ?? 'TBD'}
                      </span>
                      {(game.status === 'Final' ||
                        game.status === 'Live' ||
                        game.status === 'Halftime') && (
                        <span className="font-mono font-bold text-[12px] text-white tabular-nums ml-2 shrink-0">
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
                    <div className="font-cond text-[10px] text-[#5a6e9a] uppercase">
                      {game.division}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
