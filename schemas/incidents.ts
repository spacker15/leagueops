import { z } from 'zod'

// POST /api/incidents — log a game incident
export const createIncidentSchema = z.object({
  event_id: z.number().int().positive(),
  game_id: z.number().int().positive().optional(),
  field_id: z.number().int().positive().optional(),
  team_id: z.number().int().positive().optional(),
  type: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  reported_by: z.string().optional(),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>

// POST /api/medical — log a medical incident
export const createMedicalIncidentSchema = z.object({
  event_id: z.number().int().positive(),
  game_id: z.number().int().positive().optional(),
  field_id: z.number().int().positive().optional(),
  player_name: z.string().min(1),
  description: z.string().min(1),
  action_taken: z.string().optional(),
  transported: z.boolean().optional(),
})

export type CreateMedicalIncidentInput = z.infer<typeof createMedicalIncidentSchema>
