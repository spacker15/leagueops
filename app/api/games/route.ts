import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  const eventDateId = searchParams.get('event_date_id')

  if (!eventId || !eventDateId) {
    return NextResponse.json({ error: 'event_id and event_date_id required' }, { status: 400 })
  }

  const { data, error } = await sb
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()

  const { data, error } = await sb
    .from('games')
    .insert(body)
    .select(
      `
      *,
      field:fields(*),
      home_team:teams!games_home_team_id_fkey(*),
      away_team:teams!games_away_team_id_fkey(*)
    `
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
