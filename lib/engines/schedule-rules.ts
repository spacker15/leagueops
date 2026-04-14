/**
 * LeagueOps — Schedule Rule Evaluator
 *
 * Loads configurable schedule rules from the database and evaluates them
 * against candidate matchups and slot placements during schedule generation.
 * Follows the caching pattern from rules.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────

export interface ScheduleRule {
  id: number
  event_id: number
  rule_name: string
  rule_type: 'constraint' | 'preference' | 'override' | 'forced_matchup'
  category: 'global' | 'division' | 'program' | 'team' | 'weekly' | 'season'
  scope_division: string | null
  scope_program_id: number | null
  scope_team_id: number | null
  scope_week: number | null
  scope_event_date_id: number | null
  conditions: Record<string, unknown>
  action: 'block' | 'allow' | 'force' | 'warn' | 'set_param'
  action_params: Record<string, unknown>
  priority: number
  enforcement: 'hard' | 'soft' | 'info'
  enabled: boolean
  notes: string | null
}

export interface WeeklyOverride {
  id: number
  event_id: number
  event_date_id: number | null
  override_type:
    | 'skip_date'
    | 'force_matchup'
    | 'remove_matchup'
    | 'team_unavailable'
    | 'special_event'
  team_id: number | null
  home_team_id: number | null
  away_team_id: number | null
  params: Record<string, unknown>
  enabled: boolean
  notes: string | null
}

export interface RuleOverride {
  id: number
  event_id: number
  rule_id: number
  scope_type: 'game' | 'matchup' | 'team' | 'week' | 'global'
  scope_team_id: number | null
  scope_event_date_id: number | null
  home_team_id: number | null
  away_team_id: number | null
  override_action: 'allow' | 'block'
  reason: string
  enabled: boolean
}

export interface TeamInfo {
  id: number
  name: string
  division: string
  program_id: number | null
  program_name: string | null
}

export interface SlotInfo {
  eventDateId: number
  fieldId: number
  fieldName: string
  timeMinutes: number
  weekNumber: number
  date: string
}

export interface PlacedGame {
  event_date_id: number
  field_id: number
  home_team_id: number
  away_team_id: number
  division: string
  scheduled_time: string
  timeMinutes: number
  weekNumber: number
}

export interface RuleEvaluation {
  passed: boolean
  rule: ScheduleRule
  reason: string
}

export interface EvalResult {
  allowed: boolean
  evaluations: RuleEvaluation[]
  penalties: number
  blockingRule: ScheduleRule | null
}

export interface ScheduleContext {
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  slot: SlotInfo
  placedGames: PlacedGame[]
  teamGameCounts: Map<number, number> // teamId -> total games placed
  teamDayGameCounts: Map<string, number> // "teamId-dateId" -> games that day
  teamLastGameEnd: Map<string, number> // "teamId-dateId" -> last game end time in minutes
  matchupHistory: Map<string, number[]> // "min(teamA,teamB)-max(teamA,teamB)" -> weekNumbers
  skippedDates: Set<number> // event_date_ids to skip
  teamProgramMap: Map<number, { id: number; name: string }>
}

// ─── Cache (follows rules.ts pattern) ─────────────────────────

const _ruleCache = new Map<number, { rules: ScheduleRule[]; time: number }>()
const _overrideCache = new Map<number, { overrides: WeeklyOverride[]; time: number }>()
const CACHE_TTL_MS = 30_000

export function invalidateScheduleRulesCache(eventId: number) {
  _ruleCache.delete(eventId)
  _overrideCache.delete(eventId)
}

// ─── Load Functions ───────────────────────────────────────────

export async function loadScheduleRules(
  eventId: number,
  sb: SupabaseClient
): Promise<ScheduleRule[]> {
  const now = Date.now()
  const cached = _ruleCache.get(eventId)
  if (cached && now - cached.time < CACHE_TTL_MS) return cached.rules

  const { data, error } = await sb
    .from('schedule_rules')
    .select('*')
    .eq('event_id', eventId)
    .eq('enabled', true)
    .order('priority', { ascending: true })

  if (error) throw new Error(`Failed to load schedule rules: ${error.message}`)
  const rules = (data ?? []) as ScheduleRule[]
  _ruleCache.set(eventId, { rules, time: now })
  return rules
}

export async function loadWeeklyOverrides(
  eventId: number,
  sb: SupabaseClient
): Promise<WeeklyOverride[]> {
  const now = Date.now()
  const cached = _overrideCache.get(eventId)
  if (cached && now - cached.time < CACHE_TTL_MS) return cached.overrides

  const { data, error } = await sb
    .from('weekly_overrides')
    .select('*')
    .eq('event_id', eventId)
    .eq('enabled', true)

  if (error) throw new Error(`Failed to load weekly overrides: ${error.message}`)
  const overrides = (data ?? []) as WeeklyOverride[]
  _overrideCache.set(eventId, { overrides, time: now })
  return overrides
}

export async function loadTeamProgramMap(
  eventId: number,
  sb: SupabaseClient
): Promise<Map<number, { id: number; name: string }>> {
  const { data } = await sb
    .from('teams')
    .select('id, program_id, programs(name)')
    .eq('event_id', eventId)
    .not('program_id', 'is', null)

  const map = new Map<number, { id: number; name: string }>()
  for (const row of (data ?? []) as any[]) {
    if (row.program_id) {
      map.set(row.id, { id: row.program_id, name: row.programs?.name ?? '' })
    }
  }
  return map
}

// ─── Load Rule Overrides ──────────────────────────────────────

export async function loadRuleOverrides(
  eventId: number,
  sb: SupabaseClient
): Promise<RuleOverride[]> {
  const { data } = await sb
    .from('schedule_rule_overrides')
    .select('*')
    .eq('event_id', eventId)
    .eq('enabled', true)
  return (data ?? []) as RuleOverride[]
}

// ─── Rule Scope Check ─────────────────────────────────────────

function ruleAppliesToMatchup(rule: ScheduleRule, ctx: ScheduleContext): boolean {
  // Division scope
  if (rule.scope_division && rule.scope_division !== ctx.homeTeam.division) return false

  // Program scope - check if either team belongs to the scoped program
  if (rule.scope_program_id) {
    const homeProgram = ctx.teamProgramMap.get(ctx.homeTeam.id)
    const awayProgram = ctx.teamProgramMap.get(ctx.awayTeam.id)
    if (homeProgram?.id !== rule.scope_program_id && awayProgram?.id !== rule.scope_program_id)
      return false
  }

  // Team scope
  if (rule.scope_team_id) {
    if (ctx.homeTeam.id !== rule.scope_team_id && ctx.awayTeam.id !== rule.scope_team_id)
      return false
  }

  // Week scope
  if (rule.scope_week !== null && rule.scope_week !== undefined) {
    if (ctx.slot.weekNumber !== rule.scope_week) return false
  }

  // Date scope
  if (rule.scope_event_date_id) {
    if (ctx.slot.eventDateId !== rule.scope_event_date_id) return false
  }

  return true
}

// ─── Condition Evaluators ─────────────────────────────────────

function evaluateCondition(
  rule: ScheduleRule,
  ctx: ScheduleContext
): { passed: boolean; reason: string } {
  const cond = rule.conditions as Record<string, any>
  const type = cond.type as string

  switch (type) {
    case 'same_division_only': {
      if (ctx.homeTeam.division !== ctx.awayTeam.division) {
        return {
          passed: false,
          reason: `${ctx.homeTeam.name} (${ctx.homeTeam.division}) vs ${ctx.awayTeam.name} (${ctx.awayTeam.division}) — different divisions`,
        }
      }
      return { passed: true, reason: 'Same division' }
    }

    case 'same_program_block': {
      const homeProgram = ctx.teamProgramMap.get(ctx.homeTeam.id)
      const awayProgram = ctx.teamProgramMap.get(ctx.awayTeam.id)
      if (homeProgram && awayProgram && homeProgram.id === awayProgram.id) {
        // Check if there's a program-specific name in conditions
        const programName = cond.program_name as string | undefined
        if (programName) {
          if (homeProgram.name !== programName)
            return { passed: true, reason: 'Different program from rule target' }
        }
        return {
          passed: false,
          reason: `${ctx.homeTeam.name} and ${ctx.awayTeam.name} are both in program "${homeProgram.name}"`,
        }
      }
      return { passed: true, reason: 'Different programs' }
    }

    case 'no_back_to_back': {
      const dateId = ctx.slot.eventDateId
      const homeKey = `${ctx.homeTeam.id}-${dateId}`
      const awayKey = `${ctx.awayTeam.id}-${dateId}`
      const homeLastEnd = ctx.teamLastGameEnd.get(homeKey)
      const awayLastEnd = ctx.teamLastGameEnd.get(awayKey)

      if (homeLastEnd !== undefined && ctx.slot.timeMinutes === homeLastEnd) {
        return {
          passed: false,
          reason: `${ctx.homeTeam.name} has back-to-back games (ends at ${homeLastEnd}, next starts at ${ctx.slot.timeMinutes})`,
        }
      }
      if (awayLastEnd !== undefined && ctx.slot.timeMinutes === awayLastEnd) {
        return { passed: false, reason: `${ctx.awayTeam.name} has back-to-back games` }
      }
      return { passed: true, reason: 'No back-to-back conflict' }
    }

    case 'min_rest': {
      const minRest = (cond.minutes as number) ?? 60
      const dateId = ctx.slot.eventDateId
      const homeKey = `${ctx.homeTeam.id}-${dateId}`
      const awayKey = `${ctx.awayTeam.id}-${dateId}`
      const homeLastEnd = ctx.teamLastGameEnd.get(homeKey)
      const awayLastEnd = ctx.teamLastGameEnd.get(awayKey)

      if (homeLastEnd !== undefined) {
        const rest = ctx.slot.timeMinutes - homeLastEnd
        if (rest >= 0 && rest < minRest) {
          return {
            passed: false,
            reason: `${ctx.homeTeam.name} only has ${rest}min rest (need ${minRest}min)`,
          }
        }
      }
      if (awayLastEnd !== undefined) {
        const rest = ctx.slot.timeMinutes - awayLastEnd
        if (rest >= 0 && rest < minRest) {
          return {
            passed: false,
            reason: `${ctx.awayTeam.name} only has ${rest}min rest (need ${minRest}min)`,
          }
        }
      }
      return { passed: true, reason: 'Sufficient rest' }
    }

    case 'doubleheader_spacing': {
      const preferred = ((cond.preferred_hours as number) ?? 2) * 60
      const max = ((cond.max_hours as number) ?? 3) * 60
      const dateId = ctx.slot.eventDateId

      for (const teamId of [ctx.homeTeam.id, ctx.awayTeam.id]) {
        const key = `${teamId}-${dateId}`
        const lastEnd = ctx.teamLastGameEnd.get(key)
        if (lastEnd !== undefined) {
          const gap = ctx.slot.timeMinutes - lastEnd
          if (gap > max) {
            return { passed: false, reason: `Double-header gap ${gap}min exceeds max ${max}min` }
          }
          if (gap > preferred) {
            return {
              passed: true,
              reason: `Double-header gap ${gap}min exceeds preferred ${preferred}min (but within max)`,
            }
          }
        }
      }
      return { passed: true, reason: 'Double-header spacing OK' }
    }

    case 'rematch_spacing': {
      const minWeeks = (cond.min_weeks as number) ?? 3
      const matchKey = `${Math.min(ctx.homeTeam.id, ctx.awayTeam.id)}-${Math.max(ctx.homeTeam.id, ctx.awayTeam.id)}`
      const prevWeeks = ctx.matchupHistory.get(matchKey)
      if (prevWeeks && prevWeeks.length > 0) {
        const lastWeek = Math.max(...prevWeeks)
        const gap = ctx.slot.weekNumber - lastWeek
        if (gap < minWeeks) {
          return {
            passed: false,
            reason: `Rematch too soon: played week ${lastWeek}, now week ${ctx.slot.weekNumber} (need ${minWeeks} week gap)`,
          }
        }
      }
      return { passed: true, reason: 'Rematch spacing OK' }
    }

    case 'field_division_check': {
      // This is handled by the existing fieldAllowsDivision() in the engine
      // The rule exists for traceability but actual check is in the slot assignment
      return { passed: true, reason: 'Field-division check delegated to engine' }
    }

    case 'time_restriction': {
      const blockedTimes = (cond.blocked_times as string[]) ?? []
      const programName = cond.program_name as string | undefined

      // Check if either team belongs to the restricted program
      if (programName) {
        const homeProgram = ctx.teamProgramMap.get(ctx.homeTeam.id)
        const awayProgram = ctx.teamProgramMap.get(ctx.awayTeam.id)
        const applies = homeProgram?.name === programName || awayProgram?.name === programName
        if (!applies) return { passed: true, reason: `Teams not in program ${programName}` }
      }

      // Convert slot time to display format for comparison
      const h = Math.floor(ctx.slot.timeMinutes / 60)
      const m = ctx.slot.timeMinutes % 60
      const ampm = h >= 12 ? 'PM' : 'AM'
      const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
      const timeStr = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`

      if (blockedTimes.includes(timeStr)) {
        return { passed: false, reason: `${programName ?? 'Team'} cannot play at ${timeStr}` }
      }
      return { passed: true, reason: `Time ${timeStr} not blocked` }
    }

    case 'team_availability': {
      const availableDates = (cond.available_dates as string[]) ?? []
      const programName = cond.program_name as string | undefined

      if (programName) {
        const homeProgram = ctx.teamProgramMap.get(ctx.homeTeam.id)
        const awayProgram = ctx.teamProgramMap.get(ctx.awayTeam.id)
        const applies = homeProgram?.name === programName || awayProgram?.name === programName
        if (!applies) return { passed: true, reason: `Teams not in program ${programName}` }
      }

      if (availableDates.length > 0 && !availableDates.includes(ctx.slot.date)) {
        return {
          passed: false,
          reason: `${programName ?? 'Team'} not available on ${ctx.slot.date}`,
        }
      }
      return { passed: true, reason: 'Team available on this date' }
    }

    case 'max_games_per_day': {
      const max = (cond.max as number) ?? 1
      const teamName = cond.team_name as string | undefined
      const programName = cond.program_name as string | undefined
      const week = cond.week as number | undefined
      const afterWeek = cond.after_week as number | undefined
      const division = cond.division as string | undefined

      // Determine which team(s) this applies to
      const targetTeamIds: number[] = []

      if (teamName) {
        if (ctx.homeTeam.name.includes(teamName)) targetTeamIds.push(ctx.homeTeam.id)
        if (ctx.awayTeam.name.includes(teamName)) targetTeamIds.push(ctx.awayTeam.id)
        if (targetTeamIds.length === 0)
          return { passed: true, reason: `No matching team for ${teamName}` }
      } else if (programName) {
        const homeProgram = ctx.teamProgramMap.get(ctx.homeTeam.id)
        const awayProgram = ctx.teamProgramMap.get(ctx.awayTeam.id)
        if (division) {
          if (homeProgram?.name === programName && ctx.homeTeam.division.includes(division))
            targetTeamIds.push(ctx.homeTeam.id)
          if (awayProgram?.name === programName && ctx.awayTeam.division.includes(division))
            targetTeamIds.push(ctx.awayTeam.id)
        } else {
          if (homeProgram?.name === programName) targetTeamIds.push(ctx.homeTeam.id)
          if (awayProgram?.name === programName) targetTeamIds.push(ctx.awayTeam.id)
        }
        if (targetTeamIds.length === 0)
          return { passed: true, reason: `No matching team for ${programName}` }
      }

      // Check week constraints
      if (week !== undefined && ctx.slot.weekNumber !== week)
        return { passed: true, reason: `Not week ${week}` }
      if (afterWeek !== undefined && ctx.slot.weekNumber <= afterWeek)
        return { passed: true, reason: `Not after week ${afterWeek}` }

      for (const teamId of targetTeamIds) {
        const dayKey = `${teamId}-${ctx.slot.eventDateId}`
        const current = ctx.teamDayGameCounts.get(dayKey) ?? 0
        if (current >= max) {
          return { passed: false, reason: `Team already has ${current} game(s) today (max ${max})` }
        }
      }
      return { passed: true, reason: `Under max games per day (${max})` }
    }

    case 'forced_internal_matchups': {
      // This is informational — actual forced matchup logic is in the engine
      return { passed: true, reason: 'Forced matchup rule (handled by engine)' }
    }

    case 'set_timing': {
      // Parameter override — doesn't block/allow, just provides values
      return { passed: true, reason: 'Timing parameter override' }
    }

    case 'skip_date': {
      // Handled by skippedDates in context
      return { passed: true, reason: 'Skip date (handled by engine)' }
    }

    case 'season_dates': {
      // Informational — engine reads this for season config
      return { passed: true, reason: 'Season dates config' }
    }

    case 'special_event': {
      // Informational — engine reads this for jamboree/special handling
      return { passed: true, reason: 'Special event config' }
    }

    case 'forced_doubleheader': {
      // This forces double headers for a program — handled by engine
      return { passed: true, reason: 'Forced double-header (handled by engine)' }
    }

    default:
      return { passed: true, reason: `Unknown condition type: ${type}` }
  }
}

// ─── Override Matching ────────────────────────────────────────

function findApplicableOverride(
  overrides: RuleOverride[],
  rule: ScheduleRule,
  ctx: ScheduleContext
): RuleOverride | undefined {
  return overrides.find((ov) => {
    if (ov.rule_id !== rule.id) return false
    if (ov.override_action !== 'allow') return false
    // Check scope
    if (ov.scope_type === 'global') return true
    if (ov.scope_type === 'matchup') {
      const matchesHome = ov.home_team_id === ctx.homeTeam.id && ov.away_team_id === ctx.awayTeam.id
      const matchesAway = ov.home_team_id === ctx.awayTeam.id && ov.away_team_id === ctx.homeTeam.id
      return matchesHome || matchesAway
    }
    if (ov.scope_type === 'team')
      return ov.scope_team_id === ctx.homeTeam.id || ov.scope_team_id === ctx.awayTeam.id
    if (ov.scope_type === 'week') return ov.scope_event_date_id === ctx.slot.eventDateId
    return false
  })
}

// ─── Main Evaluators ──────────────────────────────────────────

/**
 * Evaluate all rules against a candidate matchup.
 * Used during matchup generation to filter invalid pairings.
 */
