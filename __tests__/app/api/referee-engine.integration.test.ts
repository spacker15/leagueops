import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the server client factory — must come before any import that uses createClient
vi.mock('@/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the engine function — vi.mock is hoisted, so we cannot reference external vars here.
// Instead, define the mock inline and retrieve the spy after import.
vi.mock('@/lib/engines/referee', () => ({
  runRefereeEngine: vi.fn().mockResolvedValue({ conflicts: [], alerts_written: 0 }),
  findAvailableRefs: vi.fn().mockResolvedValue([]),
}))

import { POST } from '@/app/api/referee-engine/route'
import { createClient } from '@/supabase/server'
import { runRefereeEngine } from '@/lib/engines/referee'
import { makeMockSb } from '@/__tests__/lib/engines/_mockSb'

describe('POST /api/referee-engine — route wiring', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSb = makeMockSb({ data: [], error: null })
    // Wire createClient to return our fresh mock
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb)
    // Restore engine mock after clearAllMocks
    ;(runRefereeEngine as ReturnType<typeof vi.fn>).mockResolvedValue({
      conflicts: [],
      alerts_written: 0,
    })
  })

  it('creates a server client and passes it to runRefereeEngine', async () => {
    const request = new Request('http://localhost/api/referee-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date_id: 42, event_id: 1 }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    // Verify createClient was called (route created a server client)
    expect(createClient).toHaveBeenCalledOnce()

    // Verify runRefereeEngine was called with eventDateId, eventId, and the mock sb
    expect(runRefereeEngine).toHaveBeenCalledWith(42, 1, mockSb)

    // Verify the response contains the engine result
    expect(response.status).toBe(200)
    expect(data).toMatchObject({ conflicts: [], alerts_written: 0 })
  })

  it('returns 400 when event_date_id is missing', async () => {
    const request = new Request('http://localhost/api/referee-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  it('returns 500 when runRefereeEngine throws', async () => {
    ;(runRefereeEngine as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB connection error')
    )

    const request = new Request('http://localhost/api/referee-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date_id: 1, event_id: 1 }),
    })

    const response = await POST(request as any)
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('DB connection error')
  })
})
