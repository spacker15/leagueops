import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { publicRatelimit } from '@/lib/ratelimit'

// PUBLIC ROUTE — intentionally excluded from auth guard per SEC-02.
// Token-gated invite flow for referees and volunteers.

// GET /api/join?token=xxx — validate invite and return event info
export async function GET(req: NextRequest) {
  // Rate limit by IP (SEC-08)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success, limit, remaining, reset, pending } = await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

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
  // Rate limit by IP (SEC-08)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success, limit, remaining, reset, pending } = await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

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
  const table = invite.type === 'referee' ? 'referees' : 'volunteers'

  // Check for existing registration by email to prevent duplicates
  const { data: existing } = await sb
    .from(table)
    .select('id')
    .eq('event_id', invite.event_id)
    .ilike('email', email.trim())
    .maybeSingle()

  if (existing) {
    // Already registered — treat as success so the user sees the confirmation screen
    return NextResponse.json({ success: true, already_registered: true })
  }

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
  } else if (invite.type === 'trainer') {
    const { error } = await sb.from('trainers').insert({
      event_id: invite.event_id,
      name,
      email: email.trim(),
      phone: phone?.trim() || null,
      certifications: null,
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