export function evaluateMatchupRules(
  rules: ScheduleRule[],
  ctx: ScheduleContext,
  overrides: RuleOverride[] = []
): EvalResult {
  const evaluations: RuleEvaluation[] = []
  let penalties = 0
  let blockingRule: ScheduleRule | null = null
  let explicitlyAllowed = false

  for (const rule of rules) {
    // Skip rules that don't apply to this scope
    if (!ruleAppliesToMatchup(rule, ctx)) continue

    // Skip non-matchup rules (slot placement, timing overrides, etc.)
    const condType = (rule.conditions as any).type
    if (
      ['set_timing', 'skip_date', 'season_dates', 'special_event', 'forced_doubleheader'].includes(
        condType
      )
    )
      continue

    const result = evaluateCondition(rule, ctx)

    if (!result.passed) {
      // Check for admin override
      const override = findApplicableOverride(overrides, rule, ctx)
      if (override) {
        evaluations.push({ passed: true, rule, reason: `ADMIN OVERRIDE: ${override.reason}` })
        continue // Skip this block
      }

      evaluations.push({ passed: result.passed, rule, reason: result.reason })

      if (rule.action === 'block' && rule.enforcement === 'hard') {
        blockingRule = rule
      } else if (rule.action === 'warn' || rule.enforcement === 'soft') {
        penalties += 1
      }
    } else {
      evaluations.push({ passed: result.passed, rule, reason: result.reason })
    }

    if (rule.action === 'allow' && result.passed) {
      explicitlyAllowed = true
    }
  }

  // An explicit allow overrides blocks (if it has higher priority, which it does since rules are sorted by priority)
  const allowed = explicitlyAllowed || !blockingRule

  return { allowed, evaluations, penalties, blockingRule }
}

