import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
// import { runUnifiedEngine } from '@/lib/engines/unified'  // wire after Plan A Task 6

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_date_id } = body

    if (!event_date_id || typeof event_date_id !== 'number') {
      return NextResponse.json(
        { error: 'event_date_id is required and must be a number' },
        { status: 400 }
      )
    }

    const sb = createClient()
    // const result = await runUnifiedEngine(event_date_id, sb)
    // return NextResponse.json(result)

    // TODO: remove this placeholder once Plan A Task 6 is complete
    return NextResponse.json({ message: 'unified-engine route created, pending Plan A wire-up' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
