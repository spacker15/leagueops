import { z } from 'zod'

// POST /api/games — create a game
export const createGameSchema = z.object({
  event_id: z.number().int().positive(),
  event_date_id: z.number().int().positive(),
  field_id: z.number().int().positive(),
  home_team_id: z.number().int().positive(),
  away_team_id: z.number().int().positive(),
  scheduled_time: z.string().datetime(),
  division: z.string().min(1),
  status: z.enum(['Scheduled', 'Live', 'Final', 'Delayed', 'Suspended', 'Cancelled']).optional(),
})

export type CreateGameInput = z.infer<typeof createGameSchema>

// PATCH /api/games/[id] — update a game (partial)
export const updateGameSchema = z.object({
  status: z
    .enum([
      'Scheduled',
      'Starting',
      'Live',
      'Halftime',
      'Final',
      'Delayed',
      'Suspended',
      'Cancelled',
    ])
    .optional(),
  home_score: z.number().int().min(0).optional(),
  away_score: z.number().int().min(0).optional(),
  field_id: z.number().int().positive().optional(),
  scheduled_time: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export type UpdateGameInput = z.infer<typeof updateGameSchema>
