import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  if (!gameId) return NextResponse.json({ error: 'game_id required' }, { status: 400 })

  const { data, error } = await sb
    .from('player_checkins')
    .select('*, player:players(*)')
    .eq('game_id', gameId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()

  const { data, error } = await sb
    .from('player_checkins')
    .upsert({ game_id: body.game_id, player_id: body.player_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  const playerId = searchParams.get('player_id')
  if (!gameId || !playerId)
    return NextResponse.json({ error: 'game_id and player_id required' }, { status: 400 })

  const { error } = await sb
    .from('player_checkins')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', playerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
