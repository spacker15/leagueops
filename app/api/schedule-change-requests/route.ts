import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScheduleChangeRequestSchema } from '@/schemas/schedule-change-requests'
import { insertNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = Number(req.nextUrl.searchParams.get('event_id'))
    if (!eventId || isNaN(eventId)) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('schedule_change_requests')
      .select('*, team:teams(id, name), games:schedule_change_request_games(*, game:games(*))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/schedule-change-requests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = Number(req.nextUrl.searchParams.get('event_id'))
    if (!eventId || isNaN(eventId)) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = createScheduleChangeRequestSchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }

    const body = result.data

    // Check user role — must be coach or program_leader
    const { data: userRoleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .in('role', ['coach', 'program_leader'])
      .maybeSingle()

    if (roleError || !userRoleRow) {
      return NextResponse.json(
        { error: 'Only coaches and program leaders can submit requests' },
        { status: 403 }
      )
    }

    // Verify all game_ids belong to the requesting team and event
    const { data: validGames, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('event_id', eventId)
      .in('id', body.game_ids)
      .or(`home_team_id.eq.${body.team_id},away_team_id.eq.${body.team_id}`)

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 })
    }

    if (!validGames || validGames.length !== body.game_ids.length) {
      return NextResponse.json({ error: 'Invalid game selection' }, { status: 400 })
    }

    // Insert the request row
    const { data: insertedRequest, error: insertError } = await supabase
      .from('schedule_change_requests')
      .insert({
        event_id: eventId,
        submitted_by: user.id,
        submitted_by_role: userRoleRow.role,
        team_id: body.team_id,
        request_type: body.request_type,
        reason_category: body.reason_category,
        reason_details: body.reason_details ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError || !insertedRequest) {
      return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
    }

    // Insert junction rows
    const junctionRows = body.game_ids.map((gameId) => ({
      request_id: insertedRequest.id,
      game_id: gameId,
      status: 'pending',
    }))

    const { error: junctionError } = await supabase
      .from('schedule_change_request_games')
      .insert(junctionRows)

    if (junctionError) {
      console.error('Failed to insert junction rows:', junctionError)
    }

    // Fetch team name for notification
    const { data: teamRow } = await supabase
      .from('teams')
      .select('name')
      .eq('id', body.team_id)
      .single()

    const teamName = teamRow?.name ?? 'Unknown team'

    // Trigger admin notification (SCR-02, D-21, D-23)
    try {
      await insertNotification(eventId, 'schedule_change', 'event', null, {
        title: 'New schedule change request',
        summary: `${teamName} requested changes to ${body.game_ids.length} game(s)`,
        detail: `Reason: ${body.reason_category}. ${body.reason_details ?? ''}`.trim(),
        cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=requests&id=${insertedRequest.id}`,
      })
    } catch (notifErr) {
      console.error('Failed to insert new-request admin notification:', notifErr)
    }

    return NextResponse.json({ data: insertedRequest }, { status: 201 })
  } catch (err) {
    console.error('POST /api/schedule-change-requests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
