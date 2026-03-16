import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId  = searchParams.get('event_id') ?? '1'
  const resolved = searchParams.get('resolved') ?? 'false'

  const { data, error } = await sb
    .from('operational_conflicts')
    .select('*')
    .eq('event_id', eventId)
    .eq('resolved', resolved === 'true')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const sb   = createClient()
  const body = await req.json()
  const { id, resolved_by } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await sb
    .from('operational_conflicts')
    .update({
      resolved:    true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolved_by ?? 'operator',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
