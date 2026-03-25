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

describe('Direct Game Cancellation Notifications (NOT-03 gap)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertNotification.mockResolvedValue({ id: 1 })
  })

  it('fires schedule_change notification to both teams on direct cancellation', async () => {
    vi.resetModules()

    const localInsert = vi.fn().mockResolvedValue({ id: 1 })
    vi.doMock('@/lib/notifications', () => ({ insertNotification: localInsert }))

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
                    status: 'Cancelled',
                    game_date: '2026-04-01',
                    scheduled_time: '10:00',
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
                  status: 'Cancelled',
                  game_date: '2026-04-01',
                  scheduled_time: '10:00',
                },
                error: null,
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
      body: JSON.stringify({ status: 'Cancelled' }),
    })
    await PATCH(req as unknown as import('next/server').NextRequest, { params: { id: '1' } })

    // Should notify both teams
    expect(localInsert).toHaveBeenCalledWith(
      42,
      'schedule_change',
      'team',
      10, // home team
      expect.objectContaining({ title: expect.stringContaining('CANCELLED') })
    )
    expect(localInsert).toHaveBeenCalledWith(
      42,
      'schedule_change',
      'team',
      11, // away team
      expect.objectContaining({ title: expect.stringContaining('CANCELLED') })
    )
  })
})
