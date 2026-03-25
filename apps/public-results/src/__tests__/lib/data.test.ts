import { describe, it, expect } from 'vitest'
import type { PublicGame } from '@/lib/data'

// Pure logic test: filtering games by day and division (logic used in ScheduleTabWithSubViews)
function filterGamesByDay(games: PublicGame[], dayNumber: number): PublicGame[] {
  return games.filter((g) => g.event_date?.day_number === dayNumber)
}

function filterGamesByDivision(games: PublicGame[], division: string): PublicGame[] {
  if (division === 'ALL') return games
  return games.filter((g) => g.division === division)
}

function filterGamesByTeam(games: PublicGame[], teamId: number): PublicGame[] {
  return games.filter((g) => g.home_team?.id === teamId || g.away_team?.id === teamId)
}

const mockGames: PublicGame[] = [
  {
    id: 1,
    division: '3/4',
    scheduled_time: '09:00',
    status: 'Final',
    home_score: 3,
    away_score: 1,
    home_team: { id: 10, name: 'Team A' },
    away_team: { id: 20, name: 'Team B' },
    field: { name: 'Field 1' },
    event_date: { date: '2026-06-01', day_number: 1 },
  },
  {
    id: 2,
    division: '5/6',
    scheduled_time: '10:00',
    status: 'Scheduled',
    home_score: 0,
    away_score: 0,
    home_team: { id: 30, name: 'Team C' },
    away_team: { id: 40, name: 'Team D' },
    field: { name: 'Field 2' },
    event_date: { date: '2026-06-02', day_number: 2 },
  },
]

describe('schedule filtering', () => {
  it('filters games by day number', () => {
    expect(filterGamesByDay(mockGames, 1)).toHaveLength(1)
    expect(filterGamesByDay(mockGames, 2)).toHaveLength(1)
    expect(filterGamesByDay(mockGames, 3)).toHaveLength(0)
  })

  it('filters games by division', () => {
    expect(filterGamesByDivision(mockGames, '3/4')).toHaveLength(1)
    expect(filterGamesByDivision(mockGames, 'ALL')).toHaveLength(2)
  })

  it('filters games by team ID', () => {
    expect(filterGamesByTeam(mockGames, 10)).toHaveLength(1)
    expect(filterGamesByTeam(mockGames, 20)).toHaveLength(1)
    expect(filterGamesByTeam(mockGames, 99)).toHaveLength(0)
  })
})
