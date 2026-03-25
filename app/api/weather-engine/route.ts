import { NextRequest, NextResponse } from 'next/server'
import { runWeatherEngine, getLatestReading, getReadingHistory } from '@/lib/engines/weather'
import { createClient } from '@/supabase/server'
import { engineRatelimit } from '@/lib/ratelimit'
import { insertNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  // Rate limit by IP (SEC-08)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  const { success, limit, remaining, reset, pending } =
    await engineRatelimit.limit(ip)
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
  const { complex_id, event_id, api_key } = body

  if (!complex_id) {
    return NextResponse.json({ error: 'complex_id required' }, { status: 400 })
  }

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const result = await runWeatherEngine(
      Number(complex_id),
      api_key ?? process.env.OPENWEATHER_API_KEY,
      Number(event_id),
      sb
    )

    // NOT-02: Wire weather alert notifications (per D-15, D-16, D-17)
    if (result.alerts && Array.isArray(result.alerts)) {
      for (const alert of result.alerts) {
        try {
          // D-16: Lightning and severe_weather are event-wide; other alert types are conceptually
          // field-scoped but WeatherAlert has no field_id (alerts are per-complex), so we use
          // 'event' scope for all. When field-level weather data is available in the future,
          // non-lightning alerts should use scope 'field' with the relevant field_id.
          const isEventWide = alert.type === 'lightning' || alert.type === 'severe_weather'
          void isEventWide // documented for future field-scope upgrade
          const scope: 'event' | 'field' = 'event'
          const scopeId: number | null = null

          await insertNotification(Number(event_id), 'weather_alert', scope, scopeId, {
            title: `Weather Alert: ${alert.title}`,
            summary: alert.description,
            detail: `Complex ${complex_id} — ${alert.type}: ${alert.description}`,
            cta_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}?tab=weather`,
          })
        } catch (notifErr) {
          // Non-fatal: notification failure must not break weather engine response
          console.error('Failed to insert weather notification:', notifErr)
        }
      }
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sb = createClient()
  const { searchParams } = new URL(req.url)
  const complexId = searchParams.get('complex_id')
  const history = searchParams.get('history')

  if (!complexId) {
    return NextResponse.json({ error: 'complex_id required' }, { status: 400 })
  }

  try {
    if (history) {
      const hours = parseInt(history)
      const data = await getReadingHistory(Number(complexId), hours, sb)
      return NextResponse.json(data)
    }
    const reading = await getLatestReading(Number(complexId), sb)
    return NextResponse.json(reading)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
