import { z } from 'zod'

// POST /api/team-payments — create a team payment record
export const createTeamPaymentSchema = z.object({
  event_id: z.number().int().positive(),
  team_id: z.number().int().positive().nullable().optional(),
  team_name: z.string().min(1),
  division: z.string().min(1),
  amount_due: z.number().min(0),
  program_name: z.string().nullable().optional(),
  status: z.enum(['pending', 'partial', 'paid', 'waived']).optional(),
})

export type CreateTeamPaymentInput = z.infer<typeof createTeamPaymentSchema>

// PATCH /api/team-payments/[id] — update a team payment
export const updateTeamPaymentSchema = z.object({
  amount_due: z.number().min(0).optional(),
  amount_paid: z.number().min(0).optional(),
  status: z.enum(['pending', 'partial', 'paid', 'waived']).optional(),
  notes: z.string().optional(),
})

export type UpdateTeamPaymentInput = z.infer<typeof updateTeamPaymentSchema>

// POST /api/payment-entries — record a payment entry
export const createPaymentEntrySchema = z.object({
  team_payment_id: z.number().int().positive(),
  amount: z.number().min(0),
  payment_method: z.enum(['check', 'cash', 'bank_transfer', 'waived', 'other']),
  reference_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paid_at: z.string().datetime().optional(),
})

export type CreatePaymentEntryInput = z.infer<typeof createPaymentEntrySchema>
