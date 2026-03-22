/**
 * LeagueOps — Referee Engine (Phase 2)
 *
 * Detects referee conflicts and writes them to operational_conflicts.
 * Called from API routes on every ref assignment change.
 *
 * Conflict types detected:
 *   ref_double_booked    — assigned to two games at the same time
 *   ref_unavailable      — assigned outside their availability window
 *   max_games_exceeded   — assigned more games than max_games_per_day
 *   missing_referee      — game has no referee assigned
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Referee,
  RefAssignment,
  RefereeAvailability,
  OperationalConflict,
  ConflictType,
  ConflictSeverity,
  ResolutionOption,
} from '@/types'

const EVENT_ID = 1

// ---- Time helpers ----

/** Parse "8:00 AM" or "14:30" into total minutes since midnight */
function parseTimeToMinutes(time: string): number {
  if (!time) return 0

  // Handle "HH:MM AM/PM" format (game scheduled_time)
  const ampm = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = parseInt(ampm[2])
    const period = ampm[3].toUpperCase()
    if (period === 'PM' && h !== 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return h * 60 + m
  }

  // Handle "HH:MM" 24-hour format (availability windows)
  const plain = time.match(/(\d+):(\d+)/)
  if (plain) {
    return parseInt(plain[1]) * 60 + parseInt(plain[2])
  }

  return 0
}

