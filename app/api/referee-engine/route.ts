import { NextRequest, NextResponse } from 'next/server'
import { runRefereeEngine, findAvailableRefs } from '@/lib/engines/referee'
import { createClient } from '@/supabase/server'
import { engineRatelimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  // Rate limit by IP (SEC-08)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success, limit, remaining, reset, pending } = await engineRatelimit.limit(ip)
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
  const { event_date_id, event_id } = body

  if (!event_date_id) {
    return NextResponse.json({ error: 'event_date_id required' }, { status: 400 })
  }

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await runRefereeEngine(Number(event_date_id), Number(event_id), sb)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventDateId = searchParams.get('event_date_id')
  const eventId = searchParams.get('event_id')
  const gameTime = searchParams.get('game_time')
  const division = searchParams.get('division')
  const excludeRaw = searchParams.get('exclude_refs')

  if (!eventDateId || !gameTime || !division) {
    return NextResponse.json(
      { error: 'event_date_id, game_time, division required' },
      { status: 400 }
    )
  }

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  const excludeIds = excludeRaw ? excludeRaw.split(',').map(Number) : []

  try {
    const available = await findAvailableRefs(
      Number(eventDateId),
      gameTime,
      division,
      excludeIds,
      Number(eventId),
      sb
    )
    return NextResponse.json(available)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
