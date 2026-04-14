'use client'
import type { BracketRound } from '@/lib/public-results/data'
import { SingleEliminationBracket } from './SingleEliminationBracket'
import { DoubleEliminationBracket } from './DoubleEliminationBracket'

interface Props {
  bracket: { format: 'single' | 'double' | null; rounds: BracketRound[] }
  liveGameIds: Set<number>
  liveScores: Map<number, { home_score: number; away_score: number }>
  flashingIds: Set<number>
}

export function BracketTab({ bracket, liveGameIds, liveScores, flashingIds }: Props) {
  if (bracket.format === null || bracket.rounds.length === 0) {
    return null
  }

  return (
    <div>
      {/* Format label */}
      <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase mb-4">
        {bracket.format === 'single' ? 'Single Elimination' : 'Double Elimination'}
      </div>

      {/* Mobile horizontal scroll wrapper */}
      <div className="overflow-x-auto -mx-4 px-4">
        {bracket.format === 'single' ? (
          <SingleEliminationBracket
            rounds={bracket.rounds}
            liveGameIds={liveGameIds}
            liveScores={liveScores}
            flashingIds={flashingIds}
          />
        ) : (
          <DoubleEliminationBracket
            rounds={bracket.rounds}
            liveGameIds={liveGameIds}
            liveScores={liveScores}
            flashingIds={flashingIds}
          />
        )}
      </div>
    </div>
  )
}
