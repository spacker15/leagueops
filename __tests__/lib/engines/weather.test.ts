import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import {
  calcHeatIndex,
  evaluateAlerts,
  windDirection,
  conditionIcon,
  runWeatherEngine,
  getMockWeather,
  THRESHOLDS,
} from '@/lib/engines/weather'
import type { WeatherReading } from '@/lib/engines/weather'

// ─── Pure function helpers ───────────────────────────────────────────────────

function makeReading(overrides: Partial<WeatherReading> = {}): WeatherReading {
  return {
    temperature_f: 75,
    feels_like_f: 75,
    heat_index_f: 75,
    humidity_pct: 50,
    wind_mph: 10,
    wind_gust_mph: 15,
    wind_dir_deg: 180,
    conditions: 'Clear',
    conditions_code: 800,
    visibility_mi: 10,
    pressure_mb: 1013,
    cloud_pct: 0,
    uv_index: 5,
    lightning_detected: false,
    lightning_miles: null,
    complex_id: 1,
    complex_name: 'Test Complex',
    fetched_at: new Date().toISOString(),
    source: 'mock',
    ...overrides,
  }
}

// ─── calcHeatIndex ────────────────────────────────────────────────────────────

describe('calcHeatIndex', () => {
  it('returns temp directly when below 80°F', () => {
    expect(calcHeatIndex(70, 30)).toBe(70)
    expect(calcHeatIndex(79, 80)).toBe(79)
  })

  it('returns elevated heat index at high temperature and humidity', () => {
    const hi = calcHeatIndex(100, 50)
    // Rothfusz equation at 100°F / 50% should give ~118
    expect(hi).toBeGreaterThan(110)
    expect(hi).toBeLessThan(130)
  })

  it('calcHeatIndex at 90°F / 60% humidity returns value above 90°F', () => {
    const hi = calcHeatIndex(90, 60)
    expect(hi).toBeGreaterThan(90)
  })
})

// ─── evaluateAlerts ───────────────────────────────────────────────────────────

describe('evaluateAlerts', () => {
  it('returns no alerts for normal conditions', () => {
    const reading = makeReading()
    const alerts = evaluateAlerts(reading)
    expect(alerts).toHaveLength(0)
  })

  it('triggers heat_emergency alert when heat_index_f >= 113', () => {
    const reading = makeReading({ heat_index_f: THRESHOLDS.heat.emergency_f })
    const alerts = evaluateAlerts(reading)
    const heatAlert = alerts.find((a) => a.type === 'heat_emergency')
    expect(heatAlert).toBeDefined()
    expect(heatAlert?.severity).toBe('critical')
  })

  it('triggers heat_warning alert when heat_index_f >= 103 and < 113', () => {
    const reading = makeReading({ heat_index_f: THRESHOLDS.heat.warning_f })
    const alerts = evaluateAlerts(reading)
    const heatWarning = alerts.find((a) => a.type === 'heat_warning')
    expect(heatWarning).toBeDefined()
    expect(heatWarning?.severity).toBe('warning')
  })

  it('triggers heat_advisory alert when heat_index_f >= 95 and < 103', () => {
    const reading = makeReading({ heat_index_f: THRESHOLDS.heat.advisory_f })
    const alerts = evaluateAlerts(reading)
    const heatAdvisory = alerts.find((a) => a.type === 'heat_advisory')
    expect(heatAdvisory).toBeDefined()
    expect(heatAdvisory?.severity).toBe('info')
  })

  it('triggers high_wind suspension alert when wind_mph >= 40', () => {
    const reading = makeReading({ wind_mph: THRESHOLDS.wind.suspend_mph, wind_gust_mph: 50 })
    const alerts = evaluateAlerts(reading)
    const windAlert = alerts.find((a) => a.type === 'high_wind')
    expect(windAlert).toBeDefined()
    expect(windAlert?.severity).toBe('critical')
  })

  it('triggers wind advisory when wind_mph >= 25 and < 40', () => {
    const reading = makeReading({ wind_mph: THRESHOLDS.wind.advisory_mph, wind_gust_mph: 30 })
    const alerts = evaluateAlerts(reading)
    const windAdvisory = alerts.find((a) => a.type === 'high_wind')
    expect(windAdvisory).toBeDefined()
    expect(windAdvisory?.severity).toBe('warning')
  })

  it('triggers lightning alert when conditions_code is 210 (thunderstorm)', () => {
    const reading = makeReading({ conditions_code: 210, conditions: 'Thunderstorm' })
    const alerts = evaluateAlerts(reading)
    const lightningAlert = alerts.find((a) => a.type === 'lightning')
    expect(lightningAlert).toBeDefined()
    expect(lightningAlert?.severity).toBe('critical')
  })

  it('triggers lightning alert when lightning_detected within radius', () => {
    const reading = makeReading({
      lightning_detected: true,
      lightning_miles: THRESHOLDS.lightning.radius_miles - 1,
    })
    const alerts = evaluateAlerts(reading)
    const lightningAlert = alerts.find((a) => a.type === 'lightning')
    expect(lightningAlert).toBeDefined()
  })

  it('does not trigger lightning when lightning is outside radius', () => {
    const reading = makeReading({
      lightning_detected: true,
      lightning_miles: THRESHOLDS.lightning.radius_miles + 5,
    })
    // Only check that no lightning-detected alert (not thunderstorm code)
    const alerts = evaluateAlerts(reading)
    const lightningByDetection = alerts.filter(
      (a) => a.type === 'lightning' && a.title === 'Lightning Detected'
    )
    expect(lightningByDetection).toHaveLength(0)
  })
})

