// ============================================================
// LeagueOps — Global Types
// ============================================================

export type GameStatus = 'Scheduled' | 'Starting' | 'Live' | 'Halftime' | 'Final' | 'Delayed'
export type Division = 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'U12B' | 'U14B' | 'U16B' | 'Open'
export type IncidentType =
  | 'Player Injury'
  | 'Coach Incident'
  | 'Spectator Issue'
  | 'Field Issue'
  | 'Equipment Issue'
  | 'Weather Issue'
  | 'Warning'
  | 'Ejection'
export type VolunteerRole = 'Score Table' | 'Clock' | 'Field Marshal' | 'Operations' | 'Gate'
export type InjuryType = 'Knee / Leg' | 'Head / Concussion' | 'Ankle / Foot' | 'Arm / Shoulder' | 'General / Unknown'
export type MedicalStatus = 'Dispatched' | 'On Site' | 'Transported' | 'Released' | 'Resolved'
export type LogType = 'info' | 'alert' | 'warn' | 'ok'

// ---- Database row types (match Supabase schema) ----

export interface Event {
  id: number
  name: string
  location: string
  start_date: string
  end_date: string
  created_at: string
}

export interface EventDate {
  id: number
  event_id: number
  date: string
  label: string
  day_number: number
}

export interface Field {
  id: number
  event_id: number
  name: string
  number: string
  map_x: number
  map_y: number
  map_w: number
  map_h: number
  map_rotation?: number
  map_color?: string
  map_opacity?: number
  map_shape?: string
  created_at: string
}

export interface Team {
  id: number
  event_id: number
  name: string
  division: string
  association: string | null
  color: string
  created_at: string
}

export interface Player {
  id: number
  team_id: number
  name: string
  number: number | null
  position: string | null
  created_at: string
  team?: Team
}

export interface Game {
  id: number
  event_id: number
  event_date_id: number
  field_id: number
  home_team_id: number
  away_team_id: number
  division: string
  scheduled_time: string
  status: GameStatus
  home_score: number
  away_score: number
  notes: string | null
  created_at: string
  // Joined
  field?: Field
  home_team?: Team
  away_team?: Team
  event_date?: EventDate
  referees?: Referee[]
  volunteers?: Volunteer[]
  checkins?: PlayerCheckin[]
}

export interface Referee {
  id: number
  event_id: number
  name: string
  grade_level: string
  phone: string | null
  email: string | null
  checked_in: boolean
  created_at: string
}

export interface RefAssignment {
  id: number
  game_id: number
  referee_id: number
  role: string
  created_at: string
  referee?: Referee
}

export interface Volunteer {
  id: number
  event_id: number
  name: string
  role: VolunteerRole
  phone: string | null
  checked_in: boolean
  created_at: string
}

export interface VolAssignment {
  id: number
  game_id: number
  volunteer_id: number
  created_at: string
  volunteer?: Volunteer
}

export interface PlayerCheckin {
  id: number
  game_id: number
  player_id: number
  checked_in_at: string
  player?: Player
}

export interface Incident {
  id: number
  event_id: number
  game_id: number | null
  field_id: number | null
  team_id: number | null
  type: IncidentType
  person_involved: string | null
  description: string
  occurred_at: string
  created_at: string
  // Joined
  field?: Field
  team?: Team
  game?: Game
}

export interface MedicalIncident {
  id: number
  event_id: number
  game_id: number | null
  field_id: number | null
  player_name: string
  team_name: string | null
  injury_type: InjuryType
  trainer_name: string
  status: MedicalStatus
  notes: string | null
  dispatched_at: string
  created_at: string
  field?: Field
}

export interface WeatherAlert {
  id: number
  event_id: number
  alert_type: string
  description: string
  is_active: boolean
  lightning_delay_start: string | null
  lightning_delay_end: string | null
  created_at: string
}

