import { createClient } from '@/supabase/client'
import type {
  Event,
  EventDate,
  Field,
  FieldAvailability,
  Team,
  Player,
  Game,
  Referee,
  RefAssignment,
  Volunteer,
  VolAssignment,
  PlayerCheckin,
  Incident,
  MedicalIncident,
  WeatherAlert,
  OpsLogEntry,
  LogType,
  GameStatus,
  NotificationLogEntry,
  ScheduleChangeRequest,
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
  const { data } = await sb.from('fields').select('*').eq('event_id', eventId).order('id')
  return data ?? []
}

export async function updateFieldMap(fieldId: number, x: number, y: number): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update({ map_x: x, map_y: y }).eq('id', fieldId)
}

export async function updateFieldFull(
  fieldId: number,
  props: {
    map_x?: number
    map_y?: number
    map_w?: number
    map_h?: number
    map_rotation?: number
    map_color?: string
    map_opacity?: number
    map_shape?: string
  }
): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update(props).eq('id', fieldId)
}

export async function updateFieldName(fieldId: number, name: string): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update({ name }).eq('id', fieldId)
}

export async function insertField(
  eventId: number,
  name: string,
  number: string,
  division = '',
  complexId?: number
): Promise<Field | null> {
  const sb = createClient()
  const { data } = await sb
    .from('fields')
    .insert({
      event_id: eventId,
      name,
      number,
      division,
      ...(complexId ? { complex_id: complexId } : {}),
    })
    .select()
    .single()
  return data
}

export async function updateFieldDetails(
  fieldId: number,
  props: { name?: string; number?: string; division?: string; complex_id?: number | null }
): Promise<void> {
  const sb = createClient()
  await sb.from('fields').update(props).eq('id', fieldId)
}

export async function deleteField(fieldId: number): Promise<void> {
  const sb = createClient()
  await sb.from('fields').delete().eq('id', fieldId)
}

// ---- Field Availability ----
export async function getFieldAvailability(eventId: number): Promise<FieldAvailability[]> {
  const sb = createClient()
  const { data } = await sb.from('field_availability').select('*').eq('event_id', eventId)
  return data ?? []
}

export async function upsertFieldAvailability(
  fieldId: number,
  eventDateId: number,
  eventId: number,
  availableFrom: string,
  availableTo: string
): Promise<void> {
  const sb = createClient()
  await sb.from('field_availability').upsert(
    {
      field_id: fieldId,
      event_date_id: eventDateId,
      event_id: eventId,
      available_from: availableFrom,
      available_to: availableTo,
    },
    { onConflict: 'field_id,event_date_id' }
  )
}

export async function bulkSetFieldAvailability(
  fieldId: number,
  eventId: number,
  eventDateIds: number[],
  availableFrom: string,
  availableTo: string
): Promise<void> {
  const sb = createClient()
  const rows = eventDateIds.map((edId) => ({
    field_id: fieldId,
    event_date_id: edId,
    event_id: eventId,
    available_from: availableFrom,
    available_to: availableTo,
  }))
  await sb.from('field_availability').upsert(rows, { onConflict: 'field_id,event_date_id' })
}

// ---- Teams ----
export async function getTeams(eventId: number): Promise<Team[]> {
  const sb = createClient()
  const { data } = await sb
    .from('teams')
    .select('*, programs(name)')
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
  const { data: teams } = await sb.from('teams').select('id').eq('event_id', eventId)
  const teamIds = (teams ?? []).map((t) => t.id)
  if (!teamIds.length) return []
  const { data } = await sb
    .from('players')
    .select('*, team:teams(*)')
    .in('team_id', teamIds)
    .order('name')
  return data ?? []
}

export async function insertPlayers(
  players: Omit<Player, 'id' | 'created_at' | 'team'>[]
): Promise<number> {
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
    .select(
      `
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*),
      event_date:event_dates(*)
    `
    )
    .eq('event_id', eventId)
    .eq('event_date_id', eventDateId)
    .order('scheduled_time')
  return (data as Game[]) ?? []
}

export async function getAllGamesByEvent(eventId: number): Promise<Game[]> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select(
      `
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*),
      event_date:event_dates(*)
    `
    )
    .eq('event_id', eventId)
    .order('scheduled_time')
  return (data as Game[]) ?? []
}

export async function getGame(gameId: number): Promise<Game | null> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select(
      `
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*),
      event_date:event_dates(*)
    `
    )
    .eq('id', gameId)
    .single()
  return data as Game | null
}

export async function updateGameStatus(gameId: number, status: GameStatus): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ status }).eq('id', gameId)
}

