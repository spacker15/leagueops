import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSlotSuggestions } from '@/lib/engines/schedule-change'
import type { Game, Field, EventDate } from '@/types'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gameId = Number(req.nextUrl.searchParams.get('game_id'))
    if (!gameId || isNaN(gameId)) {
      return NextResponse.json({ error: 'game_id required' }, { status: 400 })
    }

    // Fetch the request to get event_id
    const { data: request, error: requestError } = await supabase
      .from('schedule_change_requests')
      .select('event_id, status')
      .eq('id', params.id)
      .single()

    if (requestError || !request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check user is admin
    const { data: adminRoleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('event_id', request.event_id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!adminRoleRow) {
      return NextResponse.json({ error: 'Only admins can view slot suggestions' }, { status: 403 })
    }

    const eventId = request.event_id

    // Fetch required data in parallel
    const [allGamesResult, fieldsResult, eventDatesResult, teamRegsResult] = await Promise.all([
      supabase
        .from('games')
        .select('*')
        .eq('event_id', eventId)
        .not('status', 'in', '("Final","Cancelled")'),
      supabase.from('fields').select('*').eq('event_id', eventId),
      supabase.from('event_dates').select('*').eq('event_id', eventId).order('day_number'),
      supabase.from('team_registrations').select('team_id, available_date_ids').eq('event_id', eventId),
    ])

    const allGames = (allGamesResult.data ?? []) as Game[]
    const fields = (fieldsResult.data ?? []) as Field[]
    const eventDates = (eventDatesResult.data ?? []) as EventDate[]
    const teamRegs = teamRegsResult.data ?? []

    // Find the specific game from allGames
    const game = allGames.find((g) => g.id === gameId)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Build teamAvailability map from team_registrations
    const teamAvailability: Record<number, number[]> = {}
    for (const reg of teamRegs) {
      if (reg.team_id != null) {
        teamAvailability[reg.team_id] = (reg.available_date_ids as number[]) ?? []
      }
    }

    const suggestions = generateSlotSuggestions({
      game,
      allGames,
      fields,
      eventDates,
      teamAvailability,
      gameDurationMin: 60,
    })

    return NextResponse.json({ data: suggestions })
  } catch (err) {
    console.error('GET /api/schedule-change-requests/[id]/slots error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