function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${dh}:${m.toString().padStart(2, '0')} ${ampm}`
}

/** Default game duration in minutes — used for overlap detection */
const GAME_DURATION_MIN = 60

// ---- Main engine ----

export interface RefereeConflict {
  type: ConflictType
  severity: ConflictSeverity
  refereeId: number
  refereeName: string
  gameIds: number[]
  description: string
  resolutionOptions: ResolutionOption[]
}

export interface RefereeEngineResult {
  conflicts: RefereeConflict[]
  clean: boolean
  summary: string
}

/**
 * Run the full referee engine for a given event date.
 * Returns detected conflicts and writes them to the DB.
 */
export async function runRefereeEngine(
  eventDateId: number,
  sb: SupabaseClient
): Promise<RefereeEngineResult> {
  // 1. Load all games for this date with their ref assignments
  const { data: games } = await sb
    .from('games')
    .select(
      `
      id, scheduled_time, division, field_id, status,
      ref_assignments(referee_id, role, referee:referees(*))
    `
    )
    .eq('event_date_id', eventDateId)
    .neq('status', 'Final')
    .order('scheduled_time')

  // 2. Load all referees with their profiles
  const { data: referees } = await sb.from('referees').select('*').eq('event_id', EVENT_ID)

  // 3. Load availability for this date
  const { data: eventDate } = await sb
    .from('event_dates')
    .select('date')
    .eq('id', eventDateId)
    .single()

  const { data: availability } = await sb
    .from('referee_availability')
    .select('*')
    .eq('date', eventDate?.date ?? '')

  if (!games || !referees) {
    return { conflicts: [], clean: true, summary: 'No data to analyze' }
  }

  const conflicts: RefereeConflict[] = []

  // ---- Build ref → games map ----
  const refGameMap = new Map<
    number,
    Array<{ gameId: number; startMin: number; endMin: number; division: string }>
  >()

  for (const game of games) {
    const assignments = (game as any).ref_assignments ?? []
    const startMin = parseTimeToMinutes(game.scheduled_time)
    const endMin = startMin + GAME_DURATION_MIN

    for (const assignment of assignments) {
      const refId = assignment.referee_id
      if (!refGameMap.has(refId)) refGameMap.set(refId, [])
      refGameMap.get(refId)!.push({
        gameId: game.id,
        startMin,
        endMin,
        division: game.division,
      })
    }
  }

  // ---- Check 1: Missing referees ----
  for (const game of games) {
    const assignments = (game as any).ref_assignments ?? []
    if (assignments.length === 0 && game.status !== 'Final') {
      conflicts.push({
        type: 'missing_referee',
        severity: 'warning',
        refereeId: 0,
        refereeName: 'Unassigned',
        gameIds: [game.id],
        description: `Game #${game.id} (${game.scheduled_time} · ${game.division}) has no referee assigned`,
        resolutionOptions: [
          {
            action: 'assign_referee',
            label: 'Assign available referee',
            params: { game_id: game.id },
          },
        ],
      })
    }
  }

  // ---- Check 2: Double booking & travel buffer ----
  for (const [refId, refGames] of refGameMap.entries()) {
    const ref = referees.find((r) => r.id === refId)
    if (!ref) continue

    const travelBuffer = (ref as any).travel_buffer_min ?? 30
    const sorted = [...refGames].sort((a, b) => a.startMin - b.startMin)

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]

        // True overlap — games at the same time
        if (b.startMin < a.endMin) {
          conflicts.push({
            type: 'ref_double_booked',
            severity: 'critical',
            refereeId: refId,
            refereeName: ref.name,
            gameIds: [a.gameId, b.gameId],
            description: `${ref.name} is double-booked: Game #${a.gameId} (${minutesToDisplay(a.startMin)}) overlaps Game #${b.gameId} (${minutesToDisplay(b.startMin)})`,
            resolutionOptions: [
              {
                action: 'remove_assignment',
                label: `Remove from Game #${a.gameId}`,
                params: { game_id: a.gameId, referee_id: refId },
              },
              {
                action: 'remove_assignment',
                label: `Remove from Game #${b.gameId}`,
                params: { game_id: b.gameId, referee_id: refId },
              },
              {
                action: 'find_replacement',
                label: 'Find available replacement',
                params: { game_id: b.gameId, time: minutesToDisplay(b.startMin) },
              },
            ],
          })
        }
        // Travel buffer violation — not enough time between games
        else if (b.startMin < a.endMin + travelBuffer) {
          const gap = b.startMin - a.endMin
          conflicts.push({
            type: 'ref_double_booked',
            severity: 'warning',
            refereeId: refId,
            refereeName: ref.name,
            gameIds: [a.gameId, b.gameId],
            description: `${ref.name} has only ${gap} min between Game #${a.gameId} and #${b.gameId} (needs ${travelBuffer} min travel buffer)`,
            resolutionOptions: [
              {
                action: 'find_replacement',
                label: `Find replacement for Game #${b.gameId}`,
                params: { game_id: b.gameId },
              },
              {
                action: 'adjust_travel_buffer',
                label: 'Waive travel buffer (confirm manually)',
                params: { referee_id: refId },
              },
            ],
          })
        }
      }
    }
  }

  // ---- Check 3: Availability window violations ----
  if (availability) {
    const availMap = new Map<number, RefereeAvailability>()
    for (const avail of availability as RefereeAvailability[]) {
      availMap.set(avail.referee_id, avail)
    }

    for (const [refId, refGames] of refGameMap.entries()) {
      const ref = referees.find((r) => r.id === refId)
      const avail = availMap.get(refId)
      if (!ref || !avail) continue

      const availFrom = parseTimeToMinutes(avail.available_from)
      const availTo = parseTimeToMinutes(avail.available_to)

      for (const game of refGames) {
        if (game.startMin < availFrom || game.endMin > availTo) {
          conflicts.push({
            type: 'ref_unavailable',
            severity: 'warning',
            refereeId: refId,
            refereeName: ref.name,
            gameIds: [game.gameId],
            description: `${ref.name} is assigned to Game #${game.gameId} at ${minutesToDisplay(game.startMin)} but is only available ${avail.available_from}–${avail.available_to}`,
            resolutionOptions: [
              {
                action: 'remove_assignment',
                label: `Remove ${ref.name} from Game #${game.gameId}`,
                params: { game_id: game.gameId, referee_id: refId },
              },
              {
                action: 'find_replacement',
                label: 'Find available replacement',
                params: { game_id: game.gameId },
              },
            ],
          })
        }
      }
    }
  }

  // ---- Check 4: Max games per day exceeded ----
  for (const [refId, refGames] of refGameMap.entries()) {
    const ref = referees.find((r) => r.id === refId)
    if (!ref) continue
    const maxGames = (ref as any).max_games_per_day ?? 4

    if (refGames.length > maxGames) {
      conflicts.push({
        type: 'max_games_exceeded',
        severity: 'warning',
        refereeId: refId,
        refereeName: ref.name,
        gameIds: refGames.map((g) => g.gameId),
        description: `${ref.name} is assigned to ${refGames.length} games (max: ${maxGames})`,
        resolutionOptions: [
          {
            action: 'find_replacement',
            label: 'Find replacement for last game',
            params: { game_id: refGames[refGames.length - 1].gameId },
          },
        ],
      })
    }
  }

  // ---- Write conflicts to DB (clear stale, insert fresh) ----
  await clearStaleConflicts(
    eventDateId,
    ['ref_double_booked', 'ref_unavailable', 'max_games_exceeded', 'missing_referee'],
    sb
  )

  for (const conflict of conflicts) {
    await sb.from('operational_conflicts').insert({
      event_id: EVENT_ID,
      conflict_type: conflict.type,
      severity: conflict.severity,
      impacted_game_ids: conflict.gameIds,
      impacted_ref_ids: conflict.refereeId > 0 ? [conflict.refereeId] : [],
      impacted_field_ids: [],
      description: conflict.description,
      resolution_options: conflict.resolutionOptions,
      resolved: false,
    })
  }

  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length

  return {
    conflicts,
    clean: conflicts.length === 0,
    summary:
      conflicts.length === 0
        ? 'All referee assignments clear'
        : `${criticalCount} critical, ${warningCount} warnings detected`,
  }
}

