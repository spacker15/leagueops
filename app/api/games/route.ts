import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGameSchema } from '@/schemas/games'

export async function GET(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  const eventDateId = searchParams.get('event_date_id')

  if (!eventId || !eventDateId) {
    return NextResponse.json({ error: 'event_id and event_date_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
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
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse raw JSON body (SEC-07)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Zod validation (SEC-07)
  const result = createGameSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  // 4. Business logic
  const { data, error } = await supabase
    .from('games')
    .insert(result.data)
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
