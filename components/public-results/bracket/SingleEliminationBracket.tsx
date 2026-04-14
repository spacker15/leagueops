'use client'
import type { BracketRound } from '@/lib/public-results/data'
import { BracketMatchupCard } from './BracketMatchupCard'

interface Props {
  rounds: BracketRound[]
  liveGameIds: Set<number>
  liveScores: Map<number, { home_score: number; away_score: number }>
  flashingIds: Set<number>
}

export function SingleEliminationBracket({ rounds, liveGameIds, liveScores, flashingIds }: Props) {
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)

  if (sortedRounds.length === 0) {
    return null
  }

  return (
    <div className="min-w-[640px] flex items-start gap-0">
      {sortedRounds.map((round) => {
        const sortedMatchups = [...round.matchups].sort((a, b) => a.position - b.position)

        return (
          <div
            key={round.id}
            className="flex flex-col justify-around flex-1"
            style={{ minWidth: '176px' }}
          >
            {/* Round label */}
            <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase text-center mb-3">
              {round.round_label ?? `Round ${round.round_number}`}
            </div>

            {/* Matchups */}
            <div className="flex flex-col justify-around flex-1 gap-4">
              {sortedMatchups.map((matchup) => (
                <div key={matchup.id} className="mb-4 flex items-center">
                  <BracketMatchupCard
                    matchup={matchup}
                    liveGameIds={liveGameIds}
                    liveScores={liveScores}
                    flashingIds={flashingIds}
                  />
                  {/* Connector line extending to the right */}
                  <div className="w-4 border-t border-[#1a2d50]" />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
