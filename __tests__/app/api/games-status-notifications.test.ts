import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsertNotification = vi.fn().mockResolvedValue({ id: 1 })
vi.mock('@/lib/notifications', () => ({
  insertNotification: mockInsertNotification,
}))

// Mock Supabase — games route uses @/lib/supabase/server
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

// Mock Zod schema to always pass validation
vi.mock('@/schemas/games', () => ({
  updateGameSchema: {
    safeParse: (body: unknown) => ({ success: true, data: body }),
  },
}))

describe('Game Status Notifications (NOT-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertNotification.mockResolvedValue({ id: 1 })
  })

  it('fires admin_alert when game goes Live with no assigned referee (D-21)', async () => {
    vi.resetModules()

    const localInsert = vi.fn().mockResolvedValue({ id: 1 })
    vi.doMock('@/lib/notifications', () => ({ insertNotification: localInsert }))

    // Configure mock: auth succeeds, game update succeeds, no referees found
    const localFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'games') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => ({
                  data: {
                    id: 1,
                    event_id: 42,
                    home_team_id: 10,
                    away_team_id: 11,
                    status: 'Live',
                    game_date: '2026-04-01',
                    scheduled_time: '10:00',
                    field_id: 5,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              single: () => ({
                data: {
                  id: 1,
                  event_id: 42,
                  home_team_id: 10,
                  away_team_id: 11,
                  status: 'Live',
                  game_date: '2026-04-01',
                  scheduled_time: '10:00',
                  field_id: 5,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'game_referees') {
        return { select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }) }
      }
      return { select: () => ({ eq: () => ({ data: [], error: null }) }) }
    })

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        },
        from: localFrom,
      }),
    }))

    vi.doMock('@/schemas/games', () => ({
      updateGameSchema: {
        safeParse: (body: unknown) => ({ success: true, data: body }),
      },
    }))

    const { PATCH } = await import('@/app/api/games/[id]/route')
    const req = new Request('http://localhost/api/games/1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Live' }),
    })
    await PATCH(req as unknown as import('next/server').NextRequest, { params: { id: '1' } })

    expect(localInsert).toHaveBeenCalledWith(
      42,
      'admin_alert',
      'event',
      null,
      expect.objectContaining({ title: expect.stringContaining('Referee') })
    )
  })

  it('fires registration deadline warning when within 48h and open registrations exist (D-22)', async () => {
    vi.resetModules()

    const localInsert = vi.fn().mockResolvedValue({ id: 1 })
    vi.doMock('@/lib/notifications', () => ({ insertNotification: localInsert }))

    const closingSoon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const localFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'games') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => ({
                  data: { id: 1, event_id: 42, status: 'Scheduled', game_date: '2026-04-01' },
                  error: null,
                }),
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: 1, event_id: 42, status: 'Scheduled', game_date: '2026-04-01' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: 42, registration_closes_at: closingSoon },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'team_registrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({ data: [{ id: 1 }], error: null }),
              }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ data: [], error: null }) }) }
    })

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        },
        from: localFrom,
      }),
    }))

    vi.doMock('@/schemas/games', () => ({
      updateGameSchema: {
        safeParse: (body: unknown) => ({ success: true, data: body }),
      },
    }))

    const { PATCH } = await import('@/app/api/games/[id]/route')
    const req = new Request('http://localhost/api/games/1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Scheduled' }),
    })
    await PATCH(req as unknown as import('next/server').NextRequest, { params: { id: '1' } })

    expect(localInsert).toHaveBeenCalledWith(
      42,
      'admin_alert',
      'event',
      null,
      expect.objectContaining({ title: expect.stringContaining('Registration') })
    )
  })
})
