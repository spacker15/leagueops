import { z } from 'zod'

// POST /api/registration-fees — create a registration fee tier
export const createRegistrationFeeSchema = z.object({
  event_id: z.number().int().positive(),
  division: z.string().min(1),
  amount: z.number().min(0),
  extra_game_ref_fee: z.number().min(0).default(0).optional(),
  extra_game_assigner_fee: z.number().min(0).default(0).optional(),
  currency: z.string().default('USD').optional(),
  description: z.string().optional(),
})

export type CreateRegistrationFeeInput = z.infer<typeof createRegistrationFeeSchema>

// PATCH /api/registration-fees/[id] — update a registration fee tier
export const updateRegistrationFeeSchema = z.object({
  division: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  extra_game_ref_fee: z.number().min(0).optional(),
  extra_game_assigner_fee: z.number().min(0).optional(),
  description: z.string().optional(),
})

export type UpdateRegistrationFeeInput = z.infer<typeof updateRegistrationFeeSchema>
