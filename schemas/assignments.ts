import { z } from 'zod'

// POST /api/assignments — upsert a referee assignment to a game
export const createAssignmentSchema = z.object({
  game_id: z.number().int().positive(),
  referee_id: z.number().int().positive(),
  position: z.string().optional(),
})

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>

// DELETE /api/assignments — remove a referee assignment
export const deleteAssignmentSchema = z.object({
  game_id: z.number().int().positive(),
  referee_id: z.number().int().positive(),
})

export type DeleteAssignmentInput = z.infer<typeof deleteAssignmentSchema>
