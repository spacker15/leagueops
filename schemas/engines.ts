import { z } from 'zod'

// POST /api/schedule-engine — trigger schedule generation
export const scheduleEngineSchema = z.object({
  event_id: z.number().int().positive(),
  dry_run: z.boolean().optional(),
})

export type ScheduleEngineInput = z.infer<typeof scheduleEngineSchema>

// POST /api/referee-engine — run referee conflict detection
export const refereeEngineSchema = z.object({
  event_id: z.number().int().positive(),
  event_date_id: z.number().int().positive(),
})

export type RefereeEngineInput = z.infer<typeof refereeEngineSchema>

// POST /api/field-engine — run field conflict engine
export const fieldEngineSchema = z.object({
  event_id: z.number().int().positive(),
  event_date_id: z.number().int().positive().optional(),
  action: z.enum(['scan', 'resolve']).optional(),
  conflict_id: z.number().int().positive().optional(),
  resolution_action: z.string().optional(),
  resolution_params: z.record(z.string(), z.unknown()).optional(),
})

export type FieldEngineInput = z.infer<typeof fieldEngineSchema>

// POST /api/weather-engine — run weather engine
export const weatherEngineSchema = z.object({
  event_id: z.number().int().positive(),
  complex_id: z.number().int().positive(),
  api_key: z.string().optional(),
})

export type WeatherEngineInput = z.infer<typeof weatherEngineSchema>

// POST /api/unified-engine — run all engines
export const unifiedEngineSchema = z.object({
  event_id: z.number().int().positive(),
  event_date_id: z.number().int().positive(),
})

export type UnifiedEngineInput = z.infer<typeof unifiedEngineSchema>

// POST /api/unified-engine/resolve — resolve an ops alert
export const resolveAlertSchema = z.object({
  alert_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
  resolved_by: z.string().min(1),
  note: z.string().optional(),
})

export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>

// POST /api/shift-handoff — generate shift handoff report
export const shiftHandoffSchema = z.object({
  event_id: z.number().int().positive(),
  created_by: z.string().min(1),
})

export type ShiftHandoffInput = z.infer<typeof shiftHandoffSchema>
