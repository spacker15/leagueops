import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// POST /api/coach-invite — generate or regenerate coach invite link for a program+event
export async function POST(req: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programId, eventId } = await req.json()
  if (!programId || !eventId) {
    return NextResponse.json({ error: 'programId and eventId are required' }, { status: 400 })
  }

  // Verify user is program leader for this program
  const { data: role } = await sb
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('program_id', programId)
    .eq('role', 'program_leader')
    .maybeSingle()

  if (!role) {
    return NextResponse.json({ error: 'Forbidden — not a program leader for this program' }, { status: 403 })
  }

  // Fetch event's registration_closes_at for setting expires_at
  const { data: event } = await sb
    .from('events')
    .select('registration_closes_at')
    .eq('id', eventId)
    .maybeSingle()

  const token = crypto.randomUUID()
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/coach/${token}`

  // Upsert into coach_invites — UNIQUE(program_id, event_id) means one row per program per event
  const { data: invite, error } = await sb
    .from('coach_invites')
    .upsert(
      {
        program_id: programId,
        event_id: eventId,
        token,
        is_active: true,
        expires_at: event?.registration_closes_at ?? null,
      },
      { onConflict: 'program_id,event_id' }
    )
    .select('token')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token: invite.token, inviteUrl })
}

// DELETE /api/coach-invite — revoke coach invite link for a program+event
export async function DELETE(req: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programId, eventId } = await req.json()
  if (!programId || !eventId) {
    return NextResponse.json({ error: 'programId and eventId are required' }, { status: 400 })
  }

  // Verify user is program leader for this program
  const { data: role } = await sb
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('program_id', programId)
    .eq('role', 'program_leader')
    .maybeSingle()

  if (!role) {
    return NextResponse.json({ error: 'Forbidden — not a program leader for this program' }, { status: 403 })
  }

  const { error } = await sb
    .from('coach_invites')
    .update({ is_active: false })
    .eq('program_id', programId)
    .eq('event_id', eventId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
