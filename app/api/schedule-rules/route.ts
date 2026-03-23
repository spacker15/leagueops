import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// GET: list all schedule_rules for an event
export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('schedule_rules')
    .select('*')
    .eq('event_id', Number(eventId))
    .order('priority', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data })
}

// POST: create a new rule
export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { event_id, ...rule } = body

  if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('schedule_rules')
    .insert({ event_id: Number(event_id), ...rule })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

// PUT: update a rule
export async function PUT(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  updates.updated_at = new Date().toISOString()
  const { data, error } = await sb
    .from('schedule_rules')
    .update(updates)
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

// DELETE: remove a rule
export async function DELETE(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('schedule_rules').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
