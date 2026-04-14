/**
 * LeagueOps — Schedule Validator
 *
 * Validates a generated schedule against all configured rules.
 * Returns categorized results: hard errors, soft warnings, override-required flags.
 * Run this before accepting/inserting a generated schedule.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleGame } from './schedule'
import type { ScheduleRule, WeeklyOverride } from './schedule-rules'
import { loadScheduleRules, loadWeeklyOverrides, loadTeamProgramMap } from './schedule-rules'

// ─── Types ────────────────────────────────────────────────────

export interface ValidationItem {
  rule_id: number | null
  rule_name: string
  severity: 'error' | 'warning' | 'override_required'
  message: string
  affected_game_indices: number[]
  affected_team_ids: number[]
  metadata: Record<string, unknown>
}

export interface TeamMetrics {
  team_id: number
  team_name: string
  division: string
  total_games: number
  opponents: string[]
  repeat_opponents: string[]
  violations: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationItem[]
  warnings: ValidationItem[]
  overrides: ValidationItem[]
  teamMetrics: TeamMetrics[]
  summary: {
    totalGames: number
    totalTeams: number
    gamesPerTeamMin: number
    gamesPerTeamMax: number
    unscheduledMatchups: number
    hardViolations: number
    softViolations: number
  }
}

// ─── Time helpers ─────────────────────────────────────────────

function timeToMinutes(time: string): number {
  if (!time) return 0
  const ampm = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = parseInt(ampm[2])
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const plain = time.match(/(\d+):(\d+)/)
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2])
  return 0
}

// ─── Main Validator ───────────────────────────────────────────

export async function validateSchedule(
  eventId: number,
  games: ScheduleGame[],
  sb: SupabaseClient
): Promise<ValidationResult> {
  const errors: ValidationItem[] = []
  const warnings: ValidationItem[] = []
  const overrides: ValidationItem[] = []

  // Load context
  const rules = await loadScheduleRules(eventId, sb)
  const weeklyOverrides = await loadWeeklyOverrides(eventId, sb)
  const teamProgramMap = await loadTeamProgramMap(eventId, sb)

  // Load teams for names
  const { data: teams } = await sb
    .from('teams')
    .select('id, name, division')
    .eq('event_id', eventId)

  const teamMap = new Map<number, { name: string; division: string }>()
  for (const t of teams ?? []) {
    teamMap.set(t.id, { name: t.name, division: t.division })
  }

  // Load event params
  const { data: event } = await sb
    .from('events')
    .select('schedule_increment, time_between_games, game_guarantee')
    .eq('id', eventId)
    .single()

  const slotDuration = event?.schedule_increment ?? 60
  const gameGuarantee = event?.game_guarantee ?? 0

  // Build game analysis structures
  const teamGameCounts = new Map<number, number>()
  const teamOpponents = new Map<number, Set<number>>()
  const teamDayGames = new Map<string, number[]>() // "teamId-dateId" -> [timeMinutes]
  const fieldDateGames = new Map<string, number[]>() // "fieldId-dateId" -> [timeMinutes]
  const matchupCounts = new Map<string, number>() // "min-max" -> count

  for (let i = 0; i < games.length; i++) {
    const g = games[i]
    const timeMin = timeToMinutes(g.scheduled_time)

    // Count games per team
    teamGameCounts.set(g.home_team_id, (teamGameCounts.get(g.home_team_id) ?? 0) + 1)
    teamGameCounts.set(g.away_team_id, (teamGameCounts.get(g.away_team_id) ?? 0) + 1)

    // Track opponents
    if (!teamOpponents.has(g.home_team_id)) teamOpponents.set(g.home_team_id, new Set())
    if (!teamOpponents.has(g.away_team_id)) teamOpponents.set(g.away_team_id, new Set())
    teamOpponents.get(g.home_team_id)!.add(g.away_team_id)
    teamOpponents.get(g.away_team_id)!.add(g.home_team_id)

    // Track day games per team
    for (const tid of [g.home_team_id, g.away_team_id]) {
      const key = `${tid}-${g.event_date_id}`
      if (!teamDayGames.has(key)) teamDayGames.set(key, [])
      teamDayGames.get(key)!.push(timeMin)
    }

    // Track field usage
    const fKey = `${g.field_id}-${g.event_date_id}`
    if (!fieldDateGames.has(fKey)) fieldDateGames.set(fKey, [])
    fieldDateGames.get(fKey)!.push(timeMin)

    // Track matchups
    const mKey = `${Math.min(g.home_team_id, g.away_team_id)}-${Math.max(g.home_team_id, g.away_team_id)}`
    matchupCounts.set(mKey, (matchupCounts.get(mKey) ?? 0) + 1)
  }

  // ─── Validation checks ─────────────────────────────────────

  // 1. Same division check
  for (let i = 0; i < games.length; i++) {
    const g = games[i]
    const home = teamMap.get(g.home_team_id)
    const away = teamMap.get(g.away_team_id)
    if (home && away && home.division !== away.division) {
      errors.push({
        rule_id: null,
        rule_name: 'Same division only',
        severity: 'error',
        message: `${home.name} (${home.division}) vs ${away.name} (${away.division}) — cross-division matchup`,
        affected_game_indices: [i],
        affected_team_ids: [g.home_team_id, g.away_team_id],
        metadata: {},
      })
    }
  }

  // 2. Same program matchups
  for (let i = 0; i < games.length; i++) {
    const g = games[i]
    const homeProgram = teamProgramMap.get(g.home_team_id)
    const awayProgram = teamProgramMap.get(g.away_team_id)
    if (homeProgram && awayProgram && homeProgram.id === awayProgram.id) {
      const home = teamMap.get(g.home_team_id)
      const away = teamMap.get(g.away_team_id)
      errors.push({
        rule_id: null,
        rule_name: 'No same-program matchups',
        severity: 'error',
        message: `${home?.name} vs ${away?.name} — both in program "${homeProgram.name}"`,
        affected_game_indices: [i],
        affected_team_ids: [g.home_team_id, g.away_team_id],
        metadata: { program: homeProgram.name },
      })
    }
  }

  // 3. Field double-booking
  for (const [key, times] of fieldDateGames) {
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      if (times[i] < times[i - 1] + slotDuration) {
        errors.push({
          rule_id: null,
          rule_name: 'Field double-booking',
          severity: 'error',
          message: `Field overlap: games at ${times[i - 1]}min and ${times[i]}min on same field/date`,
          affected_game_indices: [],
          affected_team_ids: [],
          metadata: { fieldDateKey: key, times: [times[i - 1], times[i]] },
        })
      }
    }
  }

  // 4. Team back-to-back / insufficient rest
  for (const [key, times] of teamDayGames) {
    if (times.length < 2) continue
    times.sort((a, b) => a - b)
    const teamId = parseInt(key.split('-')[0])
    const teamName = teamMap.get(teamId)?.name ?? `Team ${teamId}`

    for (let i = 1; i < times.length; i++) {
      const rest = times[i] - (times[i - 1] + slotDuration)
      if (rest < 0) {
        errors.push({
          rule_id: null,
          rule_name: 'Team double-booking',
          severity: 'error',
          message: `${teamName} has overlapping games at ${times[i - 1]}min and ${times[i]}min`,
          affected_game_indices: [],
          affected_team_ids: [teamId],
          metadata: { rest },
        })
      } else if (rest === 0) {
        errors.push({
          rule_id: null,
          rule_name: 'No back-to-back games',
          severity: 'error',
          message: `${teamName} has back-to-back games (0min rest)`,
          affected_game_indices: [],
          affected_team_ids: [teamId],
          metadata: { rest },
        })
      } else if (rest < 60) {
        warnings.push({
          rule_id: null,
          rule_name: 'Minimum rest 60 minutes',
          severity: 'warning',
          message: `${teamName} has only ${rest}min rest between games (recommended 60min)`,
          affected_game_indices: [],
          affected_team_ids: [teamId],
          metadata: { rest },
        })
      }
    }
  }

  // 5. Game guarantee check
  if (gameGuarantee > 0) {
    for (const [teamId, count] of teamGameCounts) {
      if (count < gameGuarantee) {
        const teamName = teamMap.get(teamId)?.name ?? `Team ${teamId}`
        warnings.push({
          rule_id: null,
          rule_name: 'Game guarantee',
          severity: 'warning',
          message: `${teamName} has ${count} games (guarantee: ${gameGuarantee})`,
          affected_game_indices: [],
          affected_team_ids: [teamId],
          metadata: { count, guarantee: gameGuarantee },
        })
      }
    }
  }

  // 6. Time restriction checks (9AM blocks for Hammerhead/RedHawks)
  for (const rule of rules) {
    const cond = rule.conditions as any
    if (cond.type !== 'time_restriction') continue
    const blockedTimes = (cond.blocked_times as string[]) ?? []
    const programName = cond.program_name as string

    for (let i = 0; i < games.length; i++) {
      const g = games[i]
      const homeProgram = teamProgramMap.get(g.home_team_id)
      const awayProgram = teamProgramMap.get(g.away_team_id)

      if (homeProgram?.name !== programName && awayProgram?.name !== programName) continue

      if (blockedTimes.includes(g.scheduled_time)) {
        const home = teamMap.get(g.home_team_id)
        const away = teamMap.get(g.away_team_id)
        errors.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          severity: 'error',
          message: `${home?.name} vs ${away?.name} at ${g.scheduled_time} — ${programName} cannot play at this time`,
          affected_game_indices: [i],
          affected_team_ids: [g.home_team_id, g.away_team_id],
          metadata: { programName, time: g.scheduled_time },
        })
      }
    }
  }

  // ─── Build team metrics ─────────────────────────────────────

  const teamMetrics: TeamMetrics[] = []
  for (const [teamId, info] of teamMap) {
    const gameCount = teamGameCounts.get(teamId) ?? 0
    const opps = teamOpponents.get(teamId) ?? new Set()
    const oppNames = [...opps].map((id) => teamMap.get(id)?.name ?? `Team ${id}`)

    // Find repeat opponents
    const repeatOpps: string[] = []
    for (const oppId of opps) {
      const mKey = `${Math.min(teamId, oppId)}-${Math.max(teamId, oppId)}`
      const count = matchupCounts.get(mKey) ?? 0
      if (count > 1) {
        repeatOpps.push(`${teamMap.get(oppId)?.name ?? oppId} (${count}x)`)
      }
    }

    teamMetrics.push({
      team_id: teamId,
      team_name: info.name,
      division: info.division,
      total_games: gameCount,
      opponents: oppNames,
      repeat_opponents: repeatOpps,
      violations: [],
    })
  }

  // ─── Build summary ──────────────────────────────────────────

  const gameCounts = [...teamGameCounts.values()]
  const summary = {
    totalGames: games.length,
    totalTeams: teamMap.size,
    gamesPerTeamMin: gameCounts.length > 0 ? Math.min(...gameCounts) : 0,
    gamesPerTeamMax: gameCounts.length > 0 ? Math.max(...gameCounts) : 0,
    unscheduledMatchups: 0,
    hardViolations: errors.length,
    softViolations: warnings.length,
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    overrides,
    teamMetrics,
    summary,
  }
}
