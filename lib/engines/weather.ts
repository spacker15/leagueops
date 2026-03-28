/**
 * LeagueOps — Weather Engine (Phase 3)
 *
 * Monitors weather per complex using GPS coordinates via OpenWeatherMap.
 * Detects: lightning radius, severe weather, heat index, high winds.
 * Writes alerts, readings, and triggers game delays automatically.
 *
 * API: OpenWeatherMap One Call API 3.0
 *   https://openweathermap.org/api/one-call-3
 *   Free tier: 1,000 calls/day — we cache per 5 minutes per complex
 */

import { createClient } from '@/supabase/client'

const CACHE_MINUTES = 5

// ─── Thresholds ───────────────────────────────────────────────
export const THRESHOLDS = {
  lightning: {
    radius_miles: 8, // trigger delay if lightning within this radius
    delay_minutes: 30, // hold after last strike
    reset_minutes: 30, // restart clock if new strike during delay
  },
  heat: {
    advisory_f: 95, // heat index — issue advisory, water breaks
    warning_f: 103, // mandatory breaks every 20 min
    emergency_f: 113, // suspend play
  },
  wind: {
    advisory_mph: 25, // issue wind advisory
    suspend_mph: 40, // suspend play
  },
  rain: {
    heavy_mm_per_hour: 7.6, // heavy rain (0.3 in/hr)
  },
}

// ─── Types ────────────────────────────────────────────────────
export interface WeatherReading {
  temperature_f: number
  feels_like_f: number
  heat_index_f: number
  humidity_pct: number
  wind_mph: number
  wind_gust_mph: number
  wind_dir_deg: number
  conditions: string
  conditions_code: number
  visibility_mi: number
  pressure_mb: number
  cloud_pct: number
  uv_index: number
  lightning_detected: boolean
  lightning_miles: number | null
  complex_id: number
  complex_name: string
  fetched_at: string
  source: 'live' | 'cache' | 'mock'
}

export interface WeatherAlert {
  type:
    | 'lightning'
    | 'heat_advisory'
    | 'heat_warning'
    | 'heat_emergency'
    | 'high_wind'
    | 'severe_weather'
    | 'heavy_rain'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  auto_action: string | null
}

export interface WeatherEngineResult {
  reading: WeatherReading
  alerts: WeatherAlert[]
  actions_taken: string[]
  games_affected: number
  lightning_active: boolean
  heat_protocol: 'none' | 'advisory' | 'warning' | 'emergency'
}

