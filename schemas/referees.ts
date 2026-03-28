import { z } from 'zod'

// POST /api/referees — create a referee
export const createRefereeSchema = z.object({
  event_id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  certification: z.string().optional(),
  is_active: z.boolean().optional(),
})

export type CreateRefereeInput = z.infer<typeof createRefereeSchema>

// PATCH /api/referees/[id] — update a referee (partial)
export const updateRefereeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  certification: z.string().optional(),
  is_active: z.boolean().optional(),
})

export type UpdateRefereeInput = z.infer<typeof updateRefereeSchema>
