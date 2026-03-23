/**
 * LeagueOps — Schedule Generation Engine (#13)
 *
 * Generates round-robin game schedules within divisions.
 * Assigns games to time slots across available fields and event dates.
 * Detects scheduling conflicts (field double-booking, team double-booking,
 * insufficient rest).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

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

// ─── Main: Generate Schedule ─────────────────────────────────

export async function generateSchedule(
  eventId: number,
  sb: SupabaseClient
): Promise<GenerateResult> {
  // 1. Load teams grouped by division
  const { data: teams, error: teamsErr } = await sb
    .from('teams')
    .select('id, name, division')
    .eq('event_id', eventId)
    .order('division')
    .order('name')

  if (teamsErr) throw new Error(`Failed to load teams: ${teamsErr.message}`)
  if (!teams || teams.length === 0) throw new Error('No teams found for this event')

  const divisionMap = new Map<string, number[]>()
  for (const t of teams) {
    if (!divisionMap.has(t.division)) divisionMap.set(t.division, [])
    divisionMap.get(t.division)!.push(t.id)
  }

  // 2. Load fields
  const { data: fields, error: fieldsErr } = await sb
    .from('fields')
    .select('id, name, division')
    .eq('event_id', eventId)
    .order('id')

  if (fieldsErr) throw new Error(`Failed to load fields: ${fieldsErr.message}`)
  if (!fields || fields.length === 0) throw new Error('No fields found for this event')

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

  // 7. Assign games to time slots on available fields across dates

  // Build time slot grid: for each date, for each field, generate available slots
  interface TimeSlot {
    eventDateId: number
    fieldId: number
    timeMinutes: number
  }

  const slots: TimeSlot[] = []

  for (const ed of eventDates) {
    // Determine day of week for this date
    const dateObj = new Date(ed.date + 'T12:00:00') // noon to avoid timezone edge
    const dow = dateObj.getDay() // 0=Sun

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
          timeMinutes: t,
        })
        t += totalSlotMinutes
      }
    }
  }

  if (slots.length === 0) throw new Error('No time slots available — check event dates and schedule settings')
  if (slots.length < allMatchups.length) {
    throw new Error(
      `Not enough time slots (${slots.length}) for all matchups (${allMatchups.length}). ` +
      `Add more event dates, fields, or adjust schedule increment.`
    )
  }

  // Track usage per team per date-time to avoid team double-booking
  // Key: `${teamId}-${eventDateId}-${timeMinutes}`
  const teamSlotUsed = new Set<string>()

  const games: ScheduleGame[] = []
  let slotIdx = 0

  for (const matchup of allMatchups) {
    // Find the next available slot where neither team is already playing
    let assigned = false
    const startSearch = slotIdx

    for (let attempts = 0; attempts < slots.length; attempts++) {
      const si = (startSearch + attempts) % slots.length
      const slot = slots[si]

      const homeKey = `${matchup.home}-${slot.eventDateId}-${slot.timeMinutes}`
      const awayKey = `${matchup.away}-${slot.eventDateId}-${slot.timeMinutes}`

      if (!teamSlotUsed.has(homeKey) && !teamSlotUsed.has(awayKey)) {
        teamSlotUsed.add(homeKey)
        teamSlotUsed.add(awayKey)

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

        // Mark this slot as used (field perspective) by advancing past it
        // Remove from available pool
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
      }
    }
  }

  return {
    games,
    totalMatchups: allMatchups.length,
    teamCount: teams.length,
    fieldCount: fields.length,
    dateCount: eventDates.length,
    divisionCount: divisionMap.size,
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
      if (rest >= 0 && rest < minRest) {
        const conflictKey = `rest-${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`
        if (seenRestConflicts.has(conflictKey)) continue
        seenRestConflicts.add(conflictKey)

        conflicts.push({
          type: 'insufficient_rest',
          severity: 'warning',
          description: `Only ${rest} min rest between Game #${a.id} (${a.scheduled_time}) and Game #${b.id} (${b.scheduled_time}) — minimum is ${minRest} min`,
          gameIds: [a.id, b.id],
          metadata: { rest_min: rest, required_min: minRest },
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
