/**
 * schedule-change.ts
 *
 * Pure TypeScript slot suggestion engine — no Supabase client dependency.
 * Takes pre-fetched game/field/date data and returns ranked alternative
 * time slots for rescheduling a game.
 *
 * SCR-04, SCR-05
 */

import { isSameDay, isAfter, differenceInCalendarDays } from 'date-fns'
import type { Game, Field, EventDate } from '@/types'

// ---- Public interface ----

export interface SlotSuggestion {
  eventDateId: number
  dateLabel: string
  fieldId: number
  fieldName: string
  scheduledTime: string // ISO 8601 timestamptz
  homeTeamAvailable: boolean
  awayTeamAvailable: boolean
  score: number
}

// ---- Exported function ----

export function generateSlotSuggestions(params: {
  game: Game
  allGames: Game[]
  fields: Field[]
  eventDates: EventDate[]
  teamAvailability: Record<number, number[]> // teamId -> available event_date_ids
  gameDurationMin: number
}): SlotSuggestion[] {
  const { game, allGames, fields, eventDates, teamAvailability, gameDurationMin } = params

  const now = new Date()
  const originalDate = new Date(game.scheduled_time)

  const suggestions: SlotSuggestion[] = []

  for (const eventDate of eventDates) {
    // Skip past event dates — only future dates are candidates
    const candidateDateStart = new Date(eventDate.date + 'T00:00:00Z')
    if (!isAfter(candidateDateStart, now) && !isSameDay(candidateDateStart, now)) {
      // More precise: skip if the eventDate is strictly before today
      // We compare the date string against "today" by checking if any candidate
      // time on this date would be after now.
      const latestCandidateTime = new Date(eventDate.date + 'T18:00:00Z')
      if (!isAfter(latestCandidateTime, now)) {
        continue
      }
    }

    const candidateTimes = getCandidateTimes(eventDate, gameDurationMin)

    for (const field of fields) {
      for (const candidateTime of candidateTimes) {
        // Skip the game's current slot
        if (field.id === game.field_id && candidateTime === game.scheduled_time) {
          continue
        }

        const candStart = new Date(candidateTime)

        // Skip past candidate times
        if (!isAfter(candStart, now)) {
          continue
        }

        // Check field conflict: any existing game on same field overlaps candidate
        const hasFieldConflict = allGames.some(
          (g) =>
            g.id !== game.id &&
            g.field_id === field.id &&
            overlaps(new Date(g.scheduled_time), candStart, gameDurationMin)
        )

        if (hasFieldConflict) {
          // Hard filter — skip this slot entirely
          continue
        }

        // Check team conflicts
        const homeConflict = allGames.some(
          (g) =>
            g.id !== game.id &&
            (g.home_team_id === game.home_team_id || g.away_team_id === game.home_team_id) &&
            overlaps(new Date(g.scheduled_time), candStart, gameDurationMin)
        )

        const awayConflict = allGames.some(
          (g) =>
            g.id !== game.id &&
            (g.home_team_id === game.away_team_id || g.away_team_id === game.away_team_id) &&
            overlaps(new Date(g.scheduled_time), candStart, gameDurationMin)
        )

        // Availability from team_availability data
        const homeAvailDates = teamAvailability[game.home_team_id] ?? []
        const awayAvailDates = teamAvailability[game.away_team_id] ?? []

        const homeHasDate = homeAvailDates.length === 0 || homeAvailDates.includes(eventDate.id)
        const awayHasDate = awayAvailDates.length === 0 || awayAvailDates.includes(eventDate.id)

        const homeTeamAvailable = !homeConflict && homeHasDate
        const awayTeamAvailable = !awayConflict && awayHasDate

        // Score calculation
        let score = 0

        const dayDiff = Math.abs(differenceInCalendarDays(new Date(eventDate.date), originalDate))
        if (dayDiff === 0) {
          score += 100
        } else if (dayDiff === 1) {
          score += 50
        } else if (dayDiff === 2) {
          score += 25
        }

        // Per-team availability bonus (+20 each)
        const homeAvailBonus = homeAvailDates.includes(eventDate.id) ? 20 : 0
        const awayAvailBonus = awayAvailDates.includes(eventDate.id) ? 20 : 0
        score += homeAvailBonus + awayAvailBonus

        suggestions.push({
          eventDateId: eventDate.id,
          dateLabel: eventDate.label,
          fieldId: field.id,
          fieldName: field.name,
          scheduledTime: candidateTime,
          homeTeamAvailable,
          awayTeamAvailable,
          score,
        })
      }
    }
  }

  // Sort descending by score, return top 5
  suggestions.sort((a, b) => b.score - a.score)
  return suggestions.slice(0, 5)
}

// ---- Internal helpers ----

/**
 * Returns true if two time windows of `durationMin` length overlap.
 * Uses raw Date arithmetic (no date-fns) per plan spec.
 */
function overlaps(aStart: Date, bStart: Date, durationMin: number): boolean {
  const durationMs = durationMin * 60_000
  const aEnd = aStart.getTime() + durationMs
  const bEnd = bStart.getTime() + durationMs
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd
}

/**
 * Returns hourly ISO time strings for the given event date,
 * stepping from 08:00 to 18:00 by max(gameDurationMin, 60) minutes.
 */
function getCandidateTimes(eventDate: EventDate, gameDurationMin: number): string[] {
  const stepMin = Math.max(gameDurationMin, 60)
  const times: string[] = []
  const startHour = 8
  const endHour = 18 // last start at 18:00

  let minuteOffset = 0
  while (true) {
    const totalMinutes = startHour * 60 + minuteOffset
    const hour = Math.floor(totalMinutes / 60)
    const min = totalMinutes % 60
    if (hour > endHour) break
    const hh = String(hour).padStart(2, '0')
    const mm = String(min).padStart(2, '0')
    times.push(`${eventDate.date}T${hh}:${mm}:00Z`)
    minuteOffset += stepMin
  }

  return times
}
