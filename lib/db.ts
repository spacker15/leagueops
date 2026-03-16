import { createClient } from '@/supabase/client'
import type {
  Event, EventDate, Field, Team, Player, Game, Referee, RefAssignment,
  Volunteer, VolAssignment, PlayerCheckin, Incident, MedicalIncident,
  WeatherAlert, OpsLogEntry, LogType, GameStatus,
} from '@/types'

// ---- Events ----
export async function getEvent(id: number): Promise<Event | null> {
  const sb = createClient()
  const { data } = await sb.from('events').select('*').eq('id', id).single()
  return data
}

export async function getEventDates(eventId: number): Promise<EventDate[]> {
  const sb = createClient()
  const { data } = await sb
    .from('event_dates')
    .select('*')
    .eq('event_id', eventId)
    .order('day_number')
  return data ?? []
}

// ---- Fields ----
export async function getFields(eventId: number): Promise<Field[]> {
  const sb = createClient()
  const { data } = await sb
    .from('fields')
    .select('*')
    .eq('event_id', eventId)
    .order('id')
  return data ?? []
}

export async function updateFieldMap(fieldId: number, x: number, y: number): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update({ map_x: x, map_y: y }).eq('id', fieldId)
}

export async function updateFieldName(fieldId: number, name: string): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update({ name }).eq('id', fieldId)
}

export async function insertField(eventId: number, name: string, number: string): Promise<Field | null> {
  const sb = createClient()
  const { data } = await sb
    .from('fields')
    .insert({ event_id: eventId, name, number })
    .select()
    .single()
  return data
}

// ---- Teams ----
export async function getTeams(eventId: number): Promise<Team[]> {
  const sb = createClient()
  const { data } = await sb
    .from('teams')
    .select('*')
    .eq('event_id', eventId)
    .order('division')
  return data ?? []
}

// ---- Players ----
export async function getPlayersByTeam(teamId: number): Promise<Player[]> {
  const sb = createClient()
  const { data } = await sb
    .from('players')
    .select('*, team:teams(*)')
    .eq('team_id', teamId)
    .order('number')
  return data ?? []
}

export async function getPlayersByEvent(eventId: number): Promise<Player[]> {
  const sb = createClient()
  const { data } = await sb
    .from('players')
    .select('*, team:teams!inner(*)')
    .eq('teams.event_id', eventId)
    .order('name')
  return data ?? []
}

export async function insertPlayers(players: Omit<Player, 'id' | 'created_at' | 'team'>[]): Promise<number> {
  const sb = createClient()
  const { data, error } = await sb.from('players').insert(players).select()
  if (error) throw error
  return data?.length ?? 0
}

// ---- Games ----
export async function getGamesByDate(eventId: number, eventDateId: number): Promise<Game[]> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select(`
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*),
      event_date:event_dates(*)
    `)
    .eq('event_id', eventId)
    .eq('event_date_id', eventDateId)
    .order('scheduled_time')
  return (data as Game[]) ?? []
}

export async function getGame(gameId: number): Promise<Game | null> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select(`
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*),
      event_date:event_dates(*)
    `)
    .eq('id', gameId)
    .single()
  return data as Game | null
}

export async function updateGameStatus(gameId: number, status: GameStatus): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ status }).eq('id', gameId)
}

export async function updateGameScore(gameId: number, homeScore: number, awayScore: number): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ home_score: homeScore, away_score: awayScore }).eq('id', gameId)
}

export async function updateGameField(gameId: number, fieldId: number): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ field_id: fieldId }).eq('id', gameId)
}

export async function insertGame(game: Omit<Game, 'id' | 'created_at' | 'field' | 'home_team' | 'away_team' | 'event_date' | 'referees' | 'volunteers' | 'checkins'>): Promise<Game | null> {
  const sb = createClient()
  const { data } = await sb.from('games').insert(game).select().single()
  return data
}

export async function setAllGamesDelayed(eventId: number, eventDateId: number): Promise<void> {
  const sb = createClient()
  await sb
    .from('games')
    .update({ status: 'Delayed' })
    .eq('event_id', eventId)
    .eq('event_date_id', eventDateId)
    .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
}

export async function resumeAllDelayedGames(eventId: number, eventDateId: number): Promise<void> {
  const sb = createClient()
  await sb
    .from('games')
    .update({ status: 'Scheduled' })
    .eq('event_id', eventId)
    .eq('event_date_id', eventDateId)
    .eq('status', 'Delayed')
}

// ---- Referees ----
export async function getReferees(eventId: number): Promise<Referee[]> {
  const sb = createClient()
  const { data } = await sb
    .from('referees')
    .select('*')
    .eq('event_id', eventId)
    .order('name')
  return data ?? []
}

export async function toggleRefCheckin(refId: number, checkedIn: boolean): Promise<void> {
  const sb = createClient()
  await sb.from('referees').update({ checked_in: checkedIn }).eq('id', refId)
}

export async function getRefAssignments(gameId: number): Promise<RefAssignment[]> {
  const sb = createClient()
  const { data } = await sb
    .from('ref_assignments')
    .select('*, referee:referees(*)')
    .eq('game_id', gameId)
  return data ?? []
}

