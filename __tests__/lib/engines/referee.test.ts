import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { runRefereeEngine, findAvailableRefs } from '@/lib/engines/referee'

describe('referee engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
  })

  it('runRefereeEngine returns safe default when no data', async () => {
    // All queries return empty arrays
    const result = await runRefereeEngine(1, 1, mockSb)
    expect(result).toHaveProperty('conflicts')
    expect(result).toHaveProperty('clean')
    expect(result).toHaveProperty('summary')
    expect(Array.isArray(result.conflicts)).toBe(true)
  })

  it('runRefereeEngine returns clean result when games and referees return empty', async () => {
    // games returns [], referees returns [], eventDate returns null, availability returns []
    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // games
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // referees
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // event_dates .single()
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // referee_availability

    const result = await runRefereeEngine(1, 1, mockSb)
    // With no data, referee engine returns early with clean=true
    expect(result.clean).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('runRefereeEngine calls games and referees tables', async () => {
    await runRefereeEngine(1, 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('games')
    expect(calledTables).toContain('referees')
  })

  it('runRefereeEngine detects missing_referee conflict for unassigned game', async () => {
    const mockGames = [
      {
        id: 10,
        scheduled_time: '9:00 AM',
        division: 'Boys 12U',
        field_id: 1,
        status: 'Scheduled',
        ref_assignments: [], // no refs assigned
      },
    ]
    const mockReferees = [{ id: 1, name: 'John Ref', event_id: 1, checked_in: true }]
    const mockEventDate = { date: '2026-03-22' }

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockGames, error: null })) // games
      .mockReturnValueOnce(makeChain({ data: mockReferees, error: null })) // referees
      .mockReturnValueOnce(makeChain({ data: mockEventDate, error: null })) // event_dates .single()
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // referee_availability
      .mockReturnValue(makeChain({ data: [], error: null })) // DB writes (clear conflicts, insert)

    const result = await runRefereeEngine(1, 1, mockSb)
    expect(result.conflicts.length).toBeGreaterThan(0)
    const missingRefConflict = result.conflicts.find((c) => c.type === 'missing_referee')
    expect(missingRefConflict).toBeDefined()
    expect(missingRefConflict?.gameIds).toContain(10)
  })

  it('findAvailableRefs returns empty array when no referees', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // event_dates .single()
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // referees
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // games

    const result = await findAvailableRefs(1, '9:00 AM', 'Boys 12U', [], 1, mockSb)
    expect(result).toEqual([])
  })

  it('findAvailableRefs excludes refs in excludeRefIds', async () => {
    const mockEventDate = { date: '2026-03-22' }
    const mockRefs = [
      { id: 1, name: 'Ref A', event_id: 1, checked_in: true, eligible_divisions: [] },
      { id: 2, name: 'Ref B', event_id: 1, checked_in: true, eligible_divisions: [] },
    ]

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockEventDate, error: null })) // event_dates .single()
      .mockReturnValueOnce(makeChain({ data: mockRefs, error: null })) // referees
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // games
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // referee_availability

    // Exclude ref id 1
    const result = await findAvailableRefs(1, '9:00 AM', 'Boys 12U', [1], 1, mockSb)
    const refIds = result.map((r) => r.id)
    expect(refIds).not.toContain(1)
    expect(refIds).toContain(2)
  })
})
