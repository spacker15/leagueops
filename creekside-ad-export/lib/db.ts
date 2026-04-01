import { createClient } from '@/supabase/client'
import type {
  School,
  Sport,
  Team,
  Coach,
  Player,
  Game,
  GameStat,
  Volunteer,
  VolunteerAssignment,
  Incident,
} from '@/types'

// ── Schools ──────────────────────────────────────────────
export async function getSchool(schoolId: number): Promise<School | null> {
  const sb = createClient()
  const { data } = await sb.from('schools').select('*').eq('id', schoolId).single()
  return data ?? null
}

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const sb = createClient()
  const { data } = await sb.from('schools').select('*').eq('slug', slug).single()
  return data ?? null
}

// ── Sports ───────────────────────────────────────────────
export async function getSports(schoolId: number): Promise<Sport[]> {
  const sb = createClient()
  const { data } = await sb.from('sports').select('*').eq('school_id', schoolId).order('sort_order')
  return data ?? []
}

export async function insertSport(sport: Omit<Sport, 'id' | 'teams'>): Promise<Sport | null> {
  const sb = createClient()
  const { data } = await sb.from('sports').insert(sport).select().single()
  return data ?? null
}

export async function updateSport(id: number, props: Partial<Sport>): Promise<void> {
  const sb = createClient()
  await sb.from('sports').update(props).eq('id', id)
}

export async function deleteSport(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('sports').delete().eq('id', id)
}

// ── Teams ────────────────────────────────────────────────
export async function getTeams(schoolId: number): Promise<Team[]> {
  const sb = createClient()
  const { data } = await sb
    .from('teams')
    .select('*, coach:coaches(*), sport:sports(*)')
    .eq('school_id', schoolId)
    .order('name')
  return data ?? []
}

export async function getTeamsBySport(sportId: number): Promise<Team[]> {
  const sb = createClient()
  const { data } = await sb
    .from('teams')
    .select('*, coach:coaches(*)')
    .eq('sport_id', sportId)
    .order('division')
  return data ?? []
}

export async function insertTeam(
  team: Omit<Team, 'id' | 'coach' | 'players' | 'sport'>
): Promise<Team | null> {
  const sb = createClient()
  const { data } = await sb.from('teams').insert(team).select().single()
  return data ?? null
}

export async function updateTeam(id: number, props: Partial<Team>): Promise<void> {
  const sb = createClient()
  await sb.from('teams').update(props).eq('id', id)
}

export async function deleteTeam(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('teams').delete().eq('id', id)
}

// ── Coaches ──────────────────────────────────────────────
export async function getCoaches(schoolId: number): Promise<Coach[]> {
  const sb = createClient()
  const { data } = await sb
    .from('coaches')
    .select('*, teams(*)')
    .eq('school_id', schoolId)
    .order('name')
  return data ?? []
}

export async function insertCoach(coach: Omit<Coach, 'id' | 'teams'>): Promise<Coach | null> {
  const sb = createClient()
  const { data } = await sb.from('coaches').insert(coach).select().single()
  return data ?? null
}

export async function updateCoach(id: number, props: Partial<Coach>): Promise<void> {
  const sb = createClient()
  await sb.from('coaches').update(props).eq('id', id)
}

export async function deleteCoach(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('coaches').delete().eq('id', id)
}

// ── Players ──────────────────────────────────────────────
export async function getPlayers(teamId: number): Promise<Player[]> {
  const sb = createClient()
  const { data } = await sb
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false })
  return data ?? []
}

export async function insertPlayer(player: Omit<Player, 'id' | 'team'>): Promise<Player | null> {
  const sb = createClient()
  const { data } = await sb.from('players').insert(player).select().single()
  return data ?? null
}

export async function updatePlayer(id: number, props: Partial<Player>): Promise<void> {
  const sb = createClient()
  await sb.from('players').update(props).eq('id', id)
}

export async function deletePlayer(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('players').update({ is_active: false }).eq('id', id)
}

