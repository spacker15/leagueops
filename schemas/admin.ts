import { z } from 'zod'

// POST /api/admin/create-user — create a new user with a role
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'league_admin', 'referee', 'volunteer', 'program_leader', 'coach']),
  event_id: z.number().int().positive(),
  display_name: z.string().optional(),
  referee_id: z.number().int().positive().optional(),
  volunteer_id: z.number().int().positive().optional(),
  program_id: z.number().int().positive().optional(),
  coach_id: z.number().int().positive().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
