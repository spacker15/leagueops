import { NextRequest, NextResponse } from 'next/server'
import { runWeatherEngine, getLatestReading, getReadingHistory } from '@/lib/engines/weather'
import { createClient } from '@/supabase/server'

export async function POST(req: NextRequest) {
  const sb = createClient()
  const body = await req.json()
  const { complex_id, api_key } = body

  if (!complex_id) {
    return NextResponse.json({ error: 'complex_id required' }, { status: 400 })
  }

  try {
    const result = await runWeatherEngine(
      Number(complex_id),
      api_key ?? process.env.OPENWEATHER_API_KEY,
      sb
    )
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
