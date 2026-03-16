import { NextRequest, NextResponse } from 'next/server'
import { runFieldConflictEngine, runFullConflictScan, applyResolution } from '@/lib/engines/field'
import { createClient } from '@/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, event_date_id, conflict_id, resolution_action, resolution_params } = body

  if (!event_date_id && action !== 'resolve') {
    return NextResponse.json({ error: 'event_date_id required' }, { status: 400 })
  }

  try {
    if (action === 'resolve') {
      if (!conflict_id || !resolution_action) {
        return NextResponse.json({ error: 'conflict_id and resolution_action required' }, { status: 400 })
      }
      const result = await applyResolution(Number(conflict_id), resolution_action, resolution_params ?? {})
      return NextResponse.json(result)
    }

    if (action === 'full') {
      const result = await runFullConflictScan(Number(event_date_id))
      return NextResponse.json(result)
    }

    // Default: field engine only
    const result = await runFieldConflictEngine(Number(event_date_id))
    return NextResponse.json(result)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const eventId     = searchParams.get('event_id') ?? '1'
  const type        = searchParams.get('type') ?? 'open' // 'open' | 'all' | 'history'

  if (type === 'history') {
    const { data, error } = await sb
      .from('conflict_engine_runs')
      .select('*')
      .eq('event_id', eventId)
      .order('ran_at', { ascending: false })
      .limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Field-related open conflicts
  const { data, error } = await sb
    .from('operational_conflicts')
    .select('*')
    .eq('event_id', eventId)
    .eq('resolved', type === 'all' ? false : false)
    .in('conflict_type', ['field_overlap', 'field_blocked', 'schedule_cascade', 'missing_referee'])
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
