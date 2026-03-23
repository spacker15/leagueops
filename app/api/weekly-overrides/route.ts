import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// GET: list all weekly_overrides for an event
export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('weekly_overrides')
    .select('*')
    .eq('event_id', Number(eventId))
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data })
}

// POST: create a new override
export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { event_id, ...override } = body

  if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('weekly_overrides')
    .insert({ event_id: Number(event_id), ...override })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}

// PUT: update an override
export async function PUT(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  updates.updated_at = new Date().toISOString()
  const { data, error } = await sb
    .from('weekly_overrides')
    .update(updates)
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}

// DELETE: remove an override
export async function DELETE(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('weekly_overrides').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
