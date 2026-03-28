import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// POST — add a team to the program via invite token
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: invite } = await supabase
    .from('program_invites')
    .select('program_id, event_id, is_active')
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  let body: { name: string; division: string; color?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || !body.division) {
    return NextResponse.json({ error: 'name and division required' }, { status: 400 })
  }

  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      event_id: invite.event_id,
      program_id: invite.program_id,
      name: body.name,
      division: body.division,
      color: body.color || '#0B3D91',
    })
    .select('id, name, division, display_id, color, program_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also add to program_teams junction
  await supabase.from('program_teams').insert({
    program_id: invite.program_id,
    team_id: team.id,
    event_id: invite.event_id,
  })

  return NextResponse.json({ team }, { status: 201 })
}

// DELETE — remove a team via invite token
export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const teamId = req.nextUrl.searchParams.get('team_id')
  if (!token || !teamId) {
    return NextResponse.json({ error: 'Token and team_id required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: invite } = await supabase
    .from('program_invites')
    .select('program_id, event_id, is_active')
    .eq('token', token)
    .single()

  if (!invite || !invite.is_active) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Verify team belongs to this program
  const { data: team } = await supabase
    .from('teams')
    .select('id, program_id')
    .eq('id', Number(teamId))
    .eq('program_id', invite.program_id)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Team not found or not in this program' }, { status: 404 })
  }

  await supabase.from('program_teams').delete().eq('team_id', team.id)
  const { error } = await supabase.from('teams').delete().eq('id', team.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
