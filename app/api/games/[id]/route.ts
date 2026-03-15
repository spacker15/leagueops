import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { data, error } = await sb
    .from('games')
    .select(`*, field:fields(*), home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)`)
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sb   = createClient()
  const body = await req.json()
  const { data, error } = await sb
    .from('games')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { error } = await sb.from('games').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
