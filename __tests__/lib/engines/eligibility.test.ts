import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import {
  checkPlayerEligibility,
  getPendingApprovals,
  approveMultiGame,
} from '@/lib/engines/eligibility'

describe('eligibility engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
  })

  it('checkPlayerEligibility returns ineligible when game is not found', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: null, error: null })
    )

    const result = await checkPlayerEligibility(1, 999, 1, mockSb)
    expect(result.eligible).toBe(false)
    if (result.eligible === false) {
      expect(result.message).toContain('not found')
    }
  })

  it('checkPlayerEligibility returns ineligible when player is not found', async () => {
    const mockGame = {
      id: 10,
      division: 'Boys 12U',
      event_id: 1,
      event_date_id: 1,
      home_team_id: 1,
      away_team_id: 2,
      home_team: { name: 'Team A' },
      away_team: { name: 'Team B' },
    }

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockGame, error: null })) // games .single()
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // players .single()

    const result = await checkPlayerEligibility(999, 10, 1, mockSb)
    expect(result.eligible).toBe(false)
    if (result.eligible === false) {
      expect(result.message).toContain('not found')
    }
  })

  it('checkPlayerEligibility returns eligible when player plays in same division', async () => {
    const mockGame = {
      id: 10,
      division: 'Boys 12U',
      event_id: 1,
      event_date_id: 1,
      home_team_id: 1,
      away_team_id: 2,
      home_team: { name: 'Team A' },
      away_team: { name: 'Team B' },
    }
    const mockPlayer = {
      id: 1,
      name: 'Test Player',
      home_division: 'Boys 12U',
      team: { division: 'Boys 12U' },
    }
    const mockRules = [
      { rule_key: 'enforce_play_down', rule_value: 'true' },
      { rule_key: 'multi_game_require_approval', rule_value: 'false' },
    ]

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockGame, error: null })) // games .single()
      .mockReturnValueOnce(makeChain({ data: mockPlayer, error: null })) // players .single()
      .mockReturnValueOnce(makeChain({ data: mockRules, error: null })) // event_rules
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // player_checkins
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // multi_game_approvals .single()

    const result = await checkPlayerEligibility(1, 10, 1, mockSb)
    expect(result.eligible).toBe(true)
  })

  it('checkPlayerEligibility returns ineligible when player plays down in age', async () => {
    const mockGame = {
      id: 10,
      division: 'Boys 10U', // lower division
      event_id: 1,
      event_date_id: 1,
      home_team_id: 1,
      away_team_id: 2,
      home_team: { name: 'Team A' },
      away_team: { name: 'Team B' },
    }
    const mockPlayer = {
      id: 1,
      name: 'Test Player',
      home_division: 'Boys 12U', // player is 12U trying to play 10U = play down
      team: { division: 'Boys 12U' },
    }
    const mockRules = [{ rule_key: 'enforce_play_down', rule_value: 'true' }]

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockGame, error: null })) // games .single()
      .mockReturnValueOnce(makeChain({ data: mockPlayer, error: null })) // players .single()
      .mockReturnValueOnce(makeChain({ data: mockRules, error: null })) // event_rules
      .mockReturnValue(makeChain({ data: null, error: null })) // eligibility_violations insert

    const result = await checkPlayerEligibility(1, 10, 1, mockSb)
    expect(result.eligible).toBe(false)
    if (result.eligible === false && result.reason === 'play_down') {
      expect(result.playerDiv).toBe('Boys 12U')
      expect(result.gameDiv).toBe('Boys 10U')
    }
  })

  it('getPendingApprovals returns empty array when no pending approvals', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: [], error: null })
    )

    const result = await getPendingApprovals(10, mockSb)
    expect(result).toEqual([])
    expect(mockSb.from).toHaveBeenCalledWith('multi_game_approvals')
  })

  it('approveMultiGame calls multi_game_approvals table', async () => {
    const mockApproval = {
      id: 1,
      game_id: 10,
      player_id: 1,
      event_id: 1,
      checkin_held: true,
    }

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockApproval, error: null })) // update .single()
      .mockReturnValue(makeChain({ data: null, error: null })) // subsequent writes

    await approveMultiGame(1, 'coach', 'Coach Smith', mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('multi_game_approvals')
  })
})
