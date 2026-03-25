import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock supabase module to prevent "supabaseUrl is required" error at import time
vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

import { computeStandings } from '@/lib/data'
import type { PublicTeam, PublicGame } from '@/lib/data'

const teams: PublicTeam[] = [
  { id: 1, name: 'Sharks', division: '3/4', association: null },
  { id: 2, name: 'Eagles', division: '3/4', association: null },
]

describe('computeStandings', () => {
  it('counts wins and losses from Final games', () => {
    const games: PublicGame[] = [
      {
        id: 100,
        division: '3/4',
        scheduled_time: '09:00',
        status: 'Final',
        home_score: 5,
        away_score: 2,
        home_team: { id: 1, name: 'Sharks' },
        away_team: { id: 2, name: 'Eagles' },
        field: { name: 'F1' },
        event_date: { date: '2026-06-01', day_number: 1 },
      },
    ]
    const standings = computeStandings(teams, games)
    const sharks = standings.find((s) => s.teamId === 1)
    const eagles = standings.find((s) => s.teamId === 2)
    expect(sharks?.w).toBe(1)
    expect(sharks?.l).toBe(0)
    expect(eagles?.w).toBe(0)
    expect(eagles?.l).toBe(1)
  })

  it('ignores non-Final games', () => {
    const games: PublicGame[] = [
      {
        id: 101,
        division: '3/4',
        scheduled_time: '09:00',
        status: 'Scheduled',
        home_score: 0,
        away_score: 0,
        home_team: { id: 1, name: 'Sharks' },
        away_team: { id: 2, name: 'Eagles' },
        field: { name: 'F1' },
        event_date: { date: '2026-06-01', day_number: 1 },
      },
    ]
    const standings = computeStandings(teams, games)
    expect(standings.every((s) => s.w === 0 && s.l === 0)).toBe(true)
  })

  it('calculates goal difference correctly', () => {
    const games: PublicGame[] = [
      {
        id: 102,
        division: '3/4',
        scheduled_time: '09:00',
        status: 'Final',
        home_score: 4,
        away_score: 1,
        home_team: { id: 1, name: 'Sharks' },
        away_team: { id: 2, name: 'Eagles' },
        field: { name: 'F1' },
        event_date: { date: '2026-06-01', day_number: 1 },
      },
    ]
    const standings = computeStandings(teams, games)
    const sharks = standings.find((s) => s.teamId === 1)
    expect(sharks?.gd).toBe(3)
    expect(sharks?.gf).toBe(4)
    expect(sharks?.ga).toBe(1)
  })

  it('returns all teams even if they have no games', () => {
    const standings = computeStandings(teams, [])
    expect(standings).toHaveLength(2)
    expect(standings.every((s) => s.w === 0 && s.l === 0 && s.t === 0)).toBe(true)
  })
})