export async function assignRef(gameId: number, refereeId: number, role: string = 'Center'): Promise<void> {
  const sb = createClient()
  await sb.from('ref_assignments').upsert({ game_id: gameId, referee_id: refereeId, role })
}

export async function removeRefAssignment(gameId: number, refereeId: number): Promise<void> {
  const sb = createClient()
  await sb.from('ref_assignments').delete().eq('game_id', gameId).eq('referee_id', refereeId)
}

// ---- Volunteers ----
export async function getVolunteers(eventId: number): Promise<Volunteer[]> {
  const sb = createClient()
  const { data } = await sb
    .from('volunteers')
    .select('*')
    .eq('event_id', eventId)
    .order('role')
  return data ?? []
}

export async function toggleVolCheckin(volId: number, checkedIn: boolean): Promise<void> {
  const sb = createClient()
  await sb.from('volunteers').update({ checked_in: checkedIn }).eq('id', volId)
}

export async function getVolAssignments(gameId: number): Promise<VolAssignment[]> {
  const sb = createClient()
  const { data } = await sb
    .from('vol_assignments')
    .select('*, volunteer:volunteers(*)')
    .eq('game_id', gameId)
  return data ?? []
}

export async function assignVolunteer(gameId: number, volunteerId: number): Promise<void> {
  const sb = createClient()
  await sb.from('vol_assignments').upsert({ game_id: gameId, volunteer_id: volunteerId })
}

// ---- Player Check-Ins ----
export async function getCheckins(gameId: number): Promise<PlayerCheckin[]> {
  const sb = createClient()
  const { data } = await sb
    .from('player_checkins')
    .select('*, player:players(*)')
    .eq('game_id', gameId)
  return data ?? []
}

export async function checkInPlayer(gameId: number, playerId: number): Promise<void> {
  const sb = createClient()
  await sb.from('player_checkins').upsert({ game_id: gameId, player_id: playerId })
}

export async function checkOutPlayer(gameId: number, playerId: number): Promise<void> {
  const sb = createClient()
  await sb.from('player_checkins').delete().eq('game_id', gameId).eq('player_id', playerId)
}

export async function getPlayerCheckinConflict(
  playerId: number,
  time: string,
  gameId: number,
  eventDateId: number
): Promise<Game | null> {
  const sb = createClient()
  const { data } = await sb
    .from('player_checkins')
    .select('game:games!inner(*, field:fields(*), home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))')
    .eq('player_id', playerId)
    .neq('game_id', gameId)
  if (!data) return null
  const conflict = (data as any[]).find((row: any) =>
    row.game?.scheduled_time === time && row.game?.event_date_id === eventDateId
  )
  if (!conflict) return null
  return (conflict.game as Game) ?? null
}

// ---- Incidents ----
export async function getIncidents(eventId: number): Promise<Incident[]> {
  const sb = createClient()
  const { data } = await sb
    .from('incidents')
    .select('*, field:fields(*), team:teams(*), game:games(id, scheduled_time)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data as Incident[]) ?? []
}

export async function insertIncident(incident: Omit<Incident, 'id' | 'created_at' | 'field' | 'team' | 'game'>): Promise<Incident | null> {
  const sb = createClient()
  const { data } = await sb.from('incidents').insert(incident).select().single()
  return data
}

// ---- Medical ----
export async function getMedicalIncidents(eventId: number): Promise<MedicalIncident[]> {
  const sb = createClient()
  const { data } = await sb
    .from('medical_incidents')
    .select('*, field:fields(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data as MedicalIncident[]) ?? []
}

export async function insertMedicalIncident(
  incident: Omit<MedicalIncident, 'id' | 'created_at' | 'field'>
): Promise<MedicalIncident | null> {
  const sb = createClient()
  const { data } = await sb.from('medical_incidents').insert(incident).select().single()
  return data
}

export async function updateMedicalStatus(id: number, status: string): Promise<void> {
  const sb = createClient()
  await sb.from('medical_incidents').update({ status }).eq('id', id)
}

// ---- Weather ----
export async function getWeatherAlerts(eventId: number): Promise<WeatherAlert[]> {
  const sb = createClient()
  const { data } = await sb
    .from('weather_alerts')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function insertWeatherAlert(
  alert: Omit<WeatherAlert, 'id' | 'created_at'>
): Promise<WeatherAlert | null> {
  const sb = createClient()
  const { data } = await sb.from('weather_alerts').insert(alert).select().single()
  return data
}

export async function resolveWeatherAlert(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('weather_alerts').update({ is_active: false }).eq('id', id)
}

// ---- Operations Log ----
export async function getOpsLog(eventId: number, limit = 50): Promise<OpsLogEntry[]> {
  const sb = createClient()
  const { data } = await sb
    .from('ops_log')
    .select('*')
    .eq('event_id', eventId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function addOpsLog(eventId: number, message: string, logType: LogType = 'info'): Promise<void> {
  const sb = createClient()
  await sb.from('ops_log').insert({
    event_id: eventId,
    message,
    log_type: logType,
    occurred_at: new Date().toISOString(),
  })
}
