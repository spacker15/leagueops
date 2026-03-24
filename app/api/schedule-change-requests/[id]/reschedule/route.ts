import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/notifications'

const rescheduleSchema = z.object({
  game_id: z.number().int().positive(),
  request_game_id: z.number().int().positive(),
  new_field_id: z.number().int().positive(),
  new_scheduled_time: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = rescheduleSchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }

    const body = result.data

    // Fetch the request to verify it exists and check status
    const { data: request, error: requestError } = await supabase
      .from('schedule_change_requests')
      .select('event_id, status, team_id, games:schedule_change_request_games(id, game_id, status)')
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
      return NextResponse.json({ error: 'Only admins can reschedule games' }, { status: 403 })
    }

    if (!['pending', 'approved', 'under_review'].includes(request.status)) {
      return NextResponse.json(
        { error: `Cannot reschedule a request with status: ${request.status}` },
        { status: 400 }
      )
    }

    // Call the RPC atomically (SCR-06)
    const { data: rpcData, error: rpcError } = await supabase.rpc('reschedule_game', {
      p_game_id: body.game_id,
      p_new_field_id: body.new_field_id,
      p_new_scheduled_time: body.new_scheduled_time,
      p_request_game_id: body.request_game_id,
      p_event_id: request.event_id,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (rpcData && rpcData.success === false) {
      return NextResponse.json({ error: rpcData.error }, { status: 409 })
    }

    // Fetch updated junction rows to check if all games are resolved
    const { data: updatedGames } = await supabase
      .from('schedule_change_request_games')
      .select('status')
      .eq('request_id', params.id)

    const allResolved = (updatedGames ?? []).every(
      (g: { status: string }) => g.status === 'rescheduled' || g.status === 'cancelled'
    )

    const newRequestStatus = allResolved ? 'completed' : 'partially_complete'

    await supabase
      .from('schedule_change_requests')
      .update({ status: newRequestStatus, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    // Fetch game details for notification content
    const { data: gameRow } = await supabase
      .from('games')
      .select(
        '*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name), field:fields(name)'
      )
      .eq('id', body.game_id)
      .single()

    if (gameRow) {
      const formatNewTime = new Date(body.new_scheduled_time).toLocaleString()
      const fieldName = gameRow.field?.name ?? 'Unknown field'
      const homeTeamName = gameRow.home_team?.name ?? 'Home team'
      const awayTeamName = gameRow.away_team?.name ?? 'Away team'

      // Notify both teams (SCR-07, D-21, D-22)
      await insertNotification(request.event_id, 'schedule_change', 'team', gameRow.home_team_id, {
        title: 'Game rescheduled',
        summary: `Your game has been moved to ${formatNewTime}`,
        detail: `${homeTeamName} vs ${awayTeamName} — new time: ${formatNewTime} at ${fieldName}`,
        cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=schedule`,
      })

      await insertNotification(request.event_id, 'schedule_change', 'team', gameRow.away_team_id, {
        title: 'Game rescheduled',
        summary: `Your game has been moved to ${formatNewTime}`,
        detail: `${homeTeamName} vs ${awayTeamName} — new time: ${formatNewTime} at ${fieldName}`,
        cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=schedule`,
      })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error('POST /api/schedule-change-requests/[id]/reschedule error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
