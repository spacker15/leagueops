import { NextRequest, NextResponse } from 'next/server'
import { generateSchedule, detectConflicts } from '@/lib/engines/schedule'
import { createClient } from '@/supabase/server'

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { event_id } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await generateSchedule(Number(event_id), sb)

    if (result.games.length === 0) {
      return NextResponse.json({ error: 'No games generated' }, { status: 400 })
    }

    const { data: inserted, error: insertErr } = await sb
      .from('games')
      .insert(result.games)
      .select('id')

    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 })
    }

    await sb.from('ops_log').insert({
      event_id: Number(event_id),
      message: `Schedule generated: ${result.games.length} games across ${result.divisionCount} divisions, ${result.fieldCount} fields, ${result.dateCount} dates`,
      log_type: 'ok',
      occurred_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      gamesCreated: inserted?.length ?? result.games.length,
      totalMatchups: result.totalMatchups,
      teamCount: result.teamCount,
      fieldCount: result.fieldCount,
      dateCount: result.dateCount,
      divisionCount: result.divisionCount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await detectConflicts(Number(eventId), sb)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
