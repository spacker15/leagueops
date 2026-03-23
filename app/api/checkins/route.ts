import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { publicRatelimit } from '@/lib/ratelimit'

// PUBLIC ROUTE — intentionally excluded from auth guard per SEC-02.
// Token-gated by QR code scan flow for player check-in.

export async function GET(req: NextRequest) {
  // Rate limit by IP (SEC-08)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  const { success, limit, remaining, reset, pending } =
    await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

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
  // Rate limit by IP (SEC-08)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  const { success, limit, remaining, reset, pending } =
    await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

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
  // Rate limit by IP (SEC-08)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  const { success, limit, remaining, reset, pending } =
    await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

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
