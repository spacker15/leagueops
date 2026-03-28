import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'

// Mock sub-engine modules so unified.test.ts doesn't depend on DB
vi.mock('@/lib/engines/referee', () => ({
  runRefereeEngine: vi.fn().mockResolvedValue({ conflicts: [], clean: true, summary: 'clear' }),
  findAvailableRefs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/engines/field', () => ({
  runFieldConflictEngine: vi.fn().mockResolvedValue({
    conflicts: [],
    clean: true,
    summary: 'clear',
    stats: {},
    durationMs: 0,
  }),
  applyResolution: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  runFullConflictScan: vi.fn().mockResolvedValue({ field: { conflicts: [] } }),
}))
vi.mock('@/lib/engines/weather', () => ({
  runWeatherEngine: vi.fn().mockResolvedValue({ alerts: [], reading: {}, actions_taken: [] }),
}))

import { runUnifiedEngine, resolveAlert, generateShiftHandoff } from '@/lib/engines/unified'
import { runRefereeEngine } from '@/lib/engines/referee'
import { runFieldConflictEngine } from '@/lib/engines/field'

describe('unified engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
    vi.clearAllMocks()
    // Reset mocks to default resolved values after clearAllMocks
    ;(runRefereeEngine as ReturnType<typeof vi.fn>).mockResolvedValue({
      conflicts: [],
      clean: true,
      summary: 'clear',
    })
    ;(runFieldConflictEngine as ReturnType<typeof vi.fn>).mockResolvedValue({
      conflicts: [],
      clean: true,
      summary: 'clear',
      stats: {},
      durationMs: 0,
    })
  })

  it('runUnifiedEngine calls runRefereeEngine and runFieldConflictEngine with correct args', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(makeChain({ data: [], error: null }))

    await runUnifiedEngine(42, 1, mockSb)

    expect(runRefereeEngine).toHaveBeenCalledWith(42, 1, mockSb)
    expect(runFieldConflictEngine).toHaveBeenCalledWith(42, 1, mockSb)
  })

  it('runUnifiedEngine aggregates results into expected shape', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(makeChain({ data: [], error: null }))

    const result = await runUnifiedEngine(1, 1, mockSb)

    expect(result).toHaveProperty('alerts_created')
    expect(result).toHaveProperty('alerts_escalated')
    expect(result).toHaveProperty('referee_conflicts')
    expect(result).toHaveProperty('field_conflicts')
    expect(result).toHaveProperty('weather_alerts')
    expect(result).toHaveProperty('run_at')
  })

  it('runUnifiedEngine counts referee conflicts in result', async () => {
    const mockConflicts = [
      {
        type: 'missing_referee',
        severity: 'warning',
        refereeId: 0,
        refereeName: 'Unassigned',
        gameIds: [1],
        description: 'No ref assigned',
        resolutionOptions: [],
      },
    ]
    ;(runRefereeEngine as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      conflicts: mockConflicts,
      clean: false,
      summary: '1 warning',
    })
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: null, error: null })
    )

    const result = await runUnifiedEngine(1, 1, mockSb)

    expect(result.referee_conflicts).toBe(1)
  })

  it('runUnifiedEngine handles sub-engine failure gracefully', async () => {
    ;(runRefereeEngine as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB connection failed')
    )
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: null, error: null })
    )

    // Should not throw — engine catches the error and logs it
    const result = await runUnifiedEngine(1, 1, mockSb)

    // Both engines failed, so conflicts should be 0
    expect(result.referee_conflicts).toBe(0)
    expect(result.field_conflicts).toBe(0)
    // ops_log should have been written with the error
    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('ops_log')
  })

  it('resolveAlert calls ops_alerts table to mark resolved', async () => {
    const mockAlert = {
      id: 5,
      title: 'Test Alert',
      severity: 'warning',
      resolved: false,
      resolution_action: null,
      resolution_params: null,
      resolution_suggestion: 'Fix it',
    }

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockAlert, error: null })) // ops_alerts .single()
      .mockReturnValue(makeChain({ data: null, error: null })) // update + ops_log

    await resolveAlert(5, 'admin', 'Resolved manually', 1, mockSb)

    const calledTables = (mockSb.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(calledTables).toContain('ops_alerts')
    expect(calledTables).toContain('ops_log')
  })

  it('generateShiftHandoff returns a string summary', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValue(makeChain({ data: [], error: null }))

    const summary = await generateShiftHandoff('admin', 1, mockSb)

    expect(typeof summary).toBe('string')
    expect(summary).toContain('Shift Handoff')
    expect(summary).toContain('Live games')
  })
})
