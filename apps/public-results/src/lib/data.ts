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
}

export interface PublicGame {
  id: number
  division: string
  scheduled_time: string
  status: string
  home_score: number
  away_score: number
  home_team: { id: number; name: string } | null
  away_team: { id: number; name: string } | null
  field: { name: string } | null
  event_date: { date: string; day_number: number } | null
}

export interface PublicTeam {
  id: number
  name: string
  division: string
  association: string | null
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, slug, location, start_date, end_date, logo_url, public_schedule')
    .order('start_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as PublicEvent[]
}

export async function getPublicEventBySlug(slug: string): Promise<PublicEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, slug, location, start_date, end_date, logo_url, public_schedule')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as PublicEvent
}

export async function getPublicGames(eventId: number): Promise<PublicGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select(
      `
      id, division, scheduled_time, status, home_score, away_score,
      home_team:teams!games_home_team_id_fkey(id, name),
      away_team:teams!games_away_team_id_fkey(id, name),
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
    .select('id, name, division, association')
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
