import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { resolveAlert } from '@/lib/engines/unified'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { alert_id, resolved_by, note } = body

    if (!alert_id || typeof alert_id !== 'number') {
      return NextResponse.json(
        { error: 'alert_id is required and must be a number' },
        { status: 400 }
      )
    }

    if (!resolved_by || typeof resolved_by !== 'string') {
      return NextResponse.json(
        { error: 'resolved_by is required and must be a string' },
        { status: 400 }
      )
    }

    const sb = createClient()
    await resolveAlert(alert_id, resolved_by, note ?? undefined, sb)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
