// Zod schema barrel — Phase 03 API Auth & Validation
// Each domain schema file corresponds to write routes that require body validation

export { createAssignmentSchema, deleteAssignmentSchema } from './assignments'
export type { CreateAssignmentInput, DeleteAssignmentInput } from './assignments'

export { createGameSchema, updateGameSchema } from './games'
export type { CreateGameInput, UpdateGameInput } from './games'

export { createIncidentSchema, createMedicalIncidentSchema } from './incidents'
export type { CreateIncidentInput, CreateMedicalIncidentInput } from './incidents'

export { createFieldSchema, updateFieldSchema } from './fields'
export type { CreateFieldInput, UpdateFieldInput } from './fields'

export { createRefereeSchema, updateRefereeSchema } from './referees'
export type { CreateRefereeInput, UpdateRefereeInput } from './referees'

export { createVolunteerSchema, updateVolunteerSchema } from './volunteers'
export type { CreateVolunteerInput, UpdateVolunteerInput } from './volunteers'

export {
  createTeamPaymentSchema,
  updateTeamPaymentSchema,
  createPaymentEntrySchema,
} from './payments'
export type {
  CreateTeamPaymentInput,
  UpdateTeamPaymentInput,
  CreatePaymentEntryInput,
} from './payments'

export {
  updateRuleSchema,
  resetRuleSchema,
  createScheduleRuleSchema,
  updateScheduleRuleSchema,
  createWeeklyOverrideSchema,
  updateWeeklyOverrideSchema,
} from './rules'
export type {
  UpdateRuleInput,
  ResetRuleInput,
  CreateScheduleRuleInput,
  UpdateScheduleRuleInput,
  CreateWeeklyOverrideInput,
  UpdateWeeklyOverrideInput,
} from './rules'

export {
  scheduleEngineSchema,
  refereeEngineSchema,
  fieldEngineSchema,
  weatherEngineSchema,
  unifiedEngineSchema,
  resolveAlertSchema,
  shiftHandoffSchema,
} from './engines'
export type {
  ScheduleEngineInput,
  RefereeEngineInput,
  FieldEngineInput,
  WeatherEngineInput,
  UnifiedEngineInput,
  ResolveAlertInput,
  ShiftHandoffInput,
} from './engines'

export { createUserSchema } from './admin'
export type { CreateUserInput } from './admin'

export { resolveConflictSchema } from './conflicts'
export type { ResolveConflictInput } from './conflicts'

export { createRegistrationFeeSchema, updateRegistrationFeeSchema } from './registration-fees'
export type { CreateRegistrationFeeInput, UpdateRegistrationFeeInput } from './registration-fees'
