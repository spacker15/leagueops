import { z } from 'zod'

// PATCH /api/rules — update a single rule value
export const updateRuleSchema = z.object({
  id: z.number().int().positive(),
  event_id: z.number().int().positive(),
  rule_value: z.union([z.string(), z.number(), z.boolean()]),
  changed_by: z.string().optional(),
})

export type UpdateRuleInput = z.infer<typeof updateRuleSchema>

// POST /api/rules — reset rule(s) to defaults
export const resetRuleSchema = z.object({
  event_id: z.number().int().positive(),
  action: z.enum(['reset_one', 'reset_all']),
  id: z.number().int().positive().optional(),
})

export type ResetRuleInput = z.infer<typeof resetRuleSchema>

// POST /api/schedule-rules — create a schedule rule
export const createScheduleRuleSchema = z.object({
  event_id: z.number().int().positive(),
  scope: z.enum(['global', 'division', 'program', 'team', 'week', 'season']),
  type: z.enum(['constraint', 'preference']),
  priority: z.number().int().min(0),
  conditions: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
})

export type CreateScheduleRuleInput = z.infer<typeof createScheduleRuleSchema>

// PUT /api/schedule-rules — update a schedule rule
export const updateScheduleRuleSchema = z.object({
  id: z.number().int().positive(),
  scope: z.enum(['global', 'division', 'program', 'team', 'week', 'season']).optional(),
  type: z.enum(['constraint', 'preference']).optional(),
  priority: z.number().int().min(0).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  description: z.string().optional(),
})

export type UpdateScheduleRuleInput = z.infer<typeof updateScheduleRuleSchema>

// POST /api/weekly-overrides — create a weekly override
export const createWeeklyOverrideSchema = z.object({
  event_id: z.number().int().positive(),
  week_number: z.number().int().positive().optional(),
  override_date: z.string().datetime().optional(),
  overrides: z.record(z.string(), z.unknown()),
})

export type CreateWeeklyOverrideInput = z.infer<typeof createWeeklyOverrideSchema>

// PUT /api/weekly-overrides — update a weekly override
export const updateWeeklyOverrideSchema = z.object({
  id: z.number().int().positive(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  week_number: z.number().int().positive().optional(),
})

export type UpdateWeeklyOverrideInput = z.infer<typeof updateWeeklyOverrideSchema>
