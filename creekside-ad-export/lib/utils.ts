import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GameStatus, EligibilityStatus, BgCheckStatus, TeamStanding, Game } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const STATUS_CLASS: Record<GameStatus, string> = {
  Scheduled: 'badge-scheduled',
  Live: 'badge-live',
  Halftime: 'badge-halftime',
  Final: 'badge-final',
  Cancelled: 'badge-cancelled',
  Postponed: 'badge-postponed',
  Forfeit: 'badge-forfeit',
}

export const ELIGIBILITY_CLASS: Record<EligibilityStatus, string> = {
  eligible: 'badge-eligible',
  ineligible: 'badge-ineligible',
  probation: 'badge-probation',
}

export const BGCHECK_CLASS: Record<BgCheckStatus, string> = {
  cleared: 'badge-cleared',
  pending: 'badge-pending',
  expired: 'badge-expired',
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

export function fmtTime(t?: string): string {
  if (!t) return ''
  const [hRaw, min] = t.split(':')
  const h = parseInt(hRaw)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${min} ${ampm}`
}

export function calcStandings(teams: import('@/types').Team[], games: Game[]): TeamStanding[] {
  return teams
    .map((team) => {
      const teamGames = games.filter((g) => g.team_id === team.id && g.status === 'Final')
      let wins = 0,
        losses = 0,
        ties = 0,
        ptsFor = 0,
        ptsAgainst = 0
      for (const g of teamGames) {
        const myScore = g.is_home ? g.home_score : g.away_score
        const oppScore = g.is_home ? g.away_score : g.home_score
        ptsFor += myScore
        ptsAgainst += oppScore
        if (myScore > oppScore) wins++
        else if (myScore < oppScore) losses++
        else ties++
      }
      const played = wins + losses + ties
      return {
        team,
        wins,
        losses,
        ties,
        pct: played ? wins / played : 0,
        pts_for: ptsFor,
        pts_against: ptsAgainst,
      }
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
}

export const LACROSSE_STAT_KEYS = [
  { key: 'goals', label: 'G' },
  { key: 'assists', label: 'A' },
  { key: 'shots', label: 'SH' },
  { key: 'shots_on_goal', label: 'SOG' },
  { key: 'ground_balls', label: 'GB' },
  { key: 'turnovers', label: 'TO' },
  { key: 'caused_turnovers', label: 'CT' },
  { key: 'draw_controls', label: 'DC' },
  { key: 'saves', label: 'SV', gkOnly: true },
  { key: 'goals_against', label: 'GA', gkOnly: true },
]

export const SPORT_STAT_KEYS: Record<string, { key: string; label: string; gkOnly?: boolean }[]> = {
  'Girls Lacrosse': LACROSSE_STAT_KEYS,
  'Boys Lacrosse': LACROSSE_STAT_KEYS,
  Soccer: [
    { key: 'goals', label: 'G' },
    { key: 'assists', label: 'A' },
    { key: 'shots', label: 'SH' },
    { key: 'shots_on_goal', label: 'SOG' },
    { key: 'saves', label: 'SV', gkOnly: true },
    { key: 'goals_against', label: 'GA', gkOnly: true },
  ],
  Basketball: [
    { key: 'points', label: 'PTS' },
    { key: 'rebounds', label: 'REB' },
    { key: 'assists', label: 'AST' },
    { key: 'steals', label: 'STL' },
    { key: 'blocks', label: 'BLK' },
    { key: 'turnovers', label: 'TO' },
    { key: 'fouls', label: 'PF' },
  ],
  Volleyball: [
    { key: 'kills', label: 'K' },
    { key: 'aces', label: 'ACE' },
    { key: 'digs', label: 'DIG' },
    { key: 'blocks', label: 'BLK' },
    { key: 'assists', label: 'AST' },
    { key: 'errors', label: 'ERR' },
  ],
}
