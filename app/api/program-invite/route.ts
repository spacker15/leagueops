import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// POST — create or return existing invite token for a program+event
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { program_id: number; event_id: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { program_id, event_id } = body
  if (!program_id || !event_id) {
    return NextResponse.json({ error: 'program_id and event_id required' }, { status: 400 })
  }

  // Upsert: reuse existing active token or create new
  const { data: existing } = await supabase
    .from('program_invites')
    .select('token')
    .eq('program_id', program_id)
    .eq('event_id', event_id)
    .eq('is_active', true)
    .single()

  if (existing) {
    return NextResponse.json({ token: existing.token })
  }

  const { data: created, error } = await supabase
    .from('program_invites')
    .upsert({ program_id, event_id, is_active: true }, { onConflict: 'program_id,event_id' })
    .select('token')
    .single()

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create invite' },
      { status: 500 }
    )
  }

  return NextResponse.json({ token: created.token })
}

// GET — validate token and return program data (public, no auth required)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = createClient()

  // Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from('program_invites')
    .select('program_id, event_id, is_active')
    .eq('token', token)
    .single()

  if (inviteError || !invite || !invite.is_active) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Fetch program, event, teams, coaches
  const [{ data: program }, { data: event }, { data: teams }, { data: divisions }] =
    await Promise.all([
      supabase.from('programs').select('*').eq('id', invite.program_id).single(),
      supabase
        .from('events')
        .select('id, name, slug, start_date, end_date, status')
        .eq('id', invite.event_id)
        .single(),
      supabase
        .from('teams')
        .select('id, name, division, display_id, color, program_id')
        .eq('program_id', invite.program_id)
        .eq('event_id', invite.event_id)
        .order('division')
        .order('name'),
      supabase
        .from('registration_divisions')
        .select('name')
        .eq('event_id', invite.event_id)
        .eq('is_active', true)
        .order('sort_order'),
    ])

  return NextResponse.json({
    program,
    event,
    teams: teams ?? [],
    divisions: (divisions ?? []).map((d: any) => d.name),
  })
}

// PATCH — update program details via token
export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: invite } = await supabase
    .from('program_invites')
    .select('program_id, is_active')
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only allow safe fields to update
  const allowed = [
    'name',
    'short_name',
    'city',
    'state',
    'contact_name',
    'contact_email',
    'contact_phone',
    'website',
    'notes',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase.from('programs').update(updates).eq('id', invite.program_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
