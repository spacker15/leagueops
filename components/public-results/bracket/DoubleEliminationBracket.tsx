'use client'
import type { BracketRound, BracketMatchup } from '@/lib/public-results/data'
import { SingleEliminationBracket } from './SingleEliminationBracket'
import { BracketMatchupCard } from './BracketMatchupCard'

interface Props {
  rounds: BracketRound[]
  liveGameIds: Set<number>
  liveScores: Map<number, { home_score: number; away_score: number }>
  flashingIds: Set<number>
}

export function DoubleEliminationBracket({ rounds, liveGameIds, liveScores, flashingIds }: Props) {
  const winnersRounds = rounds
    .filter((r) => r.bracket_side === 'winners')
    .sort((a, b) => a.round_number - b.round_number)

  const losersRounds = rounds
    .filter((r) => r.bracket_side === 'losers')
    .sort((a, b) => a.round_number - b.round_number)

  const grandFinal = rounds.filter((r) => r.bracket_side === 'grand_final')

  // Collect all grand final matchups
  const grandFinalMatchups: BracketMatchup[] = grandFinal.flatMap((r) =>
    [...r.matchups].sort((a, b) => a.position - b.position)
  )

  return (
    <div className="min-w-[820px]">
      {/* Winners Bracket */}
      <div>
        <div className="font-cond text-[12px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase mb-3">
          Winners Bracket
        </div>
        <SingleEliminationBracket
          rounds={winnersRounds}
          liveGameIds={liveGameIds}
          liveScores={liveScores}
          flashingIds={flashingIds}
        />
      </div>

      {/* Losers Bracket */}
      <div className="mt-8 pt-8 border-t border-[#1a2d50]">
        <div className="font-cond text-[12px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase mb-3">
          Losers Bracket
        </div>
        <SingleEliminationBracket
          rounds={losersRounds}
          liveGameIds={liveGameIds}
          liveScores={liveScores}
          flashingIds={flashingIds}
        />
      </div>

      {/* Grand Final */}
      {grandFinalMatchups.length > 0 && (
        <div className="mt-8 pt-8 border-t border-[#1a2d50]">
          <div className="font-cond text-[12px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase mb-3">
            Grand Final
          </div>
          <div className="flex gap-4">
            {grandFinalMatchups.map((matchup) => (
              <BracketMatchupCard
                key={matchup.id}
                matchup={matchup}
                liveGameIds={liveGameIds}
                liveScores={liveScores}
                flashingIds={flashingIds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
