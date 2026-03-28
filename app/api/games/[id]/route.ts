import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateGameSchema } from '@/schemas/games'
import { insertNotification } from '@/lib/notifications'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('games')
    .select(
      `*, field:fields(*), home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)`
    )
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const result = updateGameSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.flatten() }, { status: 400 })
  }

  // 4. Business logic
  const { data, error } = await supabase
    .from('games')
    .update(result.data)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // NOT-03 gap: Direct game cancellation notification (D-19)
  if (result.data.status === 'Cancelled' && data) {
    try {
      // Notify home team
      if (data.home_team_id) {
        await insertNotification(data.event_id, 'schedule_change', 'team', data.home_team_id, {
          title: 'Game CANCELLED',
          summary: `Game on ${data.game_date ?? 'TBD'} at ${data.scheduled_time ?? 'TBD'} has been cancelled`,
          detail: `Game ID ${data.id} cancelled by admin`,
          cta_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}?tab=schedule`,
        })
      }
      // Notify away team
      if (data.away_team_id) {
        await insertNotification(data.event_id, 'schedule_change', 'team', data.away_team_id, {
          title: 'Game CANCELLED',
          summary: `Game on ${data.game_date ?? 'TBD'} at ${data.scheduled_time ?? 'TBD'} has been cancelled`,
          detail: `Game ID ${data.id} cancelled by admin`,
          cta_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}?tab=schedule`,
        })
      }
    } catch (notifErr) {
      console.error('Failed to insert cancellation notification:', notifErr)
    }
  }

  // NOT-04 D-21: Referee no-show notification — fires when game goes Live/Starting with no refs
  if ((result.data.status === 'Live' || result.data.status === 'Starting') && data) {
    try {
      const { data: refs } = await supabase
        .from('game_referees')
        .select('id')
        .eq('game_id', data.id)
        .limit(1)

      if (!refs || refs.length === 0) {
        await insertNotification(data.event_id, 'admin_alert', 'event', null, {
          title: 'Referee No-Show',
          summary: `Game going ${result.data.status} with no referee assigned`,
          detail: `Game ${data.id}: ${data.game_date ?? ''} ${data.scheduled_time ?? ''} — Field ${data.field_id ?? 'unknown'}`,
          cta_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}?tab=refs`,
        })
      }
    } catch (notifErr) {
      console.error('Failed to insert referee no-show notification:', notifErr)
    }
  }

  // NOT-04 D-22: Registration deadline warning — check when game is set to 'Scheduled'
  if (result.data.status === 'Scheduled' && data) {
    try {
      const now = new Date()
      const fortyEightHours = new Date(now.getTime() + 48 * 60 * 60 * 1000)

      // registration_closes_at is optional (types/index.ts) — guard with optional chain
      const { data: evt } = await supabase
        .from('events')
        .select('id, registration_closes_at')
        .eq('id', data.event_id)
        .single()

      // Guard: only fire if registration_closes_at exists and is within 48h window
      if (
        evt?.registration_closes_at &&
        new Date(evt.registration_closes_at) > now &&
        new Date(evt.registration_closes_at) <= fortyEightHours
      ) {
        // D-22: Also check that open registrations exist
        const { data: openRegs } = await supabase
          .from('team_registrations')
          .select('id')
          .eq('event_id', data.event_id)
          .eq('status', 'pending')
          .limit(1)

        if (openRegs && openRegs.length > 0) {
          await insertNotification(data.event_id, 'admin_alert', 'event', null, {
            title: 'Registration Closing Soon',
            summary: `Registration closes within 48 hours (${new Date(evt.registration_closes_at).toLocaleDateString()}) and ${openRegs.length}+ pending registrations remain`,
            detail: `Event ${data.event_id} registration closes at ${evt.registration_closes_at}`,
            cta_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}?tab=settings`,
          })
        }
      }
    } catch (notifErr) {
      console.error('Failed to insert registration deadline notification:', notifErr)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('games').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
