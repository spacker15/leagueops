import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { runUnifiedEngine } from '@/lib/engines/unified'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_date_id, event_id } = body

    if (!event_date_id || typeof event_date_id !== 'number') {
      return NextResponse.json(
        { error: 'event_date_id is required and must be a number' },
        { status: 400 }
      )
    }

    if (!event_id || typeof event_id !== 'number') {
      return NextResponse.json(
        { error: 'event_id is required and must be a number' },
        { status: 400 }
      )
    }

    const sb = createClient()
    const result = await runUnifiedEngine(event_date_id, event_id, sb)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
