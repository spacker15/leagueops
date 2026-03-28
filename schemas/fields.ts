import { z } from 'zod'

// POST /api/fields — create a field
export const createFieldSchema = z.object({
  event_id: z.number().int().positive(),
  name: z.string().min(1),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
})

export type CreateFieldInput = z.infer<typeof createFieldSchema>

// PATCH /api/fields/[id] — update a field (partial)
export const updateFieldSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  status: z.string().optional(),
})

export type UpdateFieldInput = z.infer<typeof updateFieldSchema>
