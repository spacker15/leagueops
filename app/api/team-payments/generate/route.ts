import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/team-payments/generate
 * Auto-generates team_payment records for all registered teams.
 * Uses per-division fees from registration_fees table.
 * Skips teams that already have a team_payment record.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { event_id: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const eventId = body.event_id
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  // Fetch all teams for this event with their program info
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, name, division, program_id, programs(id, name)')
    .eq('event_id', eventId)

  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 })

  // Fetch division fees
  const { data: fees } = await supabase
    .from('registration_fees')
    .select('*')
    .eq('event_id', eventId)

  const feeMap: Record<string, number> = {}
  for (const f of fees ?? []) {
    feeMap[f.division] = Number(f.amount)
  }

  // Fetch existing team_payments to avoid duplicates
  const { data: existing } = await supabase
    .from('team_payments')
    .select('team_id')
    .eq('event_id', eventId)

  const existingTeamIds = new Set((existing ?? []).map((e: any) => e.team_id))

  // Build insert records for teams that don't already have a payment record
  const toInsert = (teams ?? [])
    .filter((t: any) => !existingTeamIds.has(t.id))
    .map((t: any) => ({
      event_id: eventId,
      team_id: t.id,
      team_name: t.name,
      division: t.division || '',
      program_name: t.programs?.name || null,
      amount_due: feeMap[t.division] ?? 0,
      amount_paid: 0,
      status: 'pending',
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, message: 'All teams already have payment records' })
  }

  const { error: insertErr } = await supabase.from('team_payments').insert(toInsert)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({
    created: toInsert.length,
    message: `Created ${toInsert.length} payment records`,
  })
}
