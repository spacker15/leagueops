import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  if (!gameId) return NextResponse.json({ error: 'game_id required' }, { status: 400 })
  const { data, error } = await sb
    .from('ref_assignments')
    .select('*, referee:referees(*)')
    .eq('game_id', gameId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { data, error } = await sb
    .from('ref_assignments')
    .upsert(body)
    .select('*, referee:referees(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  const refereeId = searchParams.get('referee_id')
  if (!gameId || !refereeId)
    return NextResponse.json({ error: 'game_id and referee_id required' }, { status: 400 })
  const { error } = await sb
    .from('ref_assignments')
    .delete()
    .eq('game_id', gameId)
    .eq('referee_id', refereeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
