import { NextRequest, NextResponse } from 'next/server'
import { liftLightningDelay, checkLightningStatus } from '@/lib/engines/weather'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const complexId = searchParams.get('complex_id')
  if (!complexId) return NextResponse.json({ error: 'complex_id required' }, { status: 400 })

  try {
    const status = await checkLightningStatus(Number(complexId), supabase)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse raw JSON body (SEC-07)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Business logic — lightning uses a discriminated action pattern; validated inline
  const parsed = body as Record<string, unknown>
  const { complex_id, action, event_id } = parsed

  if (!complex_id) return NextResponse.json({ error: 'complex_id required' }, { status: 400 })
  if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  try {
    if (action === 'lift') {
      await liftLightningDelay(Number(complex_id), Number(event_id), supabase)
      return NextResponse.json({ lifted: true })
    }

    // action === 'trigger' — manual lightning trigger
    const delayEnd = new Date(Date.now() + 30 * 60 * 1000)

    // Get fields at complex
    const { data: fields } = await supabase.from('fields').select('id').eq('complex_id', complex_id)
    const fieldIds = (fields ?? []).map((f: { id: number }) => f.id)

    // Delay all games
    if (fieldIds.length > 0) {
      await supabase
        .from('games')
        .update({ status: 'Delayed' })
        .in('field_id', fieldIds)
        .eq('event_id', event_id)
        .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
    }

    // Create lightning event
    await supabase.from('lightning_events').insert({
      complex_id: complex_id,
      event_id: event_id,
      delay_started_at: new Date().toISOString(),
      delay_ends_at: delayEnd.toISOString(),
      triggered_by: 'manual',
    })

    // Create weather alert
    await supabase.from('weather_alerts').insert({
      event_id: event_id,
      complex_id: complex_id,
      alert_type: 'Lightning Delay',
      description: 'Manual lightning delay triggered — all fields suspended for 30 minutes',
      is_active: true,
      severity: 'critical',
      lightning_detected: true,
      source: 'manual',
    })

    await supabase.from('ops_log').insert({
      event_id: event_id,
      message: `LIGHTNING DELAY TRIGGERED (manual) — all fields suspended until ${delayEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      log_type: 'alert',
      occurred_at: new Date().toISOString(),
    })

    return NextResponse.json({ triggered: true, delay_ends_at: delayEnd.toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
