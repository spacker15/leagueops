'use client'
import type { PublicGame } from '@/lib/data'
import { groupBy } from '@/lib/utils'

interface Props {
  games: PublicGame[]
}

function formatTime(time: string): string {
  if (!time || time === 'TBD') return 'TBD'
  // time is expected as "HH:MM:SS" or "HH:MM"
  const [hoursStr, minutesStr] = time.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = minutesStr ?? '00'
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes} ${period}`
}

function statusColor(status: string): string {
  if (status === 'Live' || status === 'Halftime') return 'text-green-400'
  if (status === 'Final') return 'text-[#5a6e9a]'
  return 'text-blue-400'
}

export function ByTimeView({ games }: Props) {
  if (games.length === 0) {
    return (
      <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
        <div className="font-cond text-[11px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
          No games scheduled for this selection.
        </div>
      </div>
    )
  }

  const byTime = groupBy(games, (g) => g.scheduled_time ?? 'TBD')
  // Sort time slots chronologically
  const timeSlots = Object.keys(byTime).sort((a, b) => {
    if (a === 'TBD') return 1
    if (b === 'TBD') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-6">
      {timeSlots.map((timeSlot) => {
        const slotGames = [...byTime[timeSlot]].sort((a, b) =>
          (a.division ?? '').localeCompare(b.division ?? '')
        )

        return (
          <div key={timeSlot}>
            {/* Time group heading */}
            <div className="font-cond text-[12px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase mb-2">
              {formatTime(timeSlot)}
            </div>

            {/* Games in this time slot */}
            <div className="space-y-2">
              {slotGames.map((game) => {
                const isLive = game.status === 'Live' || game.status === 'Halftime'
                const isFinal = game.status === 'Final'
                const showScore = isFinal || isLive

                return (
                  <div
                    key={game.id}
                    className={`bg-[#081428] border rounded-xl px-4 py-3 flex items-center gap-3 ${
                      isLive ? 'border-green-400/30' : 'border-[#1a2d50]'
                    }`}
                  >
                    {/* Teams + scores (two-line layout) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {game.home_team?.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={game.home_team.logo_url}
                              alt=""
                              className="w-5 h-5 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="font-cond font-bold text-[14px] text-white truncate">
                            {game.home_team?.name ?? 'TBD'}
                          </span>
                        </div>
                        {showScore && (
                          <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
                            {game.home_score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {game.away_team?.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={game.away_team.logo_url}
                              alt=""
                              className="w-5 h-5 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="font-cond font-bold text-[14px] text-white truncate">
                            {game.away_team?.name ?? 'TBD'}
                          </span>
                        </div>
                        {showScore && (
                          <span className="font-mono font-bold text-[18px] text-white tabular-nums ml-2 shrink-0">
                            {game.away_score}
                          </span>
                        )}
                      </div>
                      {/* Field + division */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-cond text-[10px] text-[#5a6e9a]">
                          {game.field?.name ?? '—'}
                        </span>
                        <span className="font-cond text-[10px] text-[#5a6e9a] uppercase">
                          {game.division}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-cond text-[10px] font-bold tracking-[.1em] uppercase ${statusColor(game.status)}`}
                      >
                        {game.status}
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
