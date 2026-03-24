// PUBLIC ROUTE — no auth required (coach self-registration)
// Token-gated invite flow for coach self-registration per program+event.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publicRatelimit } from '@/lib/ratelimit'
import { detectCoachConflicts } from '@/lib/engines/coach-conflicts'

// GET /api/coach?token=xxx — validate invite and return event/team info
export async function GET(req: NextRequest) {
  // Rate limit by IP
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

  const sb = await createClient()

  const { data: invite } = await sb
    .from('coach_invites')
    .select(
      'id, program_id, event_id, is_active, expires_at, programs(name), events(name, registration_open)'
    )
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 404 })
  }

  const now = new Date()
  if (invite.expires_at && new Date(invite.expires_at) < now) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 404 })
  }

  if ((invite.events as any)?.registration_open === false) {
    return NextResponse.json({ valid: false, reason: 'closed' }, { status: 404 })
  }

  // Fetch teams for this program+event
  const { data: teams } = await sb
    .from('team_registrations')
    .select('id, team_name, division')
    .eq('program_id', invite.program_id)
    .eq('event_id', invite.event_id)

  return NextResponse.json({
    valid: true,
    programName: (invite.programs as any)?.name ?? null,
    eventName: (invite.events as any)?.name ?? null,
    teams: teams ?? [],
  })
}

// POST /api/coach — submit coach self-registration
export async function POST(req: NextRequest) {
  // Rate limit by IP
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

  const { token, firstName, lastName, email, phone, certifications, teamId } = await req.json()

  // Validate required fields
  if (!token || !firstName?.trim() || !lastName?.trim() || !email?.trim() || !teamId) {
    return NextResponse.json(
      { error: 'First name, last name, email, team, and token are required' },
      { status: 400 }
    )
  }

  const sb = await createClient()

  // Re-validate token (defense in depth) — check is_active + expires_at + registration_open
  const { data: invite } = await sb
    .from('coach_invites')
    .select(
      'id, program_id, event_id, is_active, expires_at, events(registration_open, registration_closes_at, registration_opens_at)'
    )
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }

  const now = new Date()
  if (invite.expires_at && new Date(invite.expires_at) < now) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
  }

  const eventData = invite.events as any
  if (eventData?.registration_open === false) {
    return NextResponse.json({ error: 'Registration is currently closed' }, { status: 410 })
  }
  if (eventData?.registration_closes_at && new Date(eventData.registration_closes_at) < now) {
    return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 410 })
  }
  if (eventData?.registration_opens_at && new Date(eventData.registration_opens_at) > now) {
    return NextResponse.json({ error: 'Registration is not yet open' }, { status: 410 })
  }

  // Insert into coaches table
  const { data: coach, error: coachError } = await sb
    .from('coaches')
    .insert({
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim(),
      phone: phone?.trim() || null,
      certifications: certifications?.trim() || null,
    })
    .select('id')
    .single()

  if (coachError || !coach) {
    return NextResponse.json(
      { error: coachError?.message ?? 'Failed to create coach record' },
      { status: 500 }
    )
  }

  // Insert into coach_teams
  const { error: teamError } = await sb.from('coach_teams').insert({
    coach_id: coach.id,
    team_registration_id: teamId,
    event_id: invite.event_id,
    role: 'assistant',
    added_by: 'self_registration',
  })

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 })
  }

  // Run conflict detection and upsert any conflicts to coach_conflicts table
  try {
    const { conflicts } = await detectCoachConflicts(invite.event_id, sb)
    if (conflicts.length > 0) {
      await sb.from('coach_conflicts').upsert(
        conflicts.map((c) => ({
          coach_id: c.coach_id,
          event_id: invite.event_id,
          team_ids: c.team_ids,
          resolved: false,
        })),
        { onConflict: 'coach_id,event_id' }
      )
    }
  } catch {
    // Conflict detection failure is non-fatal — registration already succeeded
  }

  // NOTE: Token is NOT marked as used (per D-05).
  // This is a per-program link, not single-use per coach.
  // Multiple coaches can self-register using the same program invite link.
  // The is_active flag is for revocation, not single-use tracking.

  return NextResponse.json({ success: true, coachId: coach.id })
}