/**
 * Evaluate slot-specific rules against a candidate placement.
 * Used during slot assignment to check time restrictions, rest, etc.
 */
export function evaluateSlotRules(
  rules: ScheduleRule[],
  ctx: ScheduleContext,
  overrides: RuleOverride[] = []
): EvalResult {
  const evaluations: RuleEvaluation[] = []
  let penalties = 0
  let blockingRule: ScheduleRule | null = null
  let explicitlyAllowed = false

  for (const rule of rules) {
    if (!ruleAppliesToMatchup(rule, ctx)) continue

    const condType = (rule.conditions as any).type
    // Only evaluate slot-relevant rules
    if (
      ![
        'no_back_to_back',
        'min_rest',
        'doubleheader_spacing',
        'time_restriction',
        'team_availability',
        'max_games_per_day',
      ].includes(condType)
    )
      continue

    const result = evaluateCondition(rule, ctx)

    if (!result.passed) {
      // Check for admin override
      const override = findApplicableOverride(overrides, rule, ctx)
      if (override) {
        evaluations.push({ passed: true, rule, reason: `ADMIN OVERRIDE: ${override.reason}` })
        continue // Skip this block
      }

      evaluations.push({ passed: result.passed, rule, reason: result.reason })

      if (rule.action === 'block' && rule.enforcement === 'hard') {
        blockingRule = rule
      } else if (rule.action === 'warn' || rule.enforcement === 'soft') {
        penalties += 1
      }
    } else {
      evaluations.push({ passed: result.passed, rule, reason: result.reason })
    }

    if (rule.action === 'allow' && result.passed) {
      explicitlyAllowed = true
    }
  }

  const allowed = explicitlyAllowed || !blockingRule
  return { allowed, evaluations, penalties, blockingRule }
}

