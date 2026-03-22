import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id') ?? '1'
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const { data, error } = await sb
    .from('ops_log')
    .select('*')
    .eq('event_id', eventId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()

  const { data, error } = await sb
    .from('ops_log')
    .insert({ ...body, occurred_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
