import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GameStatus, LogType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function statusColor(status: GameStatus): string {
  const map: Record<GameStatus, string> = {
    Scheduled: 'text-blue-300',
    Starting: 'text-orange-400',
    Live: 'text-green-400',
    Halftime: 'text-yellow-400',
    Final: 'text-muted',
    Delayed: 'text-red-400',
    Cancelled: 'text-muted',
    Unscheduled: 'text-slate-400',
  }
  return map[status] ?? 'text-muted'
}

export function statusBg(status: GameStatus): string {
  const map: Record<GameStatus, string> = {
    Scheduled: 'bg-blue-900/30 text-blue-300',
    Starting: 'bg-orange-900/30 text-orange-400',
    Live: 'bg-green-900/30 text-green-400',
    Halftime: 'bg-yellow-900/30 text-yellow-400',
    Final: 'bg-gray-800/50 text-gray-400',
    Delayed: 'bg-red-900/30 text-red-400',
    Cancelled: 'bg-gray-800/50 text-gray-400',
    Unscheduled: 'bg-slate-800/50 text-slate-400',
  }
  return map[status] ?? 'bg-gray-700 text-gray-300'
}

export function logTypeColor(type: LogType): string {
  const map: Record<LogType, string> = {
    info: 'text-gray-300',
    ok: 'text-green-400',
    warn: 'text-yellow-400',
    alert: 'text-red-400',
  }
  return map[type] ?? 'text-gray-300'
}

export function nextGameStatus(current: GameStatus): GameStatus | null {
  const cycle: Partial<Record<GameStatus, GameStatus>> = {
    Scheduled: 'Starting',
    Starting: 'Live',
    Live: 'Halftime',
    Halftime: 'Live',
    Delayed: 'Live',
  }
  return cycle[current] ?? null
}

export function nextStatusLabel(current: GameStatus): string {
  const labels: Partial<Record<GameStatus, string>> = {
    Scheduled: 'START',
    Starting: 'GO LIVE',
    Live: 'HALFTIME',
    Halftime: '2ND HALF',
    Delayed: 'RESUME',
  }
  return labels[current] ?? '—'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function parseRosterCSV(text: string) {
  const lines = text.trim().split('\n')
  return lines
    .map((line) => line.split(',').map((c) => c.trim()))
    .filter((cols) => cols.length >= 2 && cols[0] && cols[1])
    .map((cols) => ({
      team: cols[0],
      name: cols[1],
      number: cols[2] ?? '',
      position: cols[3] ?? '',
    }))
}

export function generateSchedule(input: {
  teams: Array<{ name: string; division: string }>
  fields: string[]
  gamesPerTeam: number
  gameDurationMinutes: number
  startTime: string
  minRestMinutes: number
}): Array<{ time: string; field: string; home: string; away: string; division: string }> {
  const { teams, fields, gamesPerTeam, gameDurationMinutes, startTime, minRestMinutes } = input

  // Group by division
  const byDiv: Record<string, string[]> = {}
  for (const t of teams) {
    if (!byDiv[t.division]) byDiv[t.division] = []
    byDiv[t.division].push(t.name)
  }

  // Generate all matchup pairs per division
  const matchups: Array<[string, string, string]> = []
  for (const [div, divTeams] of Object.entries(byDiv)) {
    const pairs: Array<[string, string, string]> = []
    for (let i = 0; i < divTeams.length; i++) {
      for (let j = i + 1; j < divTeams.length; j++) {
        pairs.push([divTeams[i], divTeams[j], div])
      }
    }
    const needed = Math.ceil((divTeams.length * gamesPerTeam) / 2)
    for (let k = 0; k < needed; k++) {
      pairs.forEach((p) => matchups.push([...p] as [string, string, string]))
    }
  }

  const [sh, sm] = startTime.split(':').map(Number)
  let slotMin = sh * 60 + sm
  const schedule: Array<{
    time: string
    field: string
    home: string
    away: string
    division: string
  }> = []
  let fieldIdx = 0
  const teamLastGame: Record<string, number> = {}
  const maxGames = gamesPerTeam * teams.length
  let gameCount = 0

  for (const [home, away, div] of matchups) {
    if (gameCount >= maxGames) break

    const homeMin = teamLastGame[home] ?? 0
    const awayMin = teamLastGame[away] ?? 0
    const earliest = Math.max(homeMin + minRestMinutes, awayMin + minRestMinutes)
    if (slotMin < earliest) {
      slotMin = Math.ceil(earliest / (gameDurationMinutes + 10)) * (gameDurationMinutes + 10)
    }

    const hr = Math.floor(slotMin / 60)
    const mn = slotMin % 60
    const ampm = hr >= 12 ? 'PM' : 'AM'
    const dhr = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr
    const timeStr = `${dhr}:${mn.toString().padStart(2, '0')} ${ampm}`

    schedule.push({
      time: timeStr,
      field: fields[fieldIdx % fields.length],
      home,
      away,
      division: div,
    })
    teamLastGame[home] = slotMin
    teamLastGame[away] = slotMin
    fieldIdx++
    gameCount++

    if (fieldIdx % fields.length === 0) slotMin += gameDurationMinutes + 10
  }

  return schedule
}

// ─── CSV Fuzzy Matching ──────────────────────────────────────

export interface FuzzyCandidate {
  id: number | string
  name: string
}

export interface FuzzyResult extends FuzzyCandidate {
  score: number
}

export function fuzzyMatch(input: string, candidates: FuzzyCandidate[]): FuzzyResult[] {
  const inputLower = input.toLowerCase().trim()

  return candidates
    .map((c) => {
      const candLower = c.name.toLowerCase().trim()

      // Exact match
      if (inputLower === candLower) return { ...c, score: 1 }

      // Contains match
      if (candLower.includes(inputLower) || inputLower.includes(candLower))
        return { ...c, score: 0.8 }

      // Word overlap
      const inputWords = inputLower.split(/\s+/)
      const candWords = candLower.split(/\s+/)
      const overlap = inputWords.filter((w) =>
        candWords.some((cw) => cw.includes(w) || w.includes(cw))
      ).length
      const wordScore = overlap / Math.max(inputWords.length, candWords.length)
      if (wordScore > 0.3) return { ...c, score: wordScore * 0.7 }

      // Character overlap ratio
      const chars = new Set(inputLower.split(''))
      const matching = [...chars].filter((ch) => candLower.includes(ch)).length
      const charScore = matching / Math.max(inputLower.length, candLower.length)
      if (charScore > 0.5) return { ...c, score: charScore * 0.5 }

      return { ...c, score: 0 }
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export interface CsvMismatch {
  csvValue: string
  column: string
  suggestions: FuzzyResult[]
  resolvedTo: string | null // id or '__skip__'
}

export function findCsvMismatches(
  csvValues: string[],
  candidates: FuzzyCandidate[],
  column: string
): CsvMismatch[] {
  const seen = new Set<string>()
  const mismatches: CsvMismatch[] = []
  const candLowerMap = new Map(candidates.map((c) => [c.name.toLowerCase().trim(), c]))

  for (const val of csvValues) {
    const key = val.toLowerCase().trim()
    if (!key || seen.has(key)) continue
    seen.add(key)

    const exact = candLowerMap.get(key)
    if (exact) continue // Exact match, no mismatch

    const suggestions = fuzzyMatch(val, candidates)
    mismatches.push({ csvValue: val, column, suggestions, resolvedTo: null })
  }

  return mismatches
}