export interface OpsLogEntry {
  id: number
  event_id: number
  message: string
  log_type: LogType
  occurred_at: string
  created_at: string
}

// ---- UI / derived types ----

export interface FieldBoardCard {
  field: Field
  game: Game | null
}

export interface StatusCounts {
  scheduled: number
  starting: number
  live: number
  halftime: number
  final: number
  delayed: number
}

export interface CoverageStats {
  refs_assigned: number
  refs_total: number
  refs_checked_in: number
  vols_score_table: number
  vols_clock: number
  vols_field_marshal: number
  vols_operations: number
}

export interface SchedulingEngineInput {
  teams: Array<{ name: string; division: string }>
  fields: string[]
  gamesPerTeam: number
  gameDurationMinutes: number
  startTime: string
  minRestMinutes: number
  dayIndex: number
}

export interface GeneratedGame {
  time: string
  field: string
  home: string
  away: string
  division: string
}

export interface RosterRow {
  team: string
  name: string
  number: string
  position: string
}
// ============================================================
// Phase 1 — New types
// ============================================================

export interface Complex {
  id: number
  event_id: number
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  lightning_radius_miles: number
  weather_provider: string
  notes: string | null
  created_at: string
  fields?: Field[]
}

export type FieldBlockReason = 'weather' | 'maintenance' | 'reserved' | 'lightning' | 'other'

export interface FieldBlock {
  id: number
  field_id: number
  reason: FieldBlockReason
  starts_at: string
  ends_at: string
  notes: string | null
  created_by: string | null
  created_at: string
  field?: Field
}

export interface Season {
  id: number
  name: string
  sport: string
  start_date: string
  end_date: string
  notes: string | null
  created_at: string
}

export interface RefereeAvailability {
  id: number
  referee_id: number
  date: string
  available_from: string
  available_to: string
  created_at: string
}

export type ConflictType =
  | 'ref_double_booked'
  | 'ref_unavailable'
  | 'field_overlap'
  | 'field_blocked'
  | 'weather_closure'
  | 'schedule_cascade'
  | 'missing_referee'
  | 'max_games_exceeded'

export type ConflictSeverity = 'info' | 'warning' | 'critical'

export interface ResolutionOption {
  action: string
  label: string
  params?: Record<string, unknown>
}

export interface OperationalConflict {
  id: number
  event_id: number
  conflict_type: ConflictType
  severity: ConflictSeverity
  impacted_game_ids: number[]
  impacted_ref_ids: number[]
  impacted_field_ids: number[]
  description: string
  resolution_options: ResolutionOption[]
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

// ============================================================
// Phase 3 — Weather Engine types
// ============================================================

export interface WeatherReading {
  id?: number
  complex_id: number
  event_id?: number
  temperature_f: number
  feels_like_f: number
  heat_index_f: number
  humidity_pct: number
  wind_mph: number
  wind_gust_mph: number
  wind_dir_deg: number
  conditions: string
  conditions_code: number
  visibility_mi: number
  pressure_mb: number
  cloud_pct: number
  uv_index: number
  lightning_detected: boolean
  lightning_miles: number | null
  fetched_at: string
  source?: 'live' | 'cache' | 'mock'
  complex_name?: string
}

export interface LightningEvent {
  id: number
  complex_id: number
  event_id: number
  detected_at: string
  closest_miles: number | null
  delay_started_at: string | null
  delay_ends_at: string | null
  all_clear_at: string | null
  reset_count: number
  triggered_by: string
  notes: string | null
  created_at: string
}

export type HeatProtocolLevel = 'none' | 'advisory' | 'warning' | 'emergency'

export interface WeatherEngineResult {
  reading: WeatherReading
  alerts: Array<{
    type: string
    severity: 'info' | 'warning' | 'critical'
    title: string
    description: string
    auto_action: string | null
  }>
  actions_taken: string[]
  games_affected: number
  lightning_active: boolean
  heat_protocol: HeatProtocolLevel
}
