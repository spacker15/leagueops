import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateScheduleChangeRequestSchema } from '@/schemas/schedule-change-requests'
import { insertNotification } from '@/lib/notifications'

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  pending: ['under_review', 'denied'],
  under_review: ['approved', 'denied'],
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('schedule_change_requests')
      .select('*, team:teams(id, name), games:schedule_change_request_games(*, game:games(*))')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/schedule-change-requests/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    const result = updateScheduleChangeRequestSchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }

    const body = result.data

    // Fetch current request
    const { data: current, error: fetchError } = await supabase
      .from('schedule_change_requests')
      .select(
        'status, event_id, team_id, request_type, games:schedule_change_request_games(*, game:games(*))'
      )
      .eq('id', params.id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check user is admin
    const { data: adminRoleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('event_id', current.event_id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!adminRoleRow) {
      return NextResponse.json({ error: 'Only admins can review requests' }, { status: 403 })
    }

    // Legal transition matrix validation (D-15, SCR-08)
    const allowed = LEGAL_TRANSITIONS[current.status] ?? []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${current.status} to ${body.status}` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Determine final status — if approved + cancel, we'll update to 'completed' after game updates
    let finalStatus: string = body.status

    if (body.status === 'approved' && current.request_type === 'cancel') {
      // D-17: Cancel all games in the request
      const games = (current.games ?? []) as Array<{
        id: number
        game_id: number
        game?: {
          id: number
          home_team_id: number
          away_team_id: number
          scheduled_time: string
          field?: { name: string }
          home_team?: { name: string }
          away_team?: { name: string }
        }
      }>

      for (const reqGame of games) {
        // Update the game status to Cancelled
        await supabase.from('games').update({ status: 'Cancelled' }).eq('id', reqGame.game_id)
        // Update the junction row status
        await supabase
          .from('schedule_change_request_games')
          .update({ status: 'cancelled' })
          .eq('id', reqGame.id)

        // Notify both teams (SCR-07, D-21, D-22)
        const game = reqGame.game
        if (game) {
          const gameDate = game.scheduled_time
            ? new Date(game.scheduled_time).toLocaleDateString()
            : 'unknown date'
          const homeTeamName = game.home_team?.name ?? 'Home team'
          const awayTeamName = game.away_team?.name ?? 'Away team'

          await insertNotification(current.event_id, 'schedule_change', 'team', game.home_team_id, {
            title: 'Game cancelled',
            summary: `Your game on ${gameDate} has been cancelled`,
            detail: `${homeTeamName} vs ${awayTeamName} — cancelled by admin`,
            cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=schedule`,
          })

          await insertNotification(current.event_id, 'schedule_change', 'team', game.away_team_id, {
            title: 'Game cancelled',
            summary: `Your game on ${gameDate} has been cancelled`,
            detail: `${homeTeamName} vs ${awayTeamName} — cancelled by admin`,
            cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=schedule`,
          })
        }
      }

      // Mark request as completed since all games are cancelled
      finalStatus = 'completed'
    } else if (body.status === 'denied') {
      // Update all child game rows to denied
      const games = (current.games ?? []) as Array<{ id: number; game_id: number }>
      for (const reqGame of games) {
        await supabase
          .from('schedule_change_request_games')
          .update({ status: 'denied' })
          .eq('id', reqGame.id)
      }

      // Notify requester team (D-21 point 3)
      await insertNotification(current.event_id, 'schedule_change', 'team', current.team_id, {
        title: 'Schedule change request denied',
        summary: `Your request for ${games.length} game(s) was denied`,
        detail: body.admin_notes ?? 'No reason provided',
        cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=schedule`,
      })
    }

    // Update the request
    const { data: updated, error: updateError } = await supabase
      .from('schedule_change_requests')
      .update({
        status: finalStatus,
        admin_notes: body.admin_notes ?? null,
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PATCH /api/schedule-change-requests/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
