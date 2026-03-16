import { NextRequest, NextResponse } from 'next/server'
import { runRefereeEngine, findAvailableRefs } from '@/lib/engines/referee'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { event_date_id } = body

  if (!event_date_id) {
    return NextResponse.json({ error: 'event_date_id required' }, { status: 400 })
  }

  try {
    const result = await runRefereeEngine(Number(event_date_id))
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventDateId = searchParams.get('event_date_id')
  const gameTime    = searchParams.get('game_time')
  const division    = searchParams.get('division')
  const excludeRaw  = searchParams.get('exclude_refs')

  if (!eventDateId || !gameTime || !division) {
    return NextResponse.json({ error: 'event_date_id, game_time, division required' }, { status: 400 })
  }

  const excludeIds = excludeRaw ? excludeRaw.split(',').map(Number) : []

  try {
    const available = await findAvailableRefs(Number(eventDateId), gameTime, division, excludeIds)
    return NextResponse.json(available)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
