import { z } from 'zod'

// POST /api/admin/create-user — create a new user with a role
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([
    'admin',
    'league_admin',
    'referee',
    'volunteer',
    'program_leader',
    'coach',
    'trainer',
  ]),
  event_id: z.number().int().positive(),
  display_name: z.string().optional(),
  referee_id: z.number().int().positive().nullable().optional(),
  volunteer_id: z.number().int().positive().nullable().optional(),
  program_id: z.number().int().positive().nullable().optional(),
  coach_id: z.number().int().positive().nullable().optional(),
  trainer_id: z.number().int().positive().nullable().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// POST /api/admin/update-user — update user details and/or reset password
export const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.number().int().positive(),
  password: z.string().min(8).optional(),
  display_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
