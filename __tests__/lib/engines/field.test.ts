import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { runFieldConflictEngine, applyResolution, runFullConflictScan } from '@/lib/engines/field'

describe('field conflict engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
  })

  it('runFieldConflictEngine returns clean result when no games', async () => {
    // getSchedulingRules → event_rules (rules query), then games (empty)
    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // event_rules (getRules → loadRules)
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // games (empty → early return)

    const result = await runFieldConflictEngine(1, 1, mockSb)
    expect(result.conflicts).toHaveLength(0)
    expect(result.clean).toBe(true)
    expect(result.summary).toContain('No games')
  })

  it('runFieldConflictEngine calls games table and returns expected shape', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: [], error: null })
    )

    const result = await runFieldConflictEngine(1, 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('games')
    expect(result).toHaveProperty('conflicts')
    expect(result).toHaveProperty('clean')
    expect(result).toHaveProperty('stats')
    expect(result).toHaveProperty('durationMs')
  })

  it('runFullConflictScan calls runFieldConflictEngine and returns field result', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: [], error: null })
    )

    const result = await runFullConflictScan(1, 1, mockSb)
    expect(result).toHaveProperty('field')
    expect(result.field).toHaveProperty('conflicts')
  })

  it('applyResolution calls operational_conflicts table to mark resolved', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: null, error: null })
    )

    const result = await applyResolution(99, 'move_to_field', {}, 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('operational_conflicts')
    // move_to_field is a manual action — returns success message
    expect(result.success).toBe(true)
  })

  it('applyResolution with reschedule_game calls games and ops_log tables', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: null, error: null })
    )

    await applyResolution(1, 'reschedule_game', { game_id: 5, new_time: '10:00 AM' }, 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('games')
    expect(calledTables).toContain('ops_log')
    expect(calledTables).toContain('operational_conflicts')
  })
})
