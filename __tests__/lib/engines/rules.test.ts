import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { loadRules, getRules, updateRule, invalidateRulesCache } from '@/lib/engines/rules'

describe('rules engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
    invalidateRulesCache() // clear all event caches between tests
  })

  it('loadRules resolves with empty array when DB returns no rows', async () => {
    const result = await loadRules(1, mockSb)
    expect(result).toEqual([])
    expect(mockSb.from).toHaveBeenCalledWith('event_rules')
  })

  it('loadRules returns rule rows from DB', async () => {
    const mockRules = [
      {
        id: 1,
        event_id: 1,
        category: 'scheduling',
        rule_key: 'game_duration_min',
        rule_label: 'Game Duration (min)',
        rule_value: '60',
        value_type: 'number',
        unit: 'minutes',
        description: null,
        options: null,
        is_override: false,
        default_value: '60',
        updated_at: new Date().toISOString(),
        updated_by: 'system',
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: mockRules, error: null })
    )
    const result = await loadRules(1, mockSb)
    expect(result).toHaveLength(1)
    expect(result[0].rule_key).toBe('game_duration_min')
  })

  it('getRules builds key→value map and caches result', async () => {
    const mockRules = [
      {
        category: 'scheduling',
        rule_key: 'game_duration_min',
        rule_value: '60',
      },
      {
        category: 'referee',
        rule_key: 'refs_per_game',
        rule_value: '2',
      },
    ]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: mockRules, error: null })
    )

    const rules = await getRules(1, mockSb)
    expect(rules['scheduling.game_duration_min']).toBe('60')
    expect(rules['referee.refs_per_game']).toBe('2')
  })

  it('getRules uses cache on second call — does not call from again', async () => {
    const mockRules = [{ category: 'scheduling', rule_key: 'buffer_min', rule_value: '10' }]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: mockRules, error: null })
    )

    // First call — loads from DB
    await getRules(1, mockSb)
    const callCountAfterFirst = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length

    // Second call — should use cache, no new from() call
    await getRules(1, mockSb)
    const callCountAfterSecond = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length

    expect(callCountAfterSecond).toBe(callCountAfterFirst)
  })

  it('invalidateRulesCache forces fresh DB fetch on next getRules call', async () => {
    const mockRules = [{ category: 'heat', rule_key: 'advisory_f', rule_value: '95' }]
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: mockRules, error: null })
    )

    // Populate cache
    await getRules(1, mockSb)
    const callsAfterFirst = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length

    // Invalidate and call again — should fetch from DB again
    invalidateRulesCache(1)
    await getRules(1, mockSb)
    const callsAfterSecond = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length

    expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst)
  })

  it('cache returns correct rules per event (cross-event isolation)', async () => {
    const rulesEvent1 = [
      { category: 'scheduling', rule_key: 'game_duration_min', rule_value: '60' },
    ]
    const rulesEvent2 = [
      { category: 'scheduling', rule_key: 'game_duration_min', rule_value: '90' },
    ]

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: rulesEvent1, error: null })) // event 1
      .mockReturnValueOnce(makeChain({ data: rulesEvent2, error: null })) // event 2

    // Load rules for event 1
    const map1 = await getRules(1, mockSb)
    // Load rules for event 2
    const map2 = await getRules(2, mockSb)

    // Event 1 cache is not contaminated by event 2 data
    expect(map1['scheduling.game_duration_min']).toBe('60')
    expect(map2['scheduling.game_duration_min']).toBe('90')

    // Calling event 1 again should use cache (no additional DB call)
    const callsBefore = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length
    await getRules(1, mockSb)
    const callsAfter = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.length
    expect(callsAfter).toBe(callsBefore)
  })

  it('updateRule calls event_rules and rule_changes tables', async () => {
    // Mock .single() for the current value fetch
    const currentRule = { rule_value: 'old_value', rule_key: 'game_duration_min' }
    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: currentRule, error: null })) // fetch current
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // update rule
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // insert rule_changes
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // insert ops_log

    await updateRule(1, 'new_value', 'admin', 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('event_rules')
    expect(calledTables).toContain('rule_changes')
    expect(calledTables).toContain('ops_log')
  })
})
