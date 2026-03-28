import { z } from 'zod'

// POST /api/volunteers — create a volunteer
export const createVolunteerSchema = z.object({
  event_id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
})

export type CreateVolunteerInput = z.infer<typeof createVolunteerSchema>

// PATCH /api/volunteers/[id] — update a volunteer (partial)
export const updateVolunteerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
})

export type UpdateVolunteerInput = z.infer<typeof updateVolunteerSchema>
