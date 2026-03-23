/**
 * LeagueOps — Schedule Generation Engine (#13)
 *
 * Generates round-robin game schedules within divisions.
 * Assigns games to time slots across available fields and event dates.
 * Detects scheduling conflicts (field double-booking, team double-booking,
 * insufficient rest).
 *
 * Uses the rule evaluator module (schedule-rules.ts) to apply configurable
 * schedule rules during matchup generation and slot assignment.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadScheduleRules, loadWeeklyOverrides, loadTeamProgramMap,
  evaluateMatchupRules, evaluateSlotRules, getEffectiveTiming,
  getForcedMatchups, getSkippedDates,
  type ScheduleRule, type ScheduleContext, type PlacedGame, type TeamInfo
} from './schedule-rules'

// ─── Types ────────────────────────────────────────────────────

export interface ScheduleGame {
  event_id: number
  event_date_id: number
  field_id: number
  home_team_id: number
  away_team_id: number
  division: string
  scheduled_time: string
  status: 'Scheduled'
  home_score: 0
  away_score: 0
  notes: null
}

export interface ScheduleConflict {
  type: 'field_double_book' | 'team_double_book' | 'insufficient_rest'
  severity: 'critical' | 'warning'
  description: string
  gameIds: number[]
  metadata?: Record<string, unknown>
}

export interface GenerateResult {
  games: ScheduleGame[]
  totalMatchups: number
  teamCount: number
  fieldCount: number
  dateCount: number
  divisionCount: number
  auditRunId: string
}

export interface ConflictResult {
  conflicts: ScheduleConflict[]
  clean: boolean
  gamesScanned: number
}

// ─── Time helpers ─────────────────────────────────────────────

function timeToMinutes(time: string): number {
  if (!time) return 0
  // Handle "HH:MM AM/PM"
  const ampm = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = parseInt(ampm[2])
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  // Handle "HH:MM" (24h)
  const plain = time.match(/(\d+):(\d+)/)
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2])
  return 0
}

function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
}

// ─── Round-robin pairing generator ───────────────────────────

function generateRoundRobinPairs(teamIds: number[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]])
    }
  }
  // Shuffle to spread matchups more evenly across time slots
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs
}

// ─── Audit entry type ─────────────────────────────────────────

interface AuditEntry {
  event_id: number
  run_id: string
  log_type: string
  severity: string
  home_team_id: number | null
  away_team_id: number | null
  division: string | null
  event_date_id?: number | null
  field_id?: number | null
  scheduled_time?: string | null
  rule_id: number | null
  rule_name: string
  message: string
  metadata: Record<string, unknown>
}

// ─── Main: Generate Schedule ─────────────────────────────────

export async function generateSchedule(
  eventId: number,
  sb: SupabaseClient
): Promise<GenerateResult> {
  const runId = crypto.randomUUID()
  const auditEntries: AuditEntry[] = []

  // 1. Load teams grouped by division
  const { data: teams, error: teamsErr } = await sb
    .from('teams')
    .select('id, name, division')
    .eq('event_id', eventId)
    .order('division')
    .order('name')

  if (teamsErr) throw new Error(`Failed to load teams: ${teamsErr.message}`)
  if (!teams || teams.length === 0) throw new Error('No teams found for this event')

  // Load program_teams mapping
  const teamProgramMap = await loadTeamProgramMap(eventId, sb)

  const divisionMap = new Map<string, number[]>()
  for (const t of teams) {
    if (!divisionMap.has(t.division)) divisionMap.set(t.division, [])
    divisionMap.get(t.division)!.push(t.id)
  }

  // Build team info map for rule context
  const teamInfoMap = new Map<number, TeamInfo>()
  for (const t of teams) {
    const prog = teamProgramMap.get(t.id)
    teamInfoMap.set(t.id, {
      id: t.id, name: t.name, division: t.division,
      program_id: prog?.id ?? null, program_name: prog?.name ?? null,
    })
  }

  // 2. Load fields and their division assignments
  const { data: fields, error: fieldsErr } = await sb
    .from('fields')
    .select('id, name, division')
    .eq('event_id', eventId)
    .order('id')

  if (fieldsErr) throw new Error(`Failed to load fields: ${fieldsErr.message}`)
  if (!fields || fields.length === 0) throw new Error('No fields found for this event')

  // Load field_divisions for multi-division assignment
  const { data: fieldDivRows } = await sb
    .from('field_divisions')
    .select('field_id, division_name')
    .eq('event_id', eventId)

  // Build field -> allowed divisions map (empty = any division)
  const fieldDivMap = new Map<number, Set<string>>()
  for (const row of (fieldDivRows ?? []) as { field_id: number; division_name: string }[]) {
    if (!fieldDivMap.has(row.field_id)) fieldDivMap.set(row.field_id, new Set())
    fieldDivMap.get(row.field_id)!.add(row.division_name)
  }

  // Helper: can this field host this division?
  function fieldAllowsDivision(fieldId: number, division: string): boolean {
    const allowed = fieldDivMap.get(fieldId)
    if (!allowed || allowed.size === 0) return true // no restriction = any division
    return allowed.has(division)
  }

  // Build field name lookup
  const fieldNameMap = new Map<number, string>()
  for (const f of fields) {
    fieldNameMap.set(f.id, f.name)
  }

  // 3. Load event dates
  const { data: eventDates, error: datesErr } = await sb
    .from('event_dates')
    .select('id, date, label')
    .eq('event_id', eventId)
    .order('date')

  if (datesErr) throw new Error(`Failed to load event dates: ${datesErr.message}`)
  if (!eventDates || eventDates.length === 0) throw new Error('No event dates found')

  // 4. Load schedule parameters from the events table
  const { data: event, error: eventErr } = await sb
    .from('events')
    .select('schedule_increment, time_between_games, game_guarantee')
    .eq('id', eventId)
    .single()

  if (eventErr) throw new Error(`Failed to load event: ${eventErr.message}`)

  const slotDuration = event.schedule_increment || 60 // minutes per game slot
  const buffer = event.time_between_games || 0 // buffer between games
  const gameGuarantee = event.game_guarantee || 0 // min games per team
  const totalSlotMinutes = slotDuration + buffer

  // Load division timing overrides (table exists but was never used)
  const { data: divTimings } = await sb
    .from('division_timing')
    .select('division_name, schedule_increment, time_between_games')
    .eq('event_id', eventId)

  const divTimingMap = new Map<string, { increment: number; buffer: number }>()
  for (const dt of (divTimings ?? []) as any[]) {
    if (dt.schedule_increment || dt.time_between_games) {
      divTimingMap.set(dt.division_name, {
        increment: dt.schedule_increment ?? slotDuration,
        buffer: dt.time_between_games ?? buffer,
      })
    }
  }

  // Load schedule rules and weekly overrides
  const scheduleRules = await loadScheduleRules(eventId, sb)
  const weeklyOverrides = await loadWeeklyOverrides(eventId, sb)
  const skippedDates = getSkippedDates(scheduleRules, weeklyOverrides)

  // Filter out skipped dates
  const activeDates = eventDates.filter(ed => !skippedDates.has(ed.date))

  // 5. Load season_game_days for start/end times (if available)
  const { data: gameDays } = await sb
    .from('season_game_days')
    .select('day_of_week, start_time, end_time, is_active')
    .eq('event_id', eventId)

  // Default start/end if no game days configured
  const defaultStart = '9:00 AM'
  const defaultEnd = '5:00 PM'

  // Build a lookup: day_of_week (0=Sun) -> { start, end }
  const dayConfig = new Map<number, { start: number; end: number }>()
  if (gameDays && gameDays.length > 0) {
    for (const gd of gameDays) {
      if (gd.is_active) {
        dayConfig.set(gd.day_of_week, {
          start: timeToMinutes(gd.start_time),
          end: timeToMinutes(gd.end_time),
        })
      }
    }
  }

  // Compute week numbers for dates (week 1 = first event date week)
  const dateWeekMap = new Map<string, number>()
  if (activeDates.length > 0) {
    const firstDate = new Date(activeDates[0].date + 'T12:00:00')
    for (const ed of activeDates) {
      const d = new Date(ed.date + 'T12:00:00')
      const diffMs = d.getTime() - firstDate.getTime()
      const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
      dateWeekMap.set(ed.date, weekNum)
    }
  }

  // Build eventDateId -> date string map
  const dateIdToDate = new Map<number, string>()
  for (const ed of activeDates) {
    dateIdToDate.set(ed.id, ed.date)
  }

  // 6. Generate round-robin matchups within each division
  const allMatchups: { home: number; away: number; division: string }[] = []

  for (const [division, teamIds] of divisionMap.entries()) {
    if (teamIds.length < 2) continue
    const pairs = generateRoundRobinPairs(teamIds)

    // If game_guarantee > 0, we may need to repeat some matchups
    if (gameGuarantee > 0) {
      const gamesPerTeamInRR = teamIds.length - 1 // each team plays every other once
      const repetitions = Math.ceil(gameGuarantee / gamesPerTeamInRR)
      for (let rep = 0; rep < repetitions; rep++) {
        for (const [home, away] of pairs) {
          // Alternate home/away on repeats
          if (rep % 2 === 0) {
            allMatchups.push({ home, away, division })
          } else {
            allMatchups.push({ home: away, away: home, division })
          }
        }
      }
    } else {
      for (const [home, away] of pairs) {
        allMatchups.push({ home, away, division })
      }
    }
  }

  if (allMatchups.length === 0) throw new Error('No matchups generated — need at least 2 teams per division')

  // Filter matchups through rule evaluator
  const filteredMatchups = allMatchups.filter(matchup => {
    const homeTeam = teamInfoMap.get(matchup.home)
    const awayTeam = teamInfoMap.get(matchup.away)
    if (!homeTeam || !awayTeam) return true

    const ctx: ScheduleContext = {
      homeTeam, awayTeam,
      slot: { eventDateId: 0, fieldId: 0, fieldName: '', timeMinutes: 0, weekNumber: 0, date: '' },
      placedGames: [],
      teamGameCounts: new Map(),
      teamDayGameCounts: new Map(),
      teamLastGameEnd: new Map(),
      matchupHistory: new Map(),
      skippedDates: new Set(),
      teamProgramMap,
    }

    const result = evaluateMatchupRules(scheduleRules, ctx)
    if (!result.allowed) {
      auditEntries.push({
        event_id: eventId, run_id: runId, log_type: 'matchup_blocked', severity: 'info',
        home_team_id: matchup.home, away_team_id: matchup.away, division: matchup.division,
        rule_id: result.blockingRule?.id ?? null, rule_name: result.blockingRule?.rule_name ?? '',
        message: result.evaluations.find(e => !e.passed)?.reason ?? 'Blocked by rule',
        metadata: {},
      })
    }
    return result.allowed
  })

  // 7. Assign games to time slots on available fields across dates

  // Build time slot grid: for each date, for each field, generate available slots
  interface TimeSlot {
    eventDateId: number
    fieldId: number
    fieldName: string
    timeMinutes: number
    weekNumber: number
    date: string
  }

  const slots: TimeSlot[] = []

  for (const ed of activeDates) {
    // Determine day of week for this date
    const dateObj = new Date(ed.date + 'T12:00:00') // noon to avoid timezone edge
    const dow = dateObj.getDay() // 0=Sun
    const weekNum = dateWeekMap.get(ed.date) ?? 1

    let startMin: number
    let endMin: number

    if (dayConfig.has(dow)) {
      const cfg = dayConfig.get(dow)!
      startMin = cfg.start
      endMin = cfg.end
    } else {
      startMin = timeToMinutes(defaultStart)
      endMin = timeToMinutes(defaultEnd)
    }

    // For each field, generate slots within the time window
    for (const field of fields) {
      let t = startMin
      while (t + slotDuration <= endMin) {
        slots.push({
          eventDateId: ed.id,
          fieldId: field.id,
          fieldName: field.name,
          timeMinutes: t,
          weekNumber: weekNum,
          date: ed.date,
        })
        t += totalSlotMinutes
      }
    }
  }

  if (slots.length === 0) throw new Error('No time slots available — check event dates and schedule settings')
  if (slots.length < filteredMatchups.length) {
    throw new Error(
      `Not enough time slots (${slots.length}) for all matchups (${filteredMatchups.length}). ` +
      `Add more event dates, fields, or adjust schedule increment.`
    )
  }

  // Track state for rule evaluation during slot assignment
  const teamGameCounts = new Map<number, number>()
  const teamDayGameCounts = new Map<string, number>()
  const teamLastGameEnd = new Map<string, number>()
  const matchupHistory = new Map<string, number[]>()
  const placedGames: PlacedGame[] = []

  // Track usage per team per date-time to avoid team double-booking
  // Key: `${teamId}-${eventDateId}-${timeMinutes}`
  const teamSlotUsed = new Set<string>()

  const games: ScheduleGame[] = []
  const slotIdx = 0

  for (const matchup of filteredMatchups) {
    // Find the next available slot where neither team is already playing
    let assigned = false
    const startSearch = slotIdx
    const homeTeam = teamInfoMap.get(matchup.home)
    const awayTeam = teamInfoMap.get(matchup.away)

    for (let attempts = 0; attempts < slots.length; attempts++) {
      const si = (startSearch + attempts) % slots.length
      const slot = slots[si]

      const homeKey = `${matchup.home}-${slot.eventDateId}-${slot.timeMinutes}`
      const awayKey = `${matchup.away}-${slot.eventDateId}-${slot.timeMinutes}`

      // Check field-division compatibility
      if (!fieldAllowsDivision(slot.fieldId, matchup.division)) continue

      if (!teamSlotUsed.has(homeKey) && !teamSlotUsed.has(awayKey)) {
        // Evaluate slot rules if we have team info
        if (homeTeam && awayTeam) {
          const ctx: ScheduleContext = {
            homeTeam, awayTeam,
            slot: {
              eventDateId: slot.eventDateId,
              fieldId: slot.fieldId,
              fieldName: slot.fieldName,
              timeMinutes: slot.timeMinutes,
              weekNumber: slot.weekNumber,
              date: slot.date,
            },
            placedGames,
            teamGameCounts,
            teamDayGameCounts,
            teamLastGameEnd,
            matchupHistory,
            skippedDates: new Set(),
            teamProgramMap,
          }

          const slotResult = evaluateSlotRules(scheduleRules, ctx)
          if (!slotResult.allowed) {
            auditEntries.push({
              event_id: eventId, run_id: runId, log_type: 'slot_skipped', severity: 'info',
              home_team_id: matchup.home, away_team_id: matchup.away, division: matchup.division,
              event_date_id: slot.eventDateId, field_id: slot.fieldId,
              scheduled_time: minutesToDisplay(slot.timeMinutes),
              rule_id: slotResult.blockingRule?.id ?? null,
              rule_name: slotResult.blockingRule?.rule_name ?? '',
              message: slotResult.evaluations.find(e => !e.passed)?.reason ?? 'Blocked by slot rule',
              metadata: {},
            })
            continue // Skip this slot, try the next one
          }
        }

        teamSlotUsed.add(homeKey)
        teamSlotUsed.add(awayKey)

        const scheduledTime = minutesToDisplay(slot.timeMinutes)

        games.push({
          event_id: eventId,
          event_date_id: slot.eventDateId,
          field_id: slot.fieldId,
          home_team_id: matchup.home,
          away_team_id: matchup.away,
          division: matchup.division,
          scheduled_time: scheduledTime,
          status: 'Scheduled',
          home_score: 0,
          away_score: 0,
          notes: null,
        })

        // Update tracking state for subsequent rule evaluations
        const gameDuration = getEffectiveTiming(
          matchup.division, scheduleRules, divTimingMap,
          { slotDuration, buffer }
        ).increment
        const gameEndTime = slot.timeMinutes + gameDuration

        teamGameCounts.set(matchup.home, (teamGameCounts.get(matchup.home) ?? 0) + 1)
        teamGameCounts.set(matchup.away, (teamGameCounts.get(matchup.away) ?? 0) + 1)

        const homeDayKey = `${matchup.home}-${slot.eventDateId}`
        const awayDayKey = `${matchup.away}-${slot.eventDateId}`
        teamDayGameCounts.set(homeDayKey, (teamDayGameCounts.get(homeDayKey) ?? 0) + 1)
        teamDayGameCounts.set(awayDayKey, (teamDayGameCounts.get(awayDayKey) ?? 0) + 1)

        // Track last game end time (keep the latest)
        const prevHomeEnd = teamLastGameEnd.get(homeDayKey)
        if (prevHomeEnd === undefined || gameEndTime > prevHomeEnd) {
          teamLastGameEnd.set(homeDayKey, gameEndTime)
        }
        const prevAwayEnd = teamLastGameEnd.get(awayDayKey)
        if (prevAwayEnd === undefined || gameEndTime > prevAwayEnd) {
          teamLastGameEnd.set(awayDayKey, gameEndTime)
        }

        const matchKey = `${Math.min(matchup.home, matchup.away)}-${Math.max(matchup.home, matchup.away)}`
        if (!matchupHistory.has(matchKey)) matchupHistory.set(matchKey, [])
        matchupHistory.get(matchKey)!.push(slot.weekNumber)

        placedGames.push({
          event_date_id: slot.eventDateId,
          field_id: slot.fieldId,
          home_team_id: matchup.home,
          away_team_id: matchup.away,
          division: matchup.division,
          scheduled_time: scheduledTime,
          timeMinutes: slot.timeMinutes,
          weekNumber: slot.weekNumber,
        })

        auditEntries.push({
          event_id: eventId, run_id: runId, log_type: 'matchup_placed', severity: 'info',
          home_team_id: matchup.home, away_team_id: matchup.away, division: matchup.division,
          event_date_id: slot.eventDateId, field_id: slot.fieldId,
          scheduled_time: scheduledTime,
          rule_id: null, rule_name: '',
          message: `Placed ${homeTeam?.name ?? matchup.home} vs ${awayTeam?.name ?? matchup.away}`,
          metadata: { weekNumber: slot.weekNumber },
        })

        // Mark this slot as used (field perspective) by removing from available pool
        slots.splice(si, 1)
        assigned = true
        break
      }
    }

    if (!assigned) {
      // Could not find a conflict-free slot — place anyway in next open field slot
      if (slots.length > 0) {
        const slot = slots.shift()!

        games.push({
          event_id: eventId,
          event_date_id: slot.eventDateId,
          field_id: slot.fieldId,
          home_team_id: matchup.home,
          away_team_id: matchup.away,
          division: matchup.division,
          scheduled_time: minutesToDisplay(slot.timeMinutes),
          status: 'Scheduled',
          home_score: 0,
          away_score: 0,
          notes: null,
        })

        auditEntries.push({
          event_id: eventId, run_id: runId, log_type: 'matchup_placed', severity: 'warn',
          home_team_id: matchup.home, away_team_id: matchup.away, division: matchup.division,
          event_date_id: slot.eventDateId, field_id: slot.fieldId,
          scheduled_time: minutesToDisplay(slot.timeMinutes),
          rule_id: null, rule_name: '',
          message: `Force-placed (no conflict-free slot found): ${homeTeam?.name ?? matchup.home} vs ${awayTeam?.name ?? matchup.away}`,
          metadata: { forced: true, weekNumber: slot.weekNumber },
        })
      }
    }
  }

  // Batch insert audit entries
  if (auditEntries.length > 0) {
    // Insert in batches of 500 to avoid payload limits
    for (let i = 0; i < auditEntries.length; i += 500) {
      const batch = auditEntries.slice(i, i + 500)
      await sb.from('schedule_audit_log').insert(batch)
    }
  }

  return {
    games,
    totalMatchups: allMatchups.length,
    teamCount: teams.length,
    fieldCount: fields.length,
    dateCount: activeDates.length,
    divisionCount: divisionMap.size,
    auditRunId: runId,
  }
}

// ─── Conflict Detection ───────────────────────────────────────

export async function detectConflicts(
  eventId: number,
  sb: SupabaseClient
): Promise<ConflictResult> {
  // Load all games for the event
  const { data: games, error } = await sb
    .from('games')
    .select('id, event_date_id, field_id, home_team_id, away_team_id, scheduled_time, division')
    .eq('event_id', eventId)
    .order('event_date_id')
    .order('field_id')
    .order('scheduled_time')

  if (error) throw new Error(`Failed to load games: ${error.message}`)
  if (!games || games.length === 0) {
    return { conflicts: [], clean: true, gamesScanned: 0 }
  }

  // Load schedule_increment for game duration
  const { data: event } = await sb
    .from('events')
    .select('schedule_increment, time_between_games')
    .eq('id', eventId)
    .single()

  const gameDuration = event?.schedule_increment || 60
  const minRest = (event?.schedule_increment || 60) + (event?.time_between_games || 0)

  // Load rules for enhanced conflict descriptions
  let scheduleRules: ScheduleRule[] = []
  try {
    scheduleRules = await loadScheduleRules(eventId, sb)
  } catch {
    // Rules are optional for conflict detection — continue without them
  }

  const conflicts: ScheduleConflict[] = []

  // ── Check 1: Field double-booking ──────────────────────────
  // Group by event_date_id + field_id
  const byDateField = new Map<string, typeof games>()
  for (const g of games) {
    const key = `${g.event_date_id}-${g.field_id}`
    if (!byDateField.has(key)) byDateField.set(key, [])
    byDateField.get(key)!.push(g)
  }

  for (const [, group] of byDateField.entries()) {
    const sorted = [...group].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const aEnd = timeToMinutes(a.scheduled_time) + gameDuration
      const bStart = timeToMinutes(b.scheduled_time)

      if (bStart < aEnd) {
        conflicts.push({
          type: 'field_double_book',
          severity: 'critical',
          description: `Field double-booked: Game #${a.id} (${a.scheduled_time}) and Game #${b.id} (${b.scheduled_time}) overlap on field ${a.field_id}`,
          gameIds: [a.id, b.id],
          metadata: { field_id: a.field_id, overlap_min: aEnd - bStart },
        })
      }
    }
  }

  // ── Check 2: Team double-booking ───────────────────────────
  // Group by event_date_id + team_id
  const byDateTeam = new Map<string, typeof games>()
  for (const g of games) {
    const homeKey = `${g.event_date_id}-${g.home_team_id}`
    const awayKey = `${g.event_date_id}-${g.away_team_id}`
    if (!byDateTeam.has(homeKey)) byDateTeam.set(homeKey, [])
    if (!byDateTeam.has(awayKey)) byDateTeam.set(awayKey, [])
    byDateTeam.get(homeKey)!.push(g)
    byDateTeam.get(awayKey)!.push(g)
  }

  const seenTeamConflicts = new Set<string>()
  for (const [, group] of byDateTeam.entries()) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const aEnd = timeToMinutes(a.scheduled_time) + gameDuration
      const bStart = timeToMinutes(b.scheduled_time)

      if (bStart < aEnd) {
        // Exact same time = double-book
        const conflictKey = `team-${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`
        if (seenTeamConflicts.has(conflictKey)) continue
        seenTeamConflicts.add(conflictKey)

        conflicts.push({
          type: 'team_double_book',
          severity: 'critical',
          description: `Team double-booked: Game #${a.id} (${a.scheduled_time}) and Game #${b.id} (${b.scheduled_time}) have overlapping team`,
          gameIds: [a.id, b.id],
          metadata: { overlap_min: aEnd - bStart },
        })
      }
    }
  }

  // ── Check 3: Insufficient rest ─────────────────────────────
  // Check rule-based min_rest if available, otherwise use event default
  let ruleMinRest = minRest
  const minRestRule = scheduleRules.find(r => (r.conditions as any).type === 'min_rest')
  if (minRestRule) {
    const ruleMinutes = (minRestRule.conditions as any).minutes as number | undefined
    if (ruleMinutes) ruleMinRest = ruleMinutes
  }

  const seenRestConflicts = new Set<string>()
  for (const [, group] of byDateTeam.entries()) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time)
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const aEnd = timeToMinutes(a.scheduled_time) + gameDuration
      const bStart = timeToMinutes(b.scheduled_time)
      const rest = bStart - aEnd

      // Not overlapping but rest is under minimum
      if (rest >= 0 && rest < ruleMinRest) {
        const conflictKey = `rest-${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`
        if (seenRestConflicts.has(conflictKey)) continue
        seenRestConflicts.add(conflictKey)

        conflicts.push({
          type: 'insufficient_rest',
          severity: 'warning',
          description: `Only ${rest} min rest between Game #${a.id} (${a.scheduled_time}) and Game #${b.id} (${b.scheduled_time}) — minimum is ${ruleMinRest} min${minRestRule ? ` (rule: ${minRestRule.rule_name})` : ''}`,
          gameIds: [a.id, b.id],
          metadata: { rest_min: rest, required_min: ruleMinRest, rule_name: minRestRule?.rule_name ?? null },
        })
      }
    }
  }

  return {
    conflicts,
    clean: conflicts.length === 0,
    gamesScanned: games.length,
  }
}
