import { describe, it, expect } from 'vitest'
import {
  cn,
  statusColor,
  statusBg,
  nextGameStatus,
  nextStatusLabel,
  initials,
  parseRosterCSV,
} from '@/lib/utils'
import type { GameStatus } from '@/types'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('ignores falsy values', () => {
    expect(cn('px-2', false, undefined, null, 'py-1')).toBe('px-2 py-1')
  })
})

describe('statusColor', () => {
  it('returns correct color for each status', () => {
    const cases: Array<[GameStatus, string]> = [
      ['Scheduled', 'text-blue-300'],
      ['Live', 'text-green-400'],
      ['Halftime', 'text-yellow-400'],
      ['Final', 'text-muted'],
      ['Delayed', 'text-red-400'],
    ]
    cases.forEach(([status, expected]) => {
      expect(statusColor(status)).toBe(expected)
    })
  })
})

describe('statusBg', () => {
  it('returns a bg + text class string for each status', () => {
    const statuses: GameStatus[] = ['Scheduled', 'Starting', 'Live', 'Halftime', 'Final', 'Delayed']
    statuses.forEach((status) => {
      const result = statusBg(status)
      expect(result).toContain('bg-')
      expect(result).toContain('text-')
    })
  })
})

describe('nextGameStatus', () => {
  it('advances through the game cycle correctly', () => {
    expect(nextGameStatus('Scheduled')).toBe('Starting')
    expect(nextGameStatus('Starting')).toBe('Live')
    expect(nextGameStatus('Live')).toBe('Halftime')
    expect(nextGameStatus('Halftime')).toBe('Live')
    expect(nextGameStatus('Delayed')).toBe('Live')
  })

  it('returns null for terminal statuses', () => {
    expect(nextGameStatus('Final')).toBeNull()
  })
})

describe('nextStatusLabel', () => {
  it('returns correct action labels', () => {
    expect(nextStatusLabel('Scheduled')).toBe('START')
    expect(nextStatusLabel('Starting')).toBe('GO LIVE')
    expect(nextStatusLabel('Live')).toBe('HALFTIME')
    expect(nextStatusLabel('Halftime')).toBe('2ND HALF')
    expect(nextStatusLabel('Delayed')).toBe('RESUME')
    expect(nextStatusLabel('Final')).toBe('—')
  })
})

describe('initials', () => {
  it('returns up to 2 uppercase initials', () => {
    expect(initials('John Doe')).toBe('JD')
    expect(initials('Alice')).toBe('A')
    expect(initials('Mary Jane Watson')).toBe('MJ')
  })
})

describe('parseRosterCSV', () => {
  it('parses valid CSV rows', () => {
    const csv = `Team A,John Doe,12,Attack\nTeam A,Jane Smith,7,Midfield`
    const result = parseRosterCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      team: 'Team A',
      name: 'John Doe',
      number: '12',
      position: 'Attack',
    })
  })

  it('fills missing optional fields with empty string', () => {
    const csv = `Team B,Player One`
    const result = parseRosterCSV(csv)
    expect(result[0].number).toBe('')
    expect(result[0].position).toBe('')
  })

  it('skips rows with fewer than 2 columns', () => {
    const csv = `Team A\nTeam A,Valid Player`
    const result = parseRosterCSV(csv)
    expect(result).toHaveLength(1)
  })

  it('trims whitespace from fields', () => {
    const csv = ` Team A , John Doe , 11 `
    const result = parseRosterCSV(csv)
    expect(result[0].team).toBe('Team A')
    expect(result[0].name).toBe('John Doe')
    expect(result[0].number).toBe('11')
  })
})
