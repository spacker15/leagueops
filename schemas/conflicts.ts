import { z } from 'zod'

// PATCH /api/conflicts — resolve an operational conflict
export const resolveConflictSchema = z.object({
  id: z.number().int().positive(),
  resolved: z.boolean(),
  resolution_note: z.string().optional(),
})

export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>
