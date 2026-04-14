import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { generateShiftHandoff } from '@/lib/engines/unified'
import { engineRatelimit } from '@/lib/ratelimit'

export async function POST(request: Request) {
  // Rate limit by IP (SEC-08)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
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

  try {
    const body = await request.json()
    const { created_by, event_id } = body

    if (!created_by || typeof created_by !== 'string') {
      return NextResponse.json(
        { error: 'created_by is required and must be a string' },
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
    const result = await generateShiftHandoff(created_by, event_id, sb)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
