import { supabase } from './supabase'

export interface PublicEvent {
  id: number
  name: string
  slug: string
  location: string
  start_date: string
  end_date: string
  logo_url?: string
  public_schedule?: boolean
  public_standings?: boolean
  public_results?: boolean
  has_bracket?: boolean
}

export interface PublicGame {
  id: number
  division: string
  scheduled_time: string
  status: string
  home_score: number
  away_score: number
  home_team: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  } | null
  away_team: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  } | null
  field: { name: string } | null
  event_date: { date: string; day_number: number } | null
}

export interface PublicTeam {
  id: number
  name: string
  division: string
  association: string | null
  logo_url?: string | null
  programs?: { logo_url?: string | null } | null
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, name, slug, location, start_date, end_date, logo_url, public_schedule, public_standings, public_results, has_bracket'
    )
    .order('start_date', { ascending: false })

  if (error) {
    console.error('[getPublicEvents]', error.message, error.code, error.details)
    throw error
  }
  return (data ?? []) as PublicEvent[]
}

export async function getPublicEventBySlug(slug: string): Promise<PublicEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, name, slug, location, start_date, end_date, logo_url, public_schedule, public_standings, public_results, has_bracket'
    )
    .eq('slug', slug)
    .single()

  if (error) {
    console.error('[getPublicEventBySlug]', slug, error.message, error.code, error.details)
    return null
  }
  return data as PublicEvent
}

export async function getPublicGames(eventId: number): Promise<PublicGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select(
      `
      id, division, scheduled_time, status, home_score, away_score,
      home_team:teams!games_home_team_id_fkey(id, name, logo_url, programs(logo_url)),
      away_team:teams!games_away_team_id_fkey(id, name, logo_url, programs(logo_url)),
      field:fields(name),
      event_date:event_dates(date, day_number)
    `
    )
    .eq('event_id', eventId)
    .order('scheduled_time')

  if (error) throw error
  return (data ?? []) as unknown as PublicGame[]
}

export async function getPublicTeams(eventId: number): Promise<PublicTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, division, association, logo_url, programs(logo_url)')
    .eq('event_id', eventId)
    .order('division')
    .order('name')

  if (error) throw error
  return (data ?? []) as PublicTeam[]
}

// Compute standings from final games — pure function, safe to share
export interface Standing {
  teamId: number
  name: string
  division: string
  association: string | null
  gp: number
  w: number
  l: number
  t: number
  gf: number
  ga: number
  gd: number
  pts: number
}

export function computeStandings(teams: PublicTeam[], games: PublicGame[]): Standing[] {
  const map = new Map<number, Standing>()

  for (const team of teams) {
    map.set(team.id, {
      teamId: team.id,
      name: team.name,
      division: team.division,
      association: team.association,
      gp: 0,
      w: 0,
      l: 0,
      t: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    })
  }

  for (const game of games) {
    if (game.status !== 'Final') continue
    const homeId = game.home_team?.id
    const awayId = game.away_team?.id
    if (!homeId || !awayId) continue

    const home = map.get(homeId)
    const away = map.get(awayId)
    if (!home || !away) continue

    home.gp++
    away.gp++
    home.gf += game.home_score
    home.ga += game.away_score
    away.gf += game.away_score
    away.ga += game.home_score

    if (game.home_score > game.away_score) {
      home.w++
      home.pts += 3
      away.l++
    } else if (game.away_score > game.home_score) {
      away.w++
      away.pts += 3
      home.l++
    } else {
      home.t++
      home.pts++
      away.t++
      away.pts++
    }
  }

  for (const s of map.values()) {
    s.gd = s.gf - s.ga
  }

  return Array.from(map.values())
}

// New types for Phase 9 bracket and extended queries

export interface PublicEventDate {
  id: number
  date: string
  day_number: number
  label: string | null
}

export interface PublicField {
  id: number
  name: string
}

export interface BracketRound {
  id: number
  format: 'single' | 'double'
  bracket_side: 'winners' | 'losers' | 'grand_final'
  round_number: number
  round_label: string | null
  matchups: BracketMatchup[]
}

export interface BracketMatchup {
  id: number
  seed_top: number | null
  seed_bottom: number | null
  team_top: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  } | null
  team_bottom: {
    id: number
    name: string
    logo_url?: string | null
    programs?: { logo_url?: string | null } | null
  } | null
  game_id: number | null
  score_top: number
  score_bottom: number
  winner_id: number | null
  position: number
}

export interface ViewStanding {
  team_id: number
  team_name: string
  division: string
  association: string | null
  event_id: number
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  goal_diff: number
}

export async function getPublicEventDates(eventId: number): Promise<PublicEventDate[]> {
  const { data, error } = await supabase
    .from('event_dates')
    .select('id, date, day_number, label')
    .eq('event_id', eventId)
    .order('day_number')

  if (error) throw error
  return (data ?? []) as PublicEventDate[]
}

export async function getPublicFields(eventId: number): Promise<PublicField[]> {
  const { data, error } = await supabase
    .from('fields')
    .select('id, name')
    .eq('event_id', eventId)
    .order('name')

  if (error) throw error
  return (data ?? []) as PublicField[]
}

export async function getPublicStandings(eventId: number): Promise<ViewStanding[]> {
  const { data, error } = await supabase
    .from('standings_by_division')
    .select('*')
    .eq('event_id', eventId)
    .order('division')
    .order('wins', { ascending: false })
    .order('goal_diff', { ascending: false })

  if (error) throw error
  return (data ?? []) as ViewStanding[]
}

export async function getPublicBracket(eventId: number): Promise<{
  format: 'single' | 'double' | null
  rounds: BracketRound[]
}> {
  const { data, error } = await supabase
    .from('bracket_rounds')
    .select(
      `
      id, format, bracket_side, round_number, round_label,
      matchups:bracket_matchups(
        id, seed_top, seed_bottom, score_top, score_bottom, winner_id, position, game_id,
        team_top:teams!bracket_matchups_team_top_id_fkey(id, name, logo_url, programs(logo_url)),
        team_bottom:teams!bracket_matchups_team_bottom_id_fkey(id, name, logo_url, programs(logo_url))
      )
    `
    )
    .eq('event_id', eventId)
    .order('round_number')

  if (error || !data?.length) return { format: null, rounds: [] }
  const format = (data[0] as unknown as BracketRound).format
  return { format, rounds: data as unknown as BracketRound[] }
}
