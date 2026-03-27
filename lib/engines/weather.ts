/**
 * LeagueOps — Weather Engine (Phase 3)
 *
 * Monitors weather per complex using GPS coordinates.
 * Detects: lightning radius, severe weather, heat index, high winds.
 * Writes alerts, readings, and triggers game delays automatically.
 *
 * Data sources:
 *   1. NWS (api.weather.gov) — free, no key — official severe weather alerts + observations
 *   2. OpenWeatherMap (optional) — current conditions if API key provided
 *   3. Mock data — fallback for dev/testing
 */

import type { SupabaseClient } from '@supabase/supabase-js'

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
    | 'nws_alert'
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
  apiKey: string | undefined,
  eventId: number,
  sb: SupabaseClient
): Promise<WeatherEngineResult> {
  // Load complex
  const { data: complex } = await sb.from('complexes').select('*').eq('id', complexId).single()

  if (!complex) throw new Error(`Complex ${complexId} not found`)

  // Fetch weather — try NWS first (free), then OWM, then mock
  let reading: WeatherReading
  const key = apiKey ?? process.env.OPENWEATHER_API_KEY ?? ''

  if (complex.lat && complex.lng) {
    if (key) {
      reading = await fetchLiveWeather(complex, key)
    } else {
      // Try NWS observations (free, no key)
      reading = await fetchNWSObservation(complex)
    }
  } else {
    reading = getMockWeather(complex)
  }

  // Fetch NWS official alerts (free, always available when we have coordinates)
  let nwsAlerts: WeatherAlert[] = []
  if (complex.lat && complex.lng) {
    nwsAlerts = await fetchNWSAlerts(complex.lat, complex.lng)
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

  // Evaluate alerts from reading + merge NWS official alerts
  const alerts = [...evaluateAlerts(reading), ...nwsAlerts]
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

    if (alert.type === 'nws_alert') {
      actions_taken.push(`🏛 NWS: ${alert.title}`)
      // Critical NWS alerts (tornado, severe thunderstorm) suspend play
      if (alert.auto_action === 'suspend_all_fields' && activeGameIds.length > 0) {
        lightning_active = true
        games_affected = activeGameIds.length
        await sb
          .from('games')
          .update({ status: 'Delayed' })
          .in('id', activeGameIds)
          .in('status', ['Scheduled', 'Starting', 'Live', 'Halftime'])
      }
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

// ─── NWS Active Alerts (api.weather.gov) — free, no key ──────
async function fetchNWSAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat},${lng}&status=actual&message_type=alert`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeagueOps/1.0 (tournament-ops-platform)' },
      next: { revalidate: CACHE_MINUTES * 60 },
    })
    if (!res.ok) return []

    const data = await res.json()
    const features = data.features ?? []
    const alerts: WeatherAlert[] = []

    for (const f of features) {
      const props = f.properties
      if (!props) continue

      // Map NWS severity → our severity
      const nwsSeverity = (props.severity ?? '').toLowerCase()
      const nwsCertainty = (props.certainty ?? '').toLowerCase()
      const eventName = (props.event ?? '').toLowerCase()

      let severity: 'info' | 'warning' | 'critical' = 'info'
      let autoAction: string | null = null

      // Critical: tornado, severe thunderstorm, extreme wind
      if (
        nwsSeverity === 'extreme' ||
        eventName.includes('tornado') ||
        eventName.includes('severe thunderstorm warning')
      ) {
        severity = 'critical'
        autoAction = 'suspend_all_fields'
      } else if (
        nwsSeverity === 'severe' ||
        eventName.includes('warning') ||
        eventName.includes('thunderstorm')
      ) {
        severity = 'warning'
      } else if (nwsCertainty === 'observed' || nwsCertainty === 'likely') {
        severity = 'warning'
      }

      // Truncate description to something reasonable
      const desc = props.description
        ? props.description.slice(0, 300) + (props.description.length > 300 ? '...' : '')
        : (props.headline ?? props.event)

      alerts.push({
        type: 'nws_alert',
        severity,
        title: `NWS: ${props.event ?? 'Weather Alert'}`,
        description: props.headline ?? desc,
        auto_action: autoAction,
      })
    }

    return alerts
  } catch {
    // NWS API failure should not block weather scan
    return []
  }
}

// ─── NWS Observation (free fallback when no OWM key) ─────────
async function fetchNWSObservation(complex: any): Promise<WeatherReading> {
  try {
    // Step 1: Get nearest station from NWS points endpoint
    const pointUrl = `https://api.weather.gov/points/${complex.lat},${complex.lng}`
    const pointRes = await fetch(pointUrl, {
      headers: { 'User-Agent': 'LeagueOps/1.0 (tournament-ops-platform)' },
      next: { revalidate: 3600 }, // cache station lookup for 1 hour
    })
    if (!pointRes.ok) return getMockWeather(complex)

    const pointData = await pointRes.json()
    const stationUrl = pointData.properties?.observationStations
    if (!stationUrl) return getMockWeather(complex)

    // Step 2: Get the nearest station
    const stationsRes = await fetch(stationUrl, {
      headers: { 'User-Agent': 'LeagueOps/1.0 (tournament-ops-platform)' },
      next: { revalidate: 3600 },
    })
    if (!stationsRes.ok) return getMockWeather(complex)

    const stationsData = await stationsRes.json()
    const stationId = stationsData.features?.[0]?.properties?.stationIdentifier
    if (!stationId) return getMockWeather(complex)

    // Step 3: Get latest observation
    const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`
    const obsRes = await fetch(obsUrl, {
      headers: { 'User-Agent': 'LeagueOps/1.0 (tournament-ops-platform)' },
      next: { revalidate: CACHE_MINUTES * 60 },
    })
    if (!obsRes.ok) return getMockWeather(complex)

    const obsData = await obsRes.json()
    const p = obsData.properties
    if (!p) return getMockWeather(complex)

    // Convert Celsius → Fahrenheit, m/s → mph, m → miles, Pa → mb
    const tempC = p.temperature?.value
    const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : 80
    const humidity = Math.round(p.relativeHumidity?.value ?? 50)
    const windMs = p.windSpeed?.value ?? 0
    const windMph = Math.round(windMs * 2.237 * 10) / 10
    const gustMs = p.windGust?.value ?? windMs
    const gustMph = Math.round(gustMs * 2.237 * 10) / 10
    const windDeg = p.windDirection?.value ?? 0
    const visM = p.visibility?.value ?? 16000
    const visMi = Math.round((visM / 1609) * 10) / 10
    const pressurePa = p.barometricPressure?.value ?? 101500
    const pressureMb = Math.round(pressurePa / 100)
    const heatIdx = calcHeatIndex(tempF, humidity)
    const desc = p.textDescription ?? 'Unknown'

    // Map NWS text conditions to approximate OWM code for evaluateAlerts
    const lowerDesc = desc.toLowerCase()
    let condCode = 800 // clear
    if (lowerDesc.includes('thunder')) condCode = 211
    else if (lowerDesc.includes('heavy rain') || lowerDesc.includes('downpour')) condCode = 502
    else if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle')) condCode = 500
    else if (lowerDesc.includes('overcast')) condCode = 804
    else if (lowerDesc.includes('cloud') || lowerDesc.includes('mostly cloudy')) condCode = 803
    else if (lowerDesc.includes('partly')) condCode = 802
    else if (lowerDesc.includes('fog') || lowerDesc.includes('mist')) condCode = 741

    return {
      temperature_f: tempF,
      feels_like_f: tempF, // NWS doesn't provide feels_like directly
      heat_index_f: heatIdx,
      humidity_pct: humidity,
      wind_mph: windMph,
      wind_gust_mph: gustMph,
      wind_dir_deg: windDeg,
      conditions: desc,
      conditions_code: condCode,
      visibility_mi: visMi,
      pressure_mb: pressureMb,
      cloud_pct: lowerDesc.includes('overcast') ? 100 : lowerDesc.includes('cloud') ? 60 : 20,
      uv_index: 0,
      lightning_detected: condCode >= 200 && condCode < 300,
      lightning_miles: null,
      complex_id: complex.id,
      complex_name: complex.name,
      fetched_at: new Date().toISOString(),
      source: 'live',
    }
  } catch {
    return getMockWeather(complex)
  }
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
export async function getLatestReading(complexId: number, sb: SupabaseClient) {
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
export async function getReadingHistory(complexId: number, hours = 6, sb: SupabaseClient) {
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
export async function checkLightningStatus(complexId: number, sb: SupabaseClient) {
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
export async function liftLightningDelay(complexId: number, eventId: number, sb: SupabaseClient) {
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