// ── Games ────────────────────────────────────────────────
export async function getGames(schoolId: number): Promise<Game[]> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select('*, team:teams(*, sport:sports(*))')
    .eq('school_id', schoolId)
    .order('scheduled_date')
    .order('sort_order', { nullsFirst: false })
  return data ?? []
}

export async function getGamesByTeam(teamId: number): Promise<Game[]> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select('*')
    .eq('team_id', teamId)
    .order('scheduled_date')
    .order('sort_order', { nullsFirst: false })
  return data ?? []
}

export async function getGamesByDate(schoolId: number, date: string): Promise<Game[]> {
  const sb = createClient()
  const { data } = await sb
    .from('games')
    .select('*, team:teams(*, sport:sports(*))')
    .eq('school_id', schoolId)
    .eq('scheduled_date', date)
    .order('sort_order', { nullsFirst: false })
  return data ?? []
}

export async function insertGame(game: Omit<Game, 'id' | 'team' | 'sport'>): Promise<Game | null> {
  const sb = createClient()
  const { data } = await sb.from('games').insert(game).select().single()
  return data ?? null
}

export async function updateGame(id: number, props: Partial<Game>): Promise<void> {
  const sb = createClient()
  await sb.from('games').update(props).eq('id', id)
}

export async function deleteGame(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('games').delete().eq('id', id)
}

// ── Game Stats ───────────────────────────────────────────
export async function getGameStats(gameId: number): Promise<GameStat[]> {
  const sb = createClient()
  const { data } = await sb.from('game_stats').select('*, player:players(*)').eq('game_id', gameId)
  return data ?? []
}

export async function upsertGameStat(stat: Omit<GameStat, 'id' | 'player'>): Promise<void> {
  const sb = createClient()
  await sb.from('game_stats').upsert(stat, { onConflict: 'game_id,player_id' })
}

// ── Volunteers ───────────────────────────────────────────
export async function getVolunteers(schoolId: number): Promise<Volunteer[]> {
  const sb = createClient()
  const { data } = await sb
    .from('volunteers')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

export async function insertVolunteer(vol: Omit<Volunteer, 'id'>): Promise<Volunteer | null> {
  const sb = createClient()
  const { data } = await sb.from('volunteers').insert(vol).select().single()
  return data ?? null
}

export async function updateVolunteer(id: number, props: Partial<Volunteer>): Promise<void> {
  const sb = createClient()
  await sb.from('volunteers').update(props).eq('id', id)
}

export async function getVolunteerAssignments(gameId: number): Promise<VolunteerAssignment[]> {
  const sb = createClient()
  const { data } = await sb
    .from('volunteer_assignments')
    .select('*, volunteer:volunteers(*)')
    .eq('game_id', gameId)
  return data ?? []
}

export async function upsertVolunteerAssignment(
  assignment: Omit<VolunteerAssignment, 'id' | 'volunteer' | 'game'>
): Promise<void> {
  const sb = createClient()
  await sb
    .from('volunteer_assignments')
    .upsert(assignment, { onConflict: 'game_id,volunteer_id,role' })
}

export async function deleteVolunteerAssignment(id: number): Promise<void> {
  const sb = createClient()
  await sb.from('volunteer_assignments').delete().eq('id', id)
}

// ── Incidents ────────────────────────────────────────────
export async function getIncidents(schoolId: number): Promise<Incident[]> {
  const sb = createClient()
  const { data } = await sb
    .from('incidents')
    .select('*, game:games(*), team:teams(*), player:players(*)')
    .eq('school_id', schoolId)
    .order('occurred_at', { ascending: false })
  return data ?? []
}

export async function insertIncident(
  incident: Omit<Incident, 'id' | 'created_at' | 'game' | 'team' | 'player'>
): Promise<Incident | null> {
  const sb = createClient()
  const { data } = await sb.from('incidents').insert(incident).select().single()
  return data ?? null
}
