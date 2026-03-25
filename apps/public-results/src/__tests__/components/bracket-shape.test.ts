import { describe, it, expect } from 'vitest'

// Inline type for BracketRound — matches the shape that Plan 01 will export from @/lib/data
interface BracketMatchup {
  id: number
  home_team: { id: number; name: string } | null
  away_team: { id: number; name: string } | null
  home_score: number | null
  away_score: number | null
  status: string
  game_id: number | null
}

interface BracketRound {
  id: number
  format: string
  bracket_side: string
  round_number: number
  round_label: string
  matchups: BracketMatchup[]
}

// Pure logic: splitting rounds for double-elimination rendering
function splitBracketRounds(rounds: BracketRound[]) {
  return {
    winners: rounds
      .filter((r) => r.bracket_side === 'winners')
      .sort((a, b) => a.round_number - b.round_number),
    losers: rounds
      .filter((r) => r.bracket_side === 'losers')
      .sort((a, b) => a.round_number - b.round_number),
    grandFinal: rounds.filter((r) => r.bracket_side === 'grand_final'),
  }
}

const mockRounds: BracketRound[] = [
  {
    id: 1,
    format: 'double',
    bracket_side: 'winners',
    round_number: 1,
    round_label: 'QF',
    matchups: [],
  },
  {
    id: 2,
    format: 'double',
    bracket_side: 'winners',
    round_number: 2,
    round_label: 'SF',
    matchups: [],
  },
  {
    id: 3,
    format: 'double',
    bracket_side: 'losers',
    round_number: 1,
    round_label: 'LR1',
    matchups: [],
  },
  {
    id: 4,
    format: 'double',
    bracket_side: 'grand_final',
    round_number: 1,
    round_label: 'Final',
    matchups: [],
  },
]

describe('bracket shape', () => {
  it('splits rounds into winners, losers, and grand final', () => {
    const { winners, losers, grandFinal } = splitBracketRounds(mockRounds)
    expect(winners).toHaveLength(2)
    expect(losers).toHaveLength(1)
    expect(grandFinal).toHaveLength(1)
  })

  it('sorts winners rounds by round_number', () => {
    const { winners } = splitBracketRounds(mockRounds)
    expect(winners[0].round_label).toBe('QF')
    expect(winners[1].round_label).toBe('SF')
  })

  it('handles single-elimination (all rounds in winners bracket)', () => {
    const singleRounds: BracketRound[] = [
      {
        id: 10,
        format: 'single',
        bracket_side: 'winners',
        round_number: 1,
        round_label: 'SF',
        matchups: [],
      },
      {
        id: 11,
        format: 'single',
        bracket_side: 'winners',
        round_number: 2,
        round_label: 'Final',
        matchups: [],
      },
    ]
    const { winners, losers, grandFinal } = splitBracketRounds(singleRounds)
    expect(winners).toHaveLength(2)
    expect(losers).toHaveLength(0)
    expect(grandFinal).toHaveLength(0)
  })
})
