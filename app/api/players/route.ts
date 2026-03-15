import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get('team_id')

  if (!teamId) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('players')
    .select('*, team:teams(*)')
    .eq('team_id', teamId)
    .order('number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()

  // Support bulk insert (array) or single insert
  const payload = Array.isArray(body) ? body : [body]

  const { data, error } = await sb
    .from('players')
    .insert(payload)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
