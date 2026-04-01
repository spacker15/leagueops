export type AppRole = 'admin' | 'athletic_director' | 'coach' | 'parent' | 'athlete'
export type Season = 'fall' | 'winter' | 'spring'
export type GameStatus =
  | 'Scheduled'
  | 'Live'
  | 'Halftime'
  | 'Final'
  | 'Cancelled'
  | 'Postponed'
  | 'Forfeit'
export type EligibilityStatus = 'eligible' | 'ineligible' | 'probation'
export type BgCheckStatus = 'cleared' | 'pending' | 'expired'
export type IncidentType =
  | 'Injury'
  | 'Ejection'
  | 'Unsportsmanlike'
  | 'Equipment'
  | 'Weather'
  | 'Other'
export type VolunteerRole = 'Stats' | 'Time/Score' | 'Announcer' | 'Concessions' | 'Gate/Tickets'

export interface School {
  id: number
  name: string
  slug: string
  mascot?: string
  primary_color: string
  secondary_color: string
  logo_url?: string
}

export interface Sport {
  id: number
  school_id: number
  name: string
  abbreviation: string
  season: Season
  gender: string
  is_active: boolean
  sort_order: number
  teams?: Team[]
}

export interface Team {
  id: number
  sport_id: number
  school_id: number
  name: string
  division: string
  season_year: number
  win_count: number
  loss_count: number
  tie_count: number
  head_coach_id?: number
  coach?: Coach
  players?: Player[]
  sport?: Sport
}

export interface Coach {
  id: number
  school_id: number
  name: string
  email?: string
  phone?: string
  title: string
  bg_check_status: BgCheckStatus
  bg_check_expiry?: string
  certifications: { type: string; expiry: string }[]
  teams?: Team[]
}

export interface Player {
  id: number
  team_id: number
  school_id: number
  name: string
  jersey_number?: number
  position?: string
  grade_level?: string
  graduation_year?: number
  eligibility_status: EligibilityStatus
  is_active: boolean
  team?: Team
}

export interface Game {
  id: number
  team_id: number
  sport_id: number
  school_id: number
  home_team_name: string
  away_team_name: string
  is_home: boolean
  location?: string
  scheduled_date: string
  scheduled_time?: string
  status: GameStatus
  home_score: number
  away_score: number
  notes?: string
  sort_order?: number
  team?: Team
  sport?: Sport
}

export interface GameStat {
  id: number
  game_id: number
  player_id: number
  team_id: number
  stats: Record<string, number>
  player?: Player
}

export interface Volunteer {
  id: number
  school_id: number
  name: string
  email?: string
  phone?: string
  is_active: boolean
}

export interface VolunteerAssignment {
  id: number
  game_id: number
  volunteer_id: number
  role: VolunteerRole
  checked_in: boolean
  school_id: number
  volunteer?: Volunteer
  game?: Game
}

export interface Incident {
  id: number
  school_id: number
  game_id?: number
  team_id?: number
  player_id?: number
  type: IncidentType
  description: string
  severity?: string
  action_taken?: string
  reported_by?: string
  occurred_at: string
  created_at: string
  game?: Game
  team?: Team
  player?: Player
}

export interface UserRole {
  id: number
  user_id: string
  role: AppRole
  school_id: number
  coach_id?: number
  team_id?: number
  player_id?: number
  is_active: boolean
}

export interface TeamStanding {
  team: Team
  wins: number
  losses: number
  ties: number
  pct: number
  pts_for: number
  pts_against: number
}