/** Clear existing unresolved conflicts of given types before re-running */
async function clearStaleConflicts(
  eventDateId: number,
  types: ConflictType[],
  sb: SupabaseClient
) {
  // Get game IDs for this date to scope the delete
  const { data: games } = await sb.from('games').select('id').eq('event_date_id', eventDateId)

  if (!games || games.length === 0) return
  const gameIds = games.map((g) => g.id)

  // Delete unresolved conflicts that overlap with these game IDs
  const { data: existing } = await sb
    .from('operational_conflicts')
    .select('id, impacted_game_ids')
    .eq('event_id', EVENT_ID)
    .eq('resolved', false)
    .in('conflict_type', types)

  if (!existing) return

  const toDelete = existing
    .filter((c) => (c.impacted_game_ids as number[]).some((id) => gameIds.includes(id)))
    .map((c) => c.id)

  if (toDelete.length > 0) {
    await sb.from('operational_conflicts').delete().in('id', toDelete)
  }
}

/**
 * Find available referees for a given game time slot.
 * Used by the resolution UI to suggest replacements.
 */
export async function findAvailableRefs(
  eventDateId: number,
  gameTime: string,
  division: string,
  excludeRefIds: number[] = [],
  sb: SupabaseClient
): Promise<Referee[]> {
  const { data: eventDate } = await sb
    .from('event_dates')
    .select('date')
    .eq('id', eventDateId)
    .single()

  const { data: refs } = await sb
    .from('referees')
    .select('*')
    .eq('event_id', EVENT_ID)
    .eq('checked_in', true)

  if (!refs || !eventDate) return []

  const gameStart = parseTimeToMinutes(gameTime)
  const gameEnd = gameStart + GAME_DURATION_MIN

  // Load assignments for this date
  const { data: games } = await sb
    .from('games')
    .select('id, scheduled_time, ref_assignments(referee_id)')
    .eq('event_date_id', eventDateId)

  // Build busy map
  const busyMap = new Map<number, Array<{ start: number; end: number }>>()
  for (const game of games ?? []) {
    const start = parseTimeToMinutes(game.scheduled_time)
    const end = start + GAME_DURATION_MIN
    for (const ra of (game as any).ref_assignments ?? []) {
      if (!busyMap.has(ra.referee_id)) busyMap.set(ra.referee_id, [])
      busyMap.get(ra.referee_id)!.push({ start, end })
    }
  }

  // Load availability
  const { data: availability } = await sb
    .from('referee_availability')
    .select('*')
    .eq('date', eventDate.date)

  const availMap = new Map<number, { from: number; to: number }>()
  for (const a of availability ?? []) {
    availMap.set(a.referee_id, {
      from: parseTimeToMinutes(a.available_from),
      to: parseTimeToMinutes(a.available_to),
    })
  }

  return (refs as Referee[]).filter((ref) => {
    if (excludeRefIds.includes(ref.id)) return false

    // Check availability window
    const avail = availMap.get(ref.id)
    if (avail && (gameStart < avail.from || gameEnd > avail.to)) return false

    // Check not already busy (including travel buffer)
    const travelBuffer = (ref as any).travel_buffer_min ?? 30
    const busy = busyMap.get(ref.id) ?? []
    for (const slot of busy) {
      if (gameStart < slot.end + travelBuffer && gameEnd > slot.start - travelBuffer) return false
    }

    // Check division eligibility
    const eligible = (ref as any).eligible_divisions ?? []
    if (eligible.length > 0 && !eligible.includes(division)) return false

    return true
  })
}
