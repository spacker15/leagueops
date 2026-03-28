# Route Inventory — Phase 03

Generated: 2026-03-23

## Classification Rules

- **write**: POST/PATCH/PUT/DELETE + auth required → gets auth guard (SEC-02) + Zod validation (SEC-07)
- **read-authenticated**: GET + auth required → gets auth guard (SEC-02)
- **public**: No auth guard → gets documentation comment (SEC-02) + rate limiting (SEC-08)
- **engine-trigger**: Internal trigger routes → gets auth guard (SEC-02) + rate limiting (SEC-08)

## Routes

| Route                       | File Path                               | Methods                | Category           | Auth Guard                  | Zod Schema                                                   | Rate Limit |
| --------------------------- | --------------------------------------- | ---------------------- | ------------------ | --------------------------- | ------------------------------------------------------------ | ---------- |
| /api/admin/create-user      | app/api/admin/create-user/route.ts      | POST                   | write              | YES (admin-only)            | YES (createUserSchema)                                       | NO         |
| /api/assignments            | app/api/assignments/route.ts            | GET, POST, DELETE      | write              | NO                          | YES (createAssignmentSchema, deleteAssignmentSchema)         | NO         |
| /api/auth/check-email       | app/api/auth/check-email/route.ts       | POST                   | public             | NO (registration flow)      | NO                                                           | YES        |
| /api/auth/program-prefill   | app/api/auth/program-prefill/route.ts   | GET                    | read-authenticated | YES (session check)         | NO                                                           | NO         |
| /api/checkins               | app/api/checkins/route.ts               | GET, POST, DELETE      | public             | NO (token-gated by QR)      | NO                                                           | YES        |
| /api/conflicts              | app/api/conflicts/route.ts              | GET, PATCH             | write              | NO                          | YES (resolveConflictSchema)                                  | NO         |
| /api/eligibility            | app/api/eligibility/route.ts            | GET, POST              | write              | NO                          | NO                                                           | NO         |
| /api/field-engine           | app/api/field-engine/route.ts           | POST                   | engine-trigger     | NO                          | YES (fieldEngineSchema)                                      | YES        |
| /api/fields                 | app/api/fields/route.ts                 | GET, POST              | write              | NO                          | YES (createFieldSchema)                                      | NO         |
| /api/fields/[id]            | app/api/fields/[id]/route.ts            | PATCH                  | write              | NO                          | YES (updateFieldSchema)                                      | NO         |
| /api/games                  | app/api/games/route.ts                  | GET, POST              | write              | NO                          | YES (createGameSchema)                                       | NO         |
| /api/games/[id]             | app/api/games/[id]/route.ts             | GET, PATCH, DELETE     | write              | NO                          | YES (updateGameSchema)                                       | NO         |
| /api/incidents              | app/api/incidents/route.ts              | GET, POST              | write              | NO                          | YES (createIncidentSchema)                                   | NO         |
| /api/join                   | app/api/join/route.ts                   | GET, POST              | public             | NO (token-validated invite) | NO                                                           | YES        |
| /api/lightning              | app/api/lightning/route.ts              | GET, POST              | write              | NO                          | NO                                                           | NO         |
| /api/maps/autocomplete      | app/api/maps/autocomplete/route.ts      | GET                    | read-authenticated | NO (server-side key proxy)  | NO                                                           | NO         |
| /api/maps/details           | app/api/maps/details/route.ts           | GET                    | read-authenticated | NO (server-side key proxy)  | NO                                                           | NO         |
| /api/medical                | app/api/medical/route.ts                | GET, POST              | write              | NO                          | YES (createMedicalIncidentSchema)                            | NO         |
| /api/ops-log                | app/api/ops-log/route.ts                | GET, POST              | write              | NO                          | NO                                                           | NO         |
| /api/payment-entries        | app/api/payment-entries/route.ts        | GET, POST              | write              | NO                          | YES (createPaymentEntrySchema)                               | NO         |
| /api/players                | app/api/players/route.ts                | GET, POST, PUT, DELETE | write              | NO                          | NO                                                           | NO         |
| /api/referee-engine         | app/api/referee-engine/route.ts         | POST                   | engine-trigger     | NO                          | YES (refereeEngineSchema)                                    | YES        |
| /api/referees               | app/api/referees/route.ts               | GET, POST              | write              | NO                          | YES (createRefereeSchema)                                    | NO         |
| /api/referees/[id]          | app/api/referees/[id]/route.ts          | PATCH                  | write              | NO                          | YES (updateRefereeSchema)                                    | NO         |
| /api/registration-fees      | app/api/registration-fees/route.ts      | GET, POST              | write              | NO                          | YES (createRegistrationFeeSchema)                            | NO         |
| /api/registration-fees/[id] | app/api/registration-fees/[id]/route.ts | PATCH                  | write              | NO                          | YES (updateRegistrationFeeSchema)                            | NO         |
| /api/rules                  | app/api/rules/route.ts                  | GET, PATCH, POST       | write              | NO                          | YES (updateRuleSchema, resetRuleSchema)                      | NO         |
| /api/rules/changes          | app/api/rules/changes/route.ts          | GET                    | read-authenticated | NO                          | NO                                                           | NO         |
| /api/schedule-audit         | app/api/schedule-audit/route.ts         | GET                    | read-authenticated | NO                          | NO                                                           | NO         |
| /api/schedule-engine        | app/api/schedule-engine/route.ts        | POST                   | engine-trigger     | NO                          | YES (scheduleEngineSchema)                                   | YES        |
| /api/schedule-rules         | app/api/schedule-rules/route.ts         | GET, POST, PUT, DELETE | write              | NO                          | YES (createScheduleRuleSchema, updateScheduleRuleSchema)     | NO         |
| /api/shift-handoff          | app/api/shift-handoff/route.ts          | POST                   | engine-trigger     | NO                          | YES (shiftHandoffSchema)                                     | YES        |
| /api/team-payments          | app/api/team-payments/route.ts          | GET, POST              | write              | NO                          | YES (createTeamPaymentSchema)                                | NO         |
| /api/team-payments/[id]     | app/api/team-payments/[id]/route.ts     | GET, PATCH             | write              | NO                          | YES (updateTeamPaymentSchema)                                | NO         |
| /api/teams                  | app/api/teams/route.ts                  | GET                    | read-authenticated | NO                          | NO                                                           | NO         |
| /api/unified-engine         | app/api/unified-engine/route.ts         | POST                   | engine-trigger     | NO                          | YES (unifiedEngineSchema)                                    | YES        |
| /api/unified-engine/resolve | app/api/unified-engine/resolve/route.ts | POST                   | write              | NO                          | YES (resolveAlertSchema)                                     | NO         |
| /api/volunteers             | app/api/volunteers/route.ts             | GET, POST              | write              | NO                          | YES (createVolunteerSchema)                                  | NO         |
| /api/volunteers/[id]        | app/api/volunteers/[id]/route.ts        | PATCH                  | write              | NO                          | YES (updateVolunteerSchema)                                  | NO         |
| /api/weather                | app/api/weather/route.ts                | GET                    | read-authenticated | NO                          | NO                                                           | NO         |
| /api/weather-engine         | app/api/weather-engine/route.ts         | POST                   | engine-trigger     | NO                          | YES (weatherEngineSchema)                                    | YES        |
| /api/weekly-overrides       | app/api/weekly-overrides/route.ts       | GET, POST, PUT, DELETE | write              | NO                          | YES (createWeeklyOverrideSchema, updateWeeklyOverrideSchema) | NO         |

## Summary

| Category           | Count  |
| ------------------ | ------ |
| write              | 29     |
| read-authenticated | 7      |
| public             | 3      |
| engine-trigger     | 7      |
| **Total**          | **46** |

## Notes

- **Auth Guard = YES (admin-only)**: `/api/admin/create-user` already has an auth check — existing guards preserved.
- **Auth Guard = YES (session check)**: `/api/auth/program-prefill` already checks `sb.auth.getUser()` in the handler.
- **Public routes**: `/api/join`, `/api/checkins`, and `/api/auth/check-email` are intentionally unauthenticated — they serve token-gated or registration flows. They will get rate limiting (SEC-08) instead of auth guards.
- **Auth Guard = NO (server-side key proxy)**: `/api/maps/autocomplete` and `/api/maps/details` proxy Google Maps server-side. They could be protected but are low-risk (no user data exposed). Rate limiting is recommended if auth is not added.
- **Zod Schema = NO for players/eligibility/lightning/ops-log**: These routes pass the body directly to Supabase without a fixed shape; schemas can be added in a follow-up plan when their contracts are better defined.