export async function updateGameScore(
  gameId: number,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ home_score: homeScore, away_score: awayScore }).eq('id', gameId)
}

export async function updateGameField(gameId: number, fieldId: number): Promise<void> {
  const sb = createClient()
  await sb.from('games').update({ field_id: fieldId }).eq('id', gameId)
}

export async function deleteGame(gameId: number): Promise<void> {
  const sb = createClient()
  await sb.from('games').delete().eq('id', gameId)
}

export async function insertGame(
  game: Omit<
    Game,
    | 'id'
    | 'created_at'
    | 'field'
    | 'home_team'
    | 'away_team'
    | 'event_date'
    | 'referees'
    | 'volunteers'
    | 'checkins'
  >
): Promise<Game | null> {
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
  const { data } = await sb.from('referees').select('*').eq('event_id', eventId).order('name')
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

export async function assignRef(
  gameId: number,
  refereeId: number,
  role: string = 'Center'
): Promise<void> {
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
  const { data } = await sb.from('volunteers').select('*').eq('event_id', eventId).order('role')
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
    .select(
      'game:games!inner(*, field:fields(*), home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))'
    )
    .eq('player_id', playerId)
    .neq('game_id', gameId)
  if (!data) return null
  const conflict = (data as any[]).find(
    (row: any) => row.game?.scheduled_time === time && row.game?.event_date_id === eventDateId
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

export async function insertIncident(
  incident: Omit<Incident, 'id' | 'created_at' | 'field' | 'team' | 'game'>
): Promise<Incident | null> {
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
    .eq('is_active', true)
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

export async function addOpsLog(
  eventId: number,
  message: string,
  logType: LogType = 'info'
): Promise<void> {
  const sb = createClient()
  await sb.from('ops_log').insert({
    event_id: eventId,
    message,
    log_type: logType,
    occurred_at: new Date().toISOString(),
  })
}

// ============================================================
// Phase 1 — New data access functions
// ============================================================

// ---- Complexes ----
export async function getComplexes(eventId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('complexes')
    .select('*, fields(*)')
    .eq('event_id', eventId)
    .order('name')
  return data ?? []
}

export async function insertComplex(complex: {
  event_id: number
  name: string
  address?: string
  lat?: number
  lng?: number
  lightning_radius_miles?: number
}) {
  const sb = createClient()
  const { data } = await sb.from('complexes').insert(complex).select().single()
  return data
}

export async function updateComplex(
  id: number,
  updates: Partial<{
    name: string
    address: string
    lat: number
    lng: number
    lightning_radius_miles: number
    notes: string
  }>
) {
  const sb = createClient()
  await sb.from('complexes').update(updates).eq('id', id)
}

export async function deleteComplex(id: number) {
  const sb = createClient()
  await sb.from('complexes').delete().eq('id', id)
}

// ---- Field Blocks ----
export async function getFieldBlocks(fieldId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('field_blocks')
    .select('*')
    .eq('field_id', fieldId)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at')
  return data ?? []
}

export async function getActiveFieldBlocks(eventId: number) {
  const sb = createClient()
  const now = new Date().toISOString()
  const { data: fields } = await sb.from('fields').select('id').eq('event_id', eventId)
  const fieldIds = (fields ?? []).map((f) => f.id)
  if (!fieldIds.length) return []
  const { data } = await sb
    .from('field_blocks')
    .select('*, field:fields(*)')
    .in('field_id', fieldIds)
    .lte('starts_at', now)
    .gte('ends_at', now)
  return data ?? []
}

export async function insertFieldBlock(block: {
  field_id: number
  reason: string
  starts_at: string
  ends_at: string
  notes?: string
  created_by?: string
}) {
  const sb = createClient()
  const { data } = await sb.from('field_blocks').insert(block).select().single()
  return data
}

export async function deleteFieldBlock(id: number) {
  const sb = createClient()
  await sb.from('field_blocks').delete().eq('id', id)
}

// ---- Referee Availability ----
export async function getRefAvailability(refereeId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('referee_availability')
    .select('*')
    .eq('referee_id', refereeId)
    .order('date')
  return data ?? []
}

export async function upsertRefAvailability(availability: {
  referee_id: number
  date: string
  available_from: string
  available_to: string
}) {
  const sb = createClient()
  const { data } = await sb
    .from('referee_availability')
    .upsert(availability, { onConflict: 'referee_id,date' })
    .select()
    .single()
  return data
}

// ---- Trainers ----
export async function getTrainers(eventId: number) {
  const sb = createClient()
  const { data } = await sb.from('trainers').select('*').eq('event_id', eventId).order('name')
  return data ?? []
}

export async function insertTrainer(trainer: {
  event_id: number
  name: string
  email: string | null
  phone: string | null
  certifications: string | null
}) {
  const sb = createClient()
  const { data } = await sb
    .from('trainers')
    .insert({ ...trainer, checked_in: false })
    .select()
    .single()
  return data
}

export async function deleteTrainer(id: number) {
  const sb = createClient()
  await sb.from('trainers').delete().eq('id', id)
}

export async function getTrainerAvailability(trainerId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('trainer_availability')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('date')
  return data ?? []
}

export async function upsertTrainerAvailability(trainerId: number, date: string) {
  const sb = createClient()
  await sb
    .from('trainer_availability')
    .upsert({ trainer_id: trainerId, date }, { onConflict: 'trainer_id,date' })
}

export async function deleteTrainerAvailability(id: number) {
  const sb = createClient()
  await sb.from('trainer_availability').delete().eq('id', id)
}

// ---- Operational Conflicts ----
export async function getOpenConflicts(eventId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('operational_conflicts')
    .select('*')
    .eq('event_id', eventId)
    .eq('resolved', false)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function insertConflict(conflict: {
  event_id: number
  conflict_type: string
  severity: string
  impacted_game_ids?: number[]
  impacted_ref_ids?: number[]
  impacted_field_ids?: number[]
  description: string
  resolution_options?: object[]
}) {
  const sb = createClient()
  const { data } = await sb.from('operational_conflicts').insert(conflict).select().single()
  return data
}

export async function resolveConflict(id: number, resolvedBy?: string) {
  const sb = createClient()
  await sb
    .from('operational_conflicts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy ?? 'operator',
    })
    .eq('id', id)
}

// === Phase 7: Notification helpers ===

/** Get unread notification count for current user */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const sb = createClient()
  const { count } = await sb
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
    .eq('status', 'delivered')
  return count ?? 0
}

/** Get recent notifications for dropdown (last 20) */
export async function getRecentNotifications(userId: string): Promise<NotificationLogEntry[]> {
  const sb = createClient()
  const { data } = await sb
    .from('notification_log')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(20)
  return (data ?? []) as NotificationLogEntry[]
}

/** Mark all notifications as read for current user */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const sb = createClient()
  await sb
    .from('notification_log')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

/** Mark a single notification as read */
export async function markNotificationRead(notificationId: number): Promise<void> {
  const sb = createClient()
  await sb
    .from('notification_log')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

// ---- Schedule Change Requests ----

/** Get all schedule change requests for an event, with joined games and team */
export async function getScheduleChangeRequests(eventId: number): Promise<ScheduleChangeRequest[]> {
  const sb = createClient()
  const { data } = await sb
    .from('schedule_change_requests')
    .select(
      '*, team:teams(*), games:schedule_change_request_games(*, game:games(*, event_date:event_dates(id, date, label), home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name), field:fields(id, name)))'
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data ?? []) as ScheduleChangeRequest[]
}

/** Insert a new schedule change request and its junction rows */
export async function insertScheduleChangeRequest(
  request: Omit<
    ScheduleChangeRequest,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'team'
    | 'games'
    | 'reviewed_by'
    | 'reviewed_at'
    | 'admin_notes'
  >,
  gameIds: number[]
): Promise<ScheduleChangeRequest | null> {
  const sb = createClient()
  const { data: inserted, error } = await sb
    .from('schedule_change_requests')
    .insert(request)
    .select()
    .single()
  if (error || !inserted) return null

  const junctionRows = gameIds.map((gameId) => ({
    request_id: inserted.id,
    game_id: gameId,
    status: 'pending' as const,
  }))
  await sb.from('schedule_change_request_games').insert(junctionRows)

  return inserted as ScheduleChangeRequest
}

/** Update the status, admin notes, reviewer info, and updated_at of a schedule change request */
export async function updateScheduleChangeRequestStatus(
  id: number,
  status: string,
  adminNotes?: string | null,
  reviewedBy?: string
): Promise<ScheduleChangeRequest | null> {
  const sb = createClient()
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: now,
  }
  if (adminNotes !== undefined) updatePayload.admin_notes = adminNotes
  if (reviewedBy !== undefined) updatePayload.reviewed_by = reviewedBy
  if (status === 'approved' || status === 'denied') {
    updatePayload.reviewed_at = now
  }
  const { data } = await sb
    .from('schedule_change_requests')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()
  return (data ?? null) as ScheduleChangeRequest | null
}

/** Update the status of a single schedule_change_request_games row */
export async function updateScheduleChangeRequestGameStatus(
  id: number,
  status: string
): Promise<void> {
  const sb = createClient()
  await sb.from('schedule_change_request_games').update({ status }).eq('id', id)
}