// ─── Main engine function ─────────────────────────────────────
export async function runWeatherEngine(
  complexId: number,
  apiKey?: string,
  eventId: number = 1
): Promise<WeatherEngineResult> {
  const sb = createClient()

  // Load complex
  const { data: complex } = await sb.from('complexes').select('*').eq('id', complexId).single()

  if (!complex) throw new Error(`Complex ${complexId} not found`)

  // Fetch weather — priority: OpenWeatherMap (if key) → NWS free API (if coords) → mock
  let reading: WeatherReading
  const key = apiKey ?? process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? ''

  if (key && complex.lat && complex.lng) {
    reading = await fetchLiveWeather(complex, key)
  } else if (complex.lat && complex.lng) {
    try {
      reading = await fetchNWSWeather(complex)
    } catch {
      reading = getMockWeather(complex)
    }
  } else {
    reading = getMockWeather(complex)
  }

  // Store the reading
  await sb.from('weather_readings').insert({
    complex_id: complexId,
    event_id: eventId,
    temperature_f: reading.temperature_f,
    feels_like_f: reading.feels_like_f,
    heat_index_f: reading.heat_index_f,
    humidity_pct: reading.humidity_pct,
    wind_mph: reading.wind_mph,
    wind_gust_mph: reading.wind_gust_mph,
    wind_dir_deg: reading.wind_dir_deg,
    conditions: reading.conditions,
    conditions_code: reading.conditions_code,
    visibility_mi: reading.visibility_mi,
    pressure_mb: reading.pressure_mb,
    cloud_pct: reading.cloud_pct,
    uv_index: reading.uv_index,
    lightning_detected: reading.lightning_detected,
    lightning_miles: reading.lightning_miles,
    fetched_at: reading.fetched_at,
  })

  // Update complex cache timestamp
  await sb
    .from('complexes')
    .update({ last_weather_fetch: new Date().toISOString() })
    .eq('id', complexId)

  // Evaluate alerts
  const alerts = evaluateAlerts(reading)
  const actions_taken: string[] = []
  let games_affected = 0
  let lightning_active = false
  let heat_protocol: 'none' | 'advisory' | 'warning' | 'emergency' = 'none'

  // Get fields at this complex
  const { data: fields } = await sb.from('fields').select('id').eq('complex_id', complexId)
  const fieldIds = (fields ?? []).map((f: any) => f.id)

  // Get active games on these fields
  const { data: games } = await sb
    .from('games')
    .select('id, status')
    .in('field_id', fieldIds)
    .eq('event_id', eventId)
    .neq('status', 'Final')

  const activeGameIds = (games ?? []).map((g: any) => g.id)

  // ── Process each alert ──
  for (const alert of alerts) {
    // Write alert to DB
    await sb.from('weather_alerts').insert({
      event_id: eventId,
      complex_id: complexId,
      alert_type: alert.title,
      description: alert.description,
      is_active: true,
      severity: alert.severity,
      temperature_f: reading.temperature_f,
      heat_index_f: reading.heat_index_f,
      humidity_pct: reading.humidity_pct,
      wind_mph: reading.wind_mph,
      conditions: reading.conditions,
      lightning_detected: reading.lightning_detected,
      lightning_miles: reading.lightning_miles,
      source: reading.source,
    })

    // Auto-actions based on alert type
    if (alert.type === 'lightning') {
      lightning_active = true
      games_affected = activeGameIds.length

      // Delay all active games at this complex
      if (activeGameIds.length > 0) {
        await sb
          .from('games')
          .update({ status: 'Delayed' })
          .in('id', activeGameIds)
          .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
        actions_taken.push(`⚡ ${games_affected} games suspended on ${complex.name}`)
      }

      // Create lightning event record
      const delayEnd = new Date(Date.now() + THRESHOLDS.lightning.delay_minutes * 60 * 1000)
      await sb.from('lightning_events').insert({
        complex_id: complexId,
        event_id: eventId,
        closest_miles: reading.lightning_miles,
        delay_started_at: new Date().toISOString(),
        delay_ends_at: delayEnd.toISOString(),
        triggered_by: reading.source,
      })
      actions_taken.push(
        `Lightning delay set — hold until ${delayEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      )
    }

    if (alert.type === 'heat_emergency') {
      heat_protocol = 'emergency'
      actions_taken.push(
        `🌡 Heat emergency — play suspended (${reading.heat_index_f}°F heat index)`
      )
    } else if (alert.type === 'heat_warning' && heat_protocol !== 'emergency') {
      heat_protocol = 'warning'
      actions_taken.push(
        `🌡 Heat warning — mandatory breaks every 20 min (${reading.heat_index_f}°F)`
      )
    } else if (alert.type === 'heat_advisory' && heat_protocol === 'none') {
      heat_protocol = 'advisory'
      actions_taken.push(`🌡 Heat advisory — water breaks required (${reading.heat_index_f}°F)`)
    }

    if (alert.type === 'high_wind' && reading.wind_mph >= THRESHOLDS.wind.suspend_mph) {
      actions_taken.push(`💨 High wind — play suspended (${reading.wind_mph} mph)`)
    }
  }

  // Write to ops log
  if (actions_taken.length > 0) {
    for (const action of actions_taken) {
      await sb.from('ops_log').insert({
        event_id: eventId,
        message: `[${complex.name}] ${action}`,
        log_type: lightning_active ? 'alert' : heat_protocol === 'emergency' ? 'alert' : 'warn',
        occurred_at: new Date().toISOString(),
      })
    }
  } else {
    await sb.from('ops_log').insert({
      event_id: eventId,
      message: `Weather check: ${complex.name} — ${reading.conditions}, ${reading.temperature_f}°F, ${reading.wind_mph} mph`,
      log_type: 'info',
      occurred_at: new Date().toISOString(),
    })
  }

  return { reading, alerts, actions_taken, games_affected, lightning_active, heat_protocol }
}

// ─── Evaluate alerts from a reading ──────────────────────────
export function evaluateAlerts(reading: WeatherReading): WeatherAlert[] {
  const alerts: WeatherAlert[] = []

  // Lightning
  if (
    reading.lightning_detected &&
    (reading.lightning_miles ?? 99) <= THRESHOLDS.lightning.radius_miles
  ) {
    alerts.push({
      type: 'lightning',
      severity: 'critical',
      title: 'Lightning Detected',
      description: `Lightning detected ${reading.lightning_miles} miles away — within ${THRESHOLDS.lightning.radius_miles}-mile safety radius. All fields suspended.`,
      auto_action: 'suspend_all_fields',
    })
  }

  // Thunderstorm condition codes (OWM: 200-232)
  if (reading.conditions_code >= 200 && reading.conditions_code < 300) {
    alerts.push({
      type: 'lightning',
      severity: 'critical',
      title: 'Thunderstorm Warning',
      description: `Thunderstorm conditions detected (${reading.conditions}). All outdoor activities suspended.`,
      auto_action: 'suspend_all_fields',
    })
  }

  // Heat index
  const hi = reading.heat_index_f
  if (hi >= THRESHOLDS.heat.emergency_f) {
    alerts.push({
      type: 'heat_emergency',
      severity: 'critical',
      title: 'Extreme Heat Emergency',
      description: `Heat index ${hi}°F — play suspended. All participants must seek shade and hydration immediately.`,
      auto_action: 'suspend_all_fields',
    })
  } else if (hi >= THRESHOLDS.heat.warning_f) {
    alerts.push({
      type: 'heat_warning',
      severity: 'warning',
      title: 'Heat Warning',
      description: `Heat index ${hi}°F — mandatory 5-min water break every 20 minutes. Coaches must monitor players.`,
      auto_action: 'mandatory_breaks',
    })
  } else if (hi >= THRESHOLDS.heat.advisory_f) {
    alerts.push({
      type: 'heat_advisory',
      severity: 'info',
      title: 'Heat Advisory',
      description: `Heat index ${hi}°F — water breaks required. Extra hydration stations activated.`,
      auto_action: 'water_breaks',
    })
  }

  // High wind
  if (
    reading.wind_mph >= THRESHOLDS.wind.suspend_mph ||
    reading.wind_gust_mph >= THRESHOLDS.wind.suspend_mph + 10
  ) {
    alerts.push({
      type: 'high_wind',
      severity: 'critical',
      title: 'High Wind Warning',
      description: `Wind ${reading.wind_mph} mph, gusts ${reading.wind_gust_mph} mph — dangerous conditions. Play suspended.`,
      auto_action: 'suspend_all_fields',
    })
  } else if (reading.wind_mph >= THRESHOLDS.wind.advisory_mph) {
    alerts.push({
      type: 'high_wind',
      severity: 'warning',
      title: 'Wind Advisory',
      description: `Wind ${reading.wind_mph} mph — monitor conditions. Goalies and flags secured.`,
      auto_action: null,
    })
  }

  // Heavy rain (OWM code 500-531)
  if (reading.conditions_code >= 500 && reading.conditions_code < 600) {
    alerts.push({
      type: 'heavy_rain',
      severity: reading.conditions_code >= 502 ? 'warning' : 'info',
      title: reading.conditions_code >= 502 ? 'Heavy Rain Warning' : 'Rain Advisory',
      description: `${reading.conditions} — field conditions being monitored.`,
      auto_action: null,
    })
  }

  return alerts
}

// ─── Calculate heat index ─────────────────────────────────────
export function calcHeatIndex(tempF: number, humidity: number): number {
  if (tempF < 80) return tempF
  // Rothfusz equation
  const hi =
    -42.379 +
    2.04901523 * tempF +
    10.14333127 * humidity -
    0.22475541 * tempF * humidity -
    0.00683783 * tempF * tempF -
    0.05481717 * humidity * humidity +
    0.00122874 * tempF * tempF * humidity +
    0.00085282 * tempF * humidity * humidity -
    0.00000199 * tempF * tempF * humidity * humidity
  return Math.round(hi * 10) / 10
}

// ─── Live weather fetch from OpenWeatherMap ───────────────────
async function fetchLiveWeather(complex: any, apiKey: string): Promise<WeatherReading> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${complex.lat}&lon=${complex.lng}&appid=${apiKey}&units=imperial`

  const res = await fetch(url, { next: { revalidate: CACHE_MINUTES * 60 } })
  if (!res.ok) throw new Error(`OpenWeatherMap error: ${res.status}`)

  const d = await res.json()
  const tempF = Math.round(d.main.temp * 10) / 10
  const humidity = d.main.humidity
  const heatIdx = calcHeatIndex(tempF, humidity)

  return {
    temperature_f: tempF,
    feels_like_f: Math.round(d.main.feels_like * 10) / 10,
    heat_index_f: heatIdx,
    humidity_pct: humidity,
    wind_mph: Math.round(d.wind.speed * 10) / 10,
    wind_gust_mph: Math.round((d.wind.gust ?? d.wind.speed) * 10) / 10,
    wind_dir_deg: d.wind.deg ?? 0,
    conditions: d.weather[0]?.description ?? 'Unknown',
    conditions_code: d.weather[0]?.id ?? 800,
    visibility_mi: Math.round(((d.visibility ?? 10000) / 1609) * 10) / 10,
    pressure_mb: d.main.pressure,
    cloud_pct: d.clouds?.all ?? 0,
    uv_index: 0, // not in basic weather endpoint
    lightning_detected: (d.weather[0]?.id ?? 0) >= 200 && (d.weather[0]?.id ?? 0) < 300,
    lightning_miles: null,
    complex_id: complex.id,
    complex_name: complex.name,
    fetched_at: new Date().toISOString(),
    source: 'live',
  }
}

// ─── NWS free weather (no API key required, US only) ─────────
async function fetchNWSWeather(complex: any): Promise<WeatherReading> {
  const headers = { 'User-Agent': 'LeagueOps/1.0 (leagueops.app)', Accept: 'application/json' }

  // Step 1: resolve grid point → observation stations URL
  const ptRes = await fetch(`https://api.weather.gov/points/${complex.lat},${complex.lng}`, {
    headers,
  })
  if (!ptRes.ok) throw new Error(`NWS points ${ptRes.status}`)
  const ptData = await ptRes.json()
  const stationsUrl: string = ptData.properties?.observationStations
  if (!stationsUrl) throw new Error('NWS: missing stations URL')

  // Step 2: get nearest station ID
  const stRes = await fetch(`${stationsUrl}?limit=1`, { headers })
  if (!stRes.ok) throw new Error(`NWS stations ${stRes.status}`)
  const stData = await stRes.json()
  const stationId: string = stData.features?.[0]?.properties?.stationIdentifier
  if (!stationId) throw new Error('NWS: no station found')

  // Step 3: latest observation
  const obsRes = await fetch(`https://api.weather.gov/stations/${stationId}/observations/latest`, {
    headers,
  })
  if (!obsRes.ok) throw new Error(`NWS obs ${obsRes.status}`)
  const obs = await obsRes.json()
  const p = obs.properties

  // Unit conversions (NWS returns SI units)
  const cToF = (c: number | null) => (c !== null ? Math.round((c * 9) / 5 + 32) : null)
  const kmhToMph = (k: number | null) => (k !== null ? Math.round(k * 0.621371 * 10) / 10 : 0)

  const tempC: number | null = p.temperature?.value ?? null
  const tempF = cToF(tempC) ?? 70
  const feelsC: number | null = p.windChill?.value ?? p.heatIndex?.value ?? tempC
  const feelsF = cToF(feelsC) ?? tempF
  const humidity = Math.round(p.relativeHumidity?.value ?? 50)
  const windMph = kmhToMph(p.windSpeed?.value ?? 0)
  const gustMph = kmhToMph(p.windGust?.value ?? p.windSpeed?.value ?? 0)
  const pressMb = Math.round((p.barometricPressure?.value ?? 101325) / 100)
  const visM: number = p.visibility?.value ?? 16000
  const visMi = Math.round(visM * 0.000621371 * 10) / 10
  const heatIdx = calcHeatIndex(tempF, humidity)

  const desc: string = p.textDescription ?? 'Unknown'
  const descLower = desc.toLowerCase()
  const hasLightning =
    descLower.includes('thunder') ||
    (p.presentWeather ?? []).some((w: any) => (w.rawString ?? '').startsWith('TS'))

  const condCode = hasLightning
    ? 211
    : descLower.includes('rain') || descLower.includes('shower')
      ? 500
      : descLower.includes('overcast') || descLower.includes('broken')
        ? 804
        : descLower.includes('cloud')
          ? 803
          : descLower.includes('fog') || descLower.includes('mist')
            ? 741
            : 800

  return {
    temperature_f: tempF,
    feels_like_f: feelsF,
    heat_index_f: heatIdx,
    humidity_pct: humidity,
    wind_mph: windMph,
    wind_gust_mph: gustMph,
    wind_dir_deg: p.windDirection?.value ?? 0,
    conditions: desc,
    conditions_code: condCode,
    visibility_mi: visMi,
    pressure_mb: pressMb,
    cloud_pct: 0,
    uv_index: 0,
    lightning_detected: hasLightning,
    lightning_miles: null,
    complex_id: complex.id,
    complex_name: complex.name,
    fetched_at: new Date().toISOString(),
    source: 'live',
  }
}

// ─── Mock weather (when no API key) ──────────────────────────
export function getMockWeather(complex: any): WeatherReading {
  // Slightly randomized realistic Jacksonville June weather
  const baseTemp = 84 + Math.round((Math.random() - 0.5) * 8)
  const humidity = 65 + Math.round(Math.random() * 15)
  const wind = 8 + Math.round(Math.random() * 10)
  const gusts = wind + Math.round(Math.random() * 8)
  const heatIdx = calcHeatIndex(baseTemp, humidity)

  const condOptions = [
    { desc: 'Partly Cloudy', code: 801 },
    { desc: 'Mostly Sunny', code: 800 },
    { desc: 'Scattered Clouds', code: 802 },
    { desc: 'Clear', code: 800 },
  ]
  const cond = condOptions[Math.floor(Math.random() * condOptions.length)]

  return {
    temperature_f: baseTemp,
    feels_like_f: baseTemp + 3,
    heat_index_f: heatIdx,
    humidity_pct: humidity,
    wind_mph: wind,
    wind_gust_mph: gusts,
    wind_dir_deg: 225,
    conditions: cond.desc,
    conditions_code: cond.code,
    visibility_mi: 10,
    pressure_mb: 1015,
    cloud_pct: 30,
    uv_index: 9,
    lightning_detected: false,
    lightning_miles: null,
    complex_id: complex.id,
    complex_name: complex.name,
    fetched_at: new Date().toISOString(),
    source: 'mock',
  }
}

// ─── Get latest reading for a complex ────────────────────────
export async function getLatestReading(complexId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('weather_readings')
    .select('*')
    .eq('complex_id', complexId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

// ─── Get reading history ──────────────────────────────────────
export async function getReadingHistory(complexId: number, hours = 6) {
  const sb = createClient()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const { data } = await sb
    .from('weather_readings')
    .select('*')
    .eq('complex_id', complexId)
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: true })
  return data ?? []
}

// ─── Check if lightning delay is still active ────────────────
export async function checkLightningStatus(complexId: number) {
  const sb = createClient()
  const { data } = await sb
    .from('lightning_events')
    .select('*')
    .eq('complex_id', complexId)
    .is('all_clear_at', null)
    .order('detected_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return { active: false, event: null, secondsLeft: 0 }

  const endsAt = new Date((data as any).delay_ends_at).getTime()
  const now = Date.now()
  const secondsLeft = Math.max(0, Math.round((endsAt - now) / 1000))

  return {
    active: secondsLeft > 0,
    event: data,
    secondsLeft,
  }
}

// ─── Lift lightning delay ─────────────────────────────────────
export async function liftLightningDelay(complexId: number, eventId: number) {
  const sb = createClient()

  // Mark event as cleared
  await sb
    .from('lightning_events')
    .update({ all_clear_at: new Date().toISOString() })
    .eq('complex_id', complexId)
    .is('all_clear_at', null)

  // Resolve active lightning weather alerts
  await sb
    .from('weather_alerts')
    .update({ is_active: false, auto_resolved: true })
    .eq('complex_id', complexId)
    .eq('is_active', true)
    .eq('lightning_detected', true)

  // Restore delayed games to scheduled
  const { data: fields } = await sb.from('fields').select('id').eq('complex_id', complexId)
  const fieldIds = (fields ?? []).map((f: any) => f.id)
  if (fieldIds.length > 0) {
    await sb
      .from('games')
      .update({ status: 'Scheduled' })
      .in('field_id', fieldIds)
      .eq('status', 'Delayed')
      .eq('event_id', eventId)
  }

  await sb.from('ops_log').insert({
    event_id: eventId,
    message: `Lightning delay lifted — All clear issued for complex ${complexId}`,
    log_type: 'ok',
    occurred_at: new Date().toISOString(),
  })
}

// ─── Wind direction label ─────────────────────────────────────
export function windDirection(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  return dirs[Math.round(deg / 22.5) % 16]
}

// ─── Condition icon ───────────────────────────────────────────
export function conditionIcon(code: number): string {
  if (code >= 200 && code < 300) return '⛈'
  if (code >= 300 && code < 400) return '🌦'
  if (code >= 500 && code < 600) return '🌧'
  if (code >= 600 && code < 700) return '❄️'
  if (code >= 700 && code < 800) return '🌫'
  if (code === 800) return '☀️'
  if (code === 801) return '🌤'
  if (code <= 804) return '⛅'
  return '🌡'
}
