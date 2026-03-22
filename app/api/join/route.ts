import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// GET /api/join?token=xxx — validate invite and return event info
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const sb = createClient()
  const { data } = await sb
    .from('registration_invites')
    .select('type, event_id, is_active, events(name, primary_color, logo_url)')
    .eq('token', token)
    .single()

  if (!data || !data.is_active) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }
  return NextResponse.json(data)
}

// POST /api/join — submit registration
export async function POST(req: NextRequest) {
  const { token, first_name, last_name, email, phone } = await req.json()

  if (!token || !first_name?.trim() || !last_name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: 'First name, last name, and email are required' },
      { status: 400 }
    )
  }

  const sb = createClient()

  const { data: invite } = await sb
    .from('registration_invites')
    .select('type, event_id')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })

  const name = `${first_name.trim()} ${last_name.trim()}`

  if (invite.type === 'referee') {
    const { error } = await sb.from('referees').insert({
      event_id: invite.event_id,
      name,
      email: email.trim(),
      phone: phone?.trim() || null,
      grade_level: 'Grade 5',
      checked_in: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await sb.from('volunteers').insert({
      event_id: invite.event_id,
      name,
      email: email.trim(),
      phone: phone?.trim() || null,
      role: 'Score Table',
      checked_in: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
