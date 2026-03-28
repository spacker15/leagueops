import { describe, it, expect, vi } from 'vitest'

// Mock insertNotification — must be defined before vi.mock() calls
const mockInsertNotification = vi.fn().mockResolvedValue({ id: 1 })
vi.mock('@/lib/notifications', () => ({
  insertNotification: mockInsertNotification,
}))

// Mock Supabase (weather-engine route uses @/supabase/server without lib/)
vi.mock('@/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ data: [], error: null }) }),
      insert: () => ({ data: null, error: null }),
      update: () => ({
        eq: () => ({ select: () => ({ single: () => ({ data: {}, error: null }) }) }),
      }),
    }),
  }),
}))

// Mock weather engine to return controlled alerts
const mockRunWeatherEngine = vi.fn()
vi.mock('@/lib/engines/weather', () => ({
  runWeatherEngine: (...args: unknown[]) => mockRunWeatherEngine(...args),
  getLatestReading: vi.fn(),
  getReadingHistory: vi.fn(),
}))

// Mock ratelimit — always allow requests through
vi.mock('@/lib/ratelimit', () => ({
  engineRatelimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 0,
      pending: Promise.resolve(),
    }),
  },
}))

describe('Weather Engine Notifications (NOT-02)', () => {
  it('calls insertNotification for each weather alert', async () => {
    vi.resetModules()

    const localInsert = vi.fn().mockResolvedValue({ id: 1 })
    vi.doMock('@/lib/notifications', () => ({ insertNotification: localInsert }))
    vi.doMock('@/supabase/server', () => ({
      createClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
      }),
    }))
    vi.doMock('@/lib/engines/weather', () => ({
      runWeatherEngine: vi.fn().mockResolvedValue({
        reading: {},
        alerts: [
          {
            type: 'lightning',
            severity: 'critical',
            title: 'Lightning Detected',
            description: 'Lightning within 10 miles',
            auto_action: 'delay_30',
          },
          {
            type: 'heat_advisory',
            severity: 'warning',
            title: 'Heat Advisory',
            description: 'Heat index 95F',
            auto_action: null,
          },
        ],
        actions_taken: [],
        games_affected: 0,
        lightning_active: true,
        heat_protocol: 'advisory',
      }),
      getLatestReading: vi.fn(),
      getReadingHistory: vi.fn(),
    }))
    vi.doMock('@/lib/ratelimit', () => ({
      engineRatelimit: {
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: 0,
          pending: Promise.resolve(),
        }),
      },
    }))

    const { POST } = await import('@/app/api/weather-engine/route')
    const req = new Request('http://localhost/api/weather-engine', {
      method: 'POST',
      body: JSON.stringify({ complex_id: 1, event_id: 42 }),
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    await POST(req as unknown as import('next/server').NextRequest)

    // Plan 10-03 will add insertNotification calls — this should be called twice (once per alert)
    expect(localInsert).toHaveBeenCalledTimes(2)
  })

  it('uses event scope for lightning alerts (D-16)', async () => {
    vi.resetModules()

    const localInsert = vi.fn().mockResolvedValue({ id: 1 })
    vi.doMock('@/lib/notifications', () => ({ insertNotification: localInsert }))
    vi.doMock('@/supabase/server', () => ({
      createClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
      }),
    }))
    vi.doMock('@/lib/engines/weather', () => ({
      runWeatherEngine: vi.fn().mockResolvedValue({
        reading: {},
        alerts: [
          {
            type: 'lightning',
            severity: 'critical',
            title: 'Lightning',
            description: 'desc',
            auto_action: null,
          },
        ],
        actions_taken: [],
        games_affected: 0,
        lightning_active: true,
        heat_protocol: 'none',
      }),
      getLatestReading: vi.fn(),
      getReadingHistory: vi.fn(),
    }))
    vi.doMock('@/lib/ratelimit', () => ({
      engineRatelimit: {
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: 0,
          pending: Promise.resolve(),
        }),
      },
    }))

    const { POST } = await import('@/app/api/weather-engine/route')
    const req = new Request('http://localhost/api/weather-engine', {
      method: 'POST',
      body: JSON.stringify({ complex_id: 1, event_id: 42 }),
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    await POST(req as unknown as import('next/server').NextRequest)

    // Plan 10-03 will add insertNotification — lightning uses event scope
    expect(localInsert).toHaveBeenCalledWith(
      42,
      'weather_alert',
      'event', // lightning = event scope
      null,
      expect.objectContaining({ title: expect.stringContaining('Lightning') })
    )
  })

  it('does not throw when insertNotification fails (non-fatal)', async () => {
    vi.resetModules()

    const failingInsert = vi.fn().mockRejectedValue(new Error('DB error'))
    vi.doMock('@/lib/notifications', () => ({ insertNotification: failingInsert }))
    vi.doMock('@/supabase/server', () => ({
      createClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
      }),
    }))
    vi.doMock('@/lib/engines/weather', () => ({
      runWeatherEngine: vi.fn().mockResolvedValue({
        reading: {},
        alerts: [
          {
            type: 'lightning',
            severity: 'critical',
            title: 'Lightning',
            description: 'desc',
            auto_action: null,
          },
        ],
        actions_taken: [],
        games_affected: 0,
        lightning_active: true,
        heat_protocol: 'none',
      }),
      getLatestReading: vi.fn(),
      getReadingHistory: vi.fn(),
    }))
    vi.doMock('@/lib/ratelimit', () => ({
      engineRatelimit: {
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: 0,
          pending: Promise.resolve(),
        }),
      },
    }))

    const { POST } = await import('@/app/api/weather-engine/route')
    const req = new Request('http://localhost/api/weather-engine', {
      method: 'POST',
      body: JSON.stringify({ complex_id: 1, event_id: 42 }),
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await POST(req as unknown as import('next/server').NextRequest)

    // Should still return 200 with weather data, not 500
    // (insertNotification errors must be non-fatal — Plan 10-03 must wrap in try/catch)
    expect(res.status).toBe(200)
  })
})