/**
 * Get effective timing parameters for a division.
 * Checks rules with action='set_param' and conditions.type='set_timing',
 * then falls back to division_timing table, then event defaults.
 */
export function getEffectiveTiming(
  division: string,
  rules: ScheduleRule[],
  divTimingMap: Map<string, { increment: number; buffer: number }>,
  defaults: { slotDuration: number; buffer: number }
): { increment: number; buffer: number; adultRefs: number; youthRefs: number } {
  // Check rules first (highest priority)
  for (const rule of rules) {
    if (rule.category !== 'division') continue
    if (rule.scope_division && rule.scope_division !== division) continue
    const cond = rule.conditions as any
    if (cond.type !== 'set_timing') continue

    // Check if rule name matches division (e.g., "1/2 Grade timing" for "1/2 Grade 4v4")
    const ruleDiv = rule.rule_name.replace(' timing', '')
    if (!division.startsWith(ruleDiv) && !division.includes(ruleDiv)) continue

    const params = rule.action_params as any
    return {
      increment: params.schedule_increment ?? defaults.slotDuration,
      buffer: params.time_between_games ?? defaults.buffer,
      adultRefs: params.adult_refs ?? 0,
      youthRefs: params.youth_refs ?? 0,
    }
  }

  // Fall back to division_timing table
  const divTiming = divTimingMap.get(division)
  if (divTiming) {
    return {
      increment: divTiming.increment,
      buffer: divTiming.buffer,
      adultRefs: 0,
      youthRefs: 0,
    }
  }

  // Fall back to event defaults
  return {
    increment: defaults.slotDuration,
    buffer: defaults.buffer,
    adultRefs: 0,
    youthRefs: 0,
  }
}

