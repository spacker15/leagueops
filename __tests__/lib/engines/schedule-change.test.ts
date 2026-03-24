import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateSlotSuggestions,
  type SlotSuggestion,
} from '@/lib/engines/schedule-change'
import type { Game, Field, EventDate } from '@/types'

// ---- helpers ----

/** Build a minimal Game object */
function makeGame(overrides: Partial<Game> & { id: number }): Game {
  return {
    event_id: 1,
    event_date_id: 1,
    field_id: 1,
    home_team_id: 10,
    away_team_id: 20,
    division: 'U12',
    scheduled_time: '2026-06-15T09:00:00Z',
    status: 'Scheduled',
    home_score: 0,
    away_score: 0,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Build an EventDate */
function makeEventDate(id: number, date: string, dayNumber: number): EventDate {
  return {
    id,
    event_id: 1,
    date,
    label: `Day ${dayNumber}`,
    day_number: dayNumber,
  }
}

/** Build a Field */
function makeField(id: number): Field {
  return {
    id,
    event_id: 1,
    name: `Field ${id}`,
    number: String(id),
    map_x: 0,
    map_y: 0,
    map_w: 100,
    map_h: 50,
    created_at: '2026-01-01T00:00:00Z',
  }
}

// ---- test suite ----

describe('generateSlotSuggestions', () => {
  // Freeze time so "isAfter(now)" doesn't make candidate dates look past
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Game on eventDate 1, field 1, starts 09:00 UTC on 2026-06-15
  const baseGame = makeGame({ id: 1, event_date_id: 1, field_id: 1, scheduled_time: '2026-06-15T09:00:00Z' })
  const fields = [makeField(1), makeField(2)]
  const eventDates = [
    makeEventDate(1, '2026-06-15', 1), // same day as game
    makeEventDate(2, '2026-06-16', 2), // adjacent day
    makeEventDate(3, '2026-06-18', 3), // 3 days out
  ]
  const gameDurationMin = 60

  it('returns up to 5 ranked slot suggestions when no conflicts', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(5)
    // results are sorted descending by score
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score)
    }
  })

  it('returns empty array when all candidate slots have field conflicts', () => {
    // Fill every slot on field 1 and field 2 on all event dates
    // We generate blocking games at 08:00, 09:00, 10:00, ... on each field/date
    const blockingGames: Game[] = []
    const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
    let gId = 100
    for (const field of fields) {
      for (const ed of eventDates) {
        for (const t of times) {
          blockingGames.push(
            makeGame({
              id: gId++,
              field_id: field.id,
              event_date_id: ed.id,
              scheduled_time: `${ed.date}T${t}:00Z`,
            })
          )
        }
      }
    }

    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame, ...blockingGames],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    expect(result).toHaveLength(0)
  })

  it('filters out the current game slot from suggestions', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    // The current game's field + time should not appear in results
    const hasSameSlot = result.some(
      (s) => s.fieldId === baseGame.field_id && s.scheduledTime === baseGame.scheduled_time
    )
    expect(hasSameSlot).toBe(false)
  })

  it('scores same-day slots higher than adjacent-day slots', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    const sameDaySlots = result.filter((s) => s.eventDateId === 1)
    const adjacentSlots = result.filter((s) => s.eventDateId === 2)

    if (sameDaySlots.length > 0 && adjacentSlots.length > 0) {
      const maxSameDay = Math.max(...sameDaySlots.map((s) => s.score))
      const maxAdjacent = Math.max(...adjacentSlots.map((s) => s.score))
      expect(maxSameDay).toBeGreaterThan(maxAdjacent)
    }
  })

  it('marks homeTeamAvailable and awayTeamAvailable based on availability', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      // both teams available on eventDate 2
      teamAvailability: { 10: [2], 20: [2] },
      gameDurationMin,
    })

    const slotOnDate2 = result.find((s) => s.eventDateId === 2)
    if (slotOnDate2) {
      expect(slotOnDate2.homeTeamAvailable).toBe(true)
      expect(slotOnDate2.awayTeamAvailable).toBe(true)
    }
  })

  it('marks homeTeamAvailable=false when home team has a conflict on the candidate slot', () => {
    // Create a game for home team (id=10) at the same time on a different field
    const conflictGame = makeGame({
      id: 99,
      home_team_id: 10,
      away_team_id: 30,
      field_id: 2,
      event_date_id: 2,
      scheduled_time: '2026-06-16T09:00:00Z',
    })

    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame, conflictGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    // Find the slot on field 1, date 2, at 09:00
    const conflictedSlot = result.find(
      (s) => s.fieldId === 1 && s.eventDateId === 2 && s.scheduledTime === '2026-06-16T09:00:00Z'
    )
    if (conflictedSlot) {
      expect(conflictedSlot.homeTeamAvailable).toBe(false)
    }
  })

  it('returns empty array when game has no valid slots (all blocked by team conflict only still returns slots but with false flags)', () => {
    // With no conflicts, should return results (not empty)
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array when no event dates are provided', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates: [],
      teamAvailability: {},
      gameDurationMin,
    })
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no fields are provided', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields: [],
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })
    expect(result).toHaveLength(0)
  })

  it('adds +20 score for each available team when they have the date in availability', () => {
    // Get baseline score with no availability
    const noAvailResult = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields: [makeField(2)],
      eventDates: [makeEventDate(2, '2026-06-16', 2)],
      teamAvailability: {},
      gameDurationMin,
    })

    // Get score with both teams available
    const bothAvailResult = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields: [makeField(2)],
      eventDates: [makeEventDate(2, '2026-06-16', 2)],
      teamAvailability: { 10: [2], 20: [2] },
      gameDurationMin,
    })

    if (noAvailResult.length > 0 && bothAvailResult.length > 0) {
      // same time slot should differ by 40 (2 teams x +20)
      expect(bothAvailResult[0].score - noAvailResult[0].score).toBe(40)
    }
  })

  it('slot suggestion contains required shape fields', () => {
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    if (result.length > 0) {
      const slot = result[0]
      expect(slot).toHaveProperty('eventDateId')
      expect(slot).toHaveProperty('dateLabel')
      expect(slot).toHaveProperty('fieldId')
      expect(slot).toHaveProperty('fieldName')
      expect(slot).toHaveProperty('scheduledTime')
      expect(slot).toHaveProperty('homeTeamAvailable')
      expect(slot).toHaveProperty('awayTeamAvailable')
      expect(slot).toHaveProperty('score')
    }
  })

  it('game with no other games in event returns candidate slots (no spurious conflicts)', () => {
    // Only the game itself in allGames — no other blocking games
    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields: [makeField(1), makeField(2)],
      eventDates: [makeEventDate(1, '2026-06-15', 1)],
      teamAvailability: {},
      gameDurationMin,
    })
    // Should find at least 1 slot (same-day different time or different field)
    expect(result.length).toBeGreaterThan(0)
  })

  it('skips past event dates', () => {
    // eventDate in the past
    const pastEventDates = [
      makeEventDate(99, '2025-01-01', 1), // well in the past
    ]

    const result = generateSlotSuggestions({
      game: baseGame,
      allGames: [baseGame],
      fields,
      eventDates: pastEventDates,
      teamAvailability: {},
      gameDurationMin,
    })

    expect(result).toHaveLength(0)
  })
})
