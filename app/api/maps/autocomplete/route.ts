import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=establishment&key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ error: data.error_message || data.status }, { status: 502 })
  }

  const predictions = (data.predictions ?? []).map((p: any) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text ?? '',
    secondary_text: p.structured_formatting?.secondary_text ?? '',
  }))

  return NextResponse.json({ predictions })
}