/**
 * Seed default scheduling rules for a brand-new event.
 * No-ops if the event already has any rules.
 */
export async function seedDefaultRules(eventId: number, sb: SupabaseClient): Promise<void> {
  // Check if rules already exist for this event
  const { data: existing } = await sb
    .from('schedule_rules')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (existing && existing.length > 0) return // Already has rules

  const defaults = [
    {
      rule_name: 'Same division only',
      rule_type: 'constraint',
      category: 'global',
      conditions: { type: 'same_division_only' },
      action: 'block',
      action_params: { reason: 'Teams must be in the same division' },
      priority: 1000,
      enforcement: 'hard',
    },
    {
      rule_name: 'No same-program matchups',
      rule_type: 'constraint',
      category: 'global',
      conditions: { type: 'same_program_block' },
      action: 'block',
      action_params: { reason: 'Teams from same program cannot play each other' },
      priority: 900,
      enforcement: 'hard',
    },
    {
      rule_name: 'No back-to-back games',
      rule_type: 'constraint',
      category: 'global',
      conditions: { type: 'no_back_to_back' },
      action: 'block',
      action_params: { reason: 'Team cannot play consecutive time slots' },
      priority: 800,
      enforcement: 'hard',
    },
    {
      rule_name: 'Minimum rest 60 minutes',
      rule_type: 'constraint',
      category: 'global',
      conditions: { type: 'min_rest', minutes: 60 },
      action: 'block',
      action_params: { reason: 'Insufficient rest between games' },
      priority: 700,
      enforcement: 'hard',
    },
    {
      rule_name: 'Double-header spacing',
      rule_type: 'preference',
      category: 'global',
      conditions: { type: 'doubleheader_spacing', preferred_hours: 2, max_hours: 3 },
      action: 'warn',
      action_params: {},
      priority: 600,
      enforcement: 'soft',
    },
    {
      rule_name: 'Rematch spacing 3 weeks',
      rule_type: 'preference',
      category: 'global',
      conditions: { type: 'rematch_spacing', min_weeks: 3 },
      action: 'warn',
      action_params: { reason: 'Teams should not rematch within 3 weeks' },
      priority: 500,
      enforcement: 'soft',
    },
    {
      rule_name: 'Field-division restriction',
      rule_type: 'constraint',
      category: 'global',
      conditions: { type: 'field_division_check' },
      action: 'block',
      action_params: { reason: 'Field not assigned to this division' },
      priority: 1100,
      enforcement: 'hard',
    },
  ]

  await sb.from('schedule_rules').insert(defaults.map((r) => ({ event_id: eventId, ...r })))
}

/**
 * Get forced matchups from rules (action='force').
 */
export function getForcedMatchups(rules: ScheduleRule[]): ScheduleRule[] {
  return rules.filter((r) => r.rule_type === 'forced_matchup' && r.action === 'force')
}

/**
 * Get skipped dates from rules and weekly overrides.
 */
export function getSkippedDates(rules: ScheduleRule[], overrides: WeeklyOverride[]): Set<string> {
  const skipped = new Set<string>()

  for (const rule of rules) {
    const cond = rule.conditions as any
    if (cond.type === 'skip_date' && cond.date) {
      skipped.add(cond.date)
    }
  }

  for (const ov of overrides) {
    if (ov.override_type === 'skip_date') {
      const date = (ov.params as any).date
      if (date) skipped.add(date)
    }
  }

  return skipped
}
