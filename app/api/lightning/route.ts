import { NextRequest, NextResponse } from 'next/server'
import { liftLightningDelay, checkLightningStatus } from '@/lib/engines/weather'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const complexId = searchParams.get('complex_id')
  if (!complexId) return NextResponse.json({ error: 'complex_id required' }, { status: 400 })

  try {
    const status = await checkLightningStatus(Number(complexId), sb)
    return NextResponse.json(status)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { complex_id, action, event_id } = body

  if (!complex_id) return NextResponse.json({ error: 'complex_id required' }, { status: 400 })

  try {
    if (action === 'lift') {
      await liftLightningDelay(Number(complex_id), Number(event_id ?? 1), sb)
      return NextResponse.json({ lifted: true })
    }

    // action === 'trigger' — manual lightning trigger
    const delayEnd = new Date(Date.now() + 30 * 60 * 1000)

    // Get fields at complex
    const { data: fields } = await sb.from('fields').select('id').eq('complex_id', complex_id)
    const fieldIds = (fields ?? []).map((f: any) => f.id)

    // Delay all games
    if (fieldIds.length > 0) {
      await sb
        .from('games')
        .update({ status: 'Delayed' })
        .in('field_id', fieldIds)
        .eq('event_id', event_id ?? 1)
        .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
    }

    // Create lightning event
    await sb.from('lightning_events').insert({
      complex_id: complex_id,
      event_id: event_id ?? 1,
      delay_started_at: new Date().toISOString(),
      delay_ends_at: delayEnd.toISOString(),
      triggered_by: 'manual',
    })

    // Create weather alert
    await sb.from('weather_alerts').insert({
      event_id: event_id ?? 1,
      complex_id: complex_id,
      alert_type: 'Lightning Delay',
      description: 'Manual lightning delay triggered — all fields suspended for 30 minutes',
      is_active: true,
      severity: 'critical',
      lightning_detected: true,
      source: 'manual',
    })

    await sb.from('ops_log').insert({
      event_id: event_id ?? 1,
      message: `⚡ LIGHTNING DELAY TRIGGERED (manual) — all fields suspended until ${delayEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      log_type: 'alert',
      occurred_at: new Date().toISOString(),
    })

    return NextResponse.json({ triggered: true, delay_ends_at: delayEnd.toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