// ─── windDirection ────────────────────────────────────────────────────────────

describe('windDirection', () => {
  it('returns N for 0 degrees', () => {
    expect(windDirection(0)).toBe('N')
  })

  it('returns S for 180 degrees', () => {
    expect(windDirection(180)).toBe('S')
  })

  it('returns E for 90 degrees', () => {
    expect(windDirection(90)).toBe('E')
  })

  it('returns W for 270 degrees', () => {
    expect(windDirection(270)).toBe('W')
  })

  it('returns NE for 45 degrees', () => {
    expect(windDirection(45)).toBe('NE')
  })
})

// ─── conditionIcon ────────────────────────────────────────────────────────────

describe('conditionIcon', () => {
  it('returns thunderstorm icon for codes 200-299', () => {
    expect(conditionIcon(210)).toBe('⛈')
  })

  it('returns sun icon for code 800 (clear)', () => {
    expect(conditionIcon(800)).toBe('☀️')
  })

  it('returns rain icon for codes 500-599', () => {
    expect(conditionIcon(500)).toBe('🌧')
  })
})

// ─── runWeatherEngine ─────────────────────────────────────────────────────────

describe('runWeatherEngine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
  })

  it('throws when complex is not found', async () => {
    ;(mockSb.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeChain({ data: null, error: null })
    )

    await expect(runWeatherEngine(999, undefined, 1, mockSb)).rejects.toThrow('Complex 999 not found')
  })

  it('runWeatherEngine uses mock weather when no API key and resolves', async () => {
    const mockComplex = { id: 1, name: 'Main Complex', lat: null, lng: null }

    ;(mockSb.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeChain({ data: mockComplex, error: null })) // complexes .single()
      .mockReturnValue(makeChain({ data: null, error: null })) // all DB writes

    // apiKey is undefined, complex has no lat/lng → uses mock weather
    const result = await runWeatherEngine(1, undefined, 1, mockSb)
    expect(result).toHaveProperty('reading')
    expect(result).toHaveProperty('alerts')
    expect(result.reading.source).toBe('mock')
  })

  it('getMockWeather returns a valid WeatherReading shape', () => {
    const complex = { id: 1, name: 'Test' }
    const reading = getMockWeather(complex)
    expect(reading).toHaveProperty('temperature_f')
    expect(reading).toHaveProperty('heat_index_f')
    expect(reading).toHaveProperty('wind_mph')
    expect(reading.source).toBe('mock')
    expect(reading.complex_id).toBe(1)
  })
})
