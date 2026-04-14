import { z } from 'zod'

export const createScheduleChangeRequestSchema = z.object({
  team_id: z.number().int().positive(),
  request_type: z.enum(['cancel', 'reschedule', 'change_opponent']),
  reason_category: z.enum([
    'Coach conflict',
    'Team conflict',
    'Weather concern',
    'Venue issue',
    'Opponent issue',
    'Other',
  ]),
  reason_details: z.string().max(1000).optional().nullable(),
  game_ids: z.array(z.number().int().positive()).min(1, 'At least one game must be selected'),
})

export const updateScheduleChangeRequestSchema = z.object({
  status: z.enum(['under_review', 'approved', 'denied']),
  admin_notes: z.string().max(1000).optional().nullable(),
})

export type CreateScheduleChangeRequest = z.infer<typeof createScheduleChangeRequestSchema>
export type UpdateScheduleChangeRequest = z.infer<typeof updateScheduleChangeRequestSchema>
