'use client'

/**
 * WeatherBar — sits between TopBar and StatusRow.
 *
 * Two layers:
 *  1. Conditions strip  — one pill per complex showing temp / heat index / wind / conditions
 *  2. Alert ticker      — scrolling marquee of active NWS/weather alerts (only when alerts exist)
 */

import { useEffect, useState, useRef } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import type { WeatherReading } from '@/lib/engines/weather'

interface DBAlert {
  id: number
  alert_type: string
  description: string
  severity: string
  nws_event_type: string | null
  created_at: string
}

interface Complex {
  id: number
  name: string
}

// ── severity colours ──────────────────────────────────────────
const SEV_BG: Record<string, string> = {
  critical: 'bg-red-900/80 border-red-500/60 text-red-100',
  warning: 'bg-amber-900/70 border-amber-500/50 text-amber-100',
  info: 'bg-blue-900/60 border-blue-500/40 text-blue-100',
}

const SEV_TICKER: Record<string, string> = {
  critical: 'text-red-300',
  warning: 'text-amber-300',
  info: 'text-blue-300',
}

function heatColor(hi: number) {
  if (hi >= 113) return 'text-red-400'
  if (hi >= 103) return 'text-orange-400'
  if (hi >= 95) return 'text-yellow-300'
  return 'text-green-400'
}

export function WeatherBar() {
  const { state } = useApp()
  const readings = state.weatherReadings as Record<number, WeatherReading>
  const [complexes, setComplexes] = useState<Complex[]>([])
  const [alerts, setAlerts] = useState<DBAlert[]>([])
  const tickerRef = useRef<HTMLDivElement>(null)

  const eventId = state.event?.id

  // Load complexes
  useEffect(() => {
    if (!eventId) return
    const sb = createClient()
    sb.from('complexes')
      .select('id, name')
      .eq('event_id', eventId)
      .order('id')
      .then(({ data }) => setComplexes(data ?? []))
  }, [eventId])

  // Load active alerts + subscribe for real-time updates
  useEffect(() => {
    if (!eventId) return
    const sb = createClient()

    function load() {
      sb.from('weather_alerts')
        .select('id, alert_type, description, severity, nws_event_type, created_at')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => setAlerts((data as DBAlert[]) ?? []))
    }

    load()

    const sub = sb
      .channel(`wb-alerts-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weather_alerts' }, load)
      .subscribe()

    return () => {
      sb.removeChannel(sub)
    }
  }, [eventId])

  // Readings keyed by complex id
  const hasReadings = Object.keys(readings).length > 0
  const hasAlerts = alerts.length > 0

  // Don't render at all if no complexes and no data
  if (complexes.length === 0 && !hasReadings && !hasAlerts) return null

  // Build complex list from either loaded complexes or reading complex names
  const displayComplexes: { id: number; name: string }[] =
    complexes.length > 0
      ? complexes
      : Object.entries(readings).map(([id, r]) => ({ id: Number(id), name: r.complex_name }))

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid #1a2d50' }}>
      {/* ── Conditions strip ─────────────────────────────────── */}
      {hasReadings && (
        <div
          className="flex items-center gap-0 overflow-x-auto scrollbar-none"
          style={{ height: 30, background: '#020c1e' }}
        >
          {displayComplexes.map((cx, i) => {
            const r = readings[cx.id]
            if (!r) return null
            const hi = r.heat_index_f
            return (
              <div
                key={cx.id}
                className="flex items-center gap-3 px-4 h-full flex-shrink-0"
                style={{ borderRight: '1px solid #1a2d50' }}
              >
                {/* Complex name */}
                <span className="font-cond text-[9px] font-black tracking-widest text-muted uppercase">
                  {cx.name.length > 20 ? cx.name.slice(0, 18) + '…' : cx.name}
                </span>

                {/* Temp */}
                <span className="font-mono text-[11px] font-bold text-white">
                  {r.temperature_f}°F
                </span>

                {/* Heat index — only show when different from temp */}
                {Math.abs(hi - r.temperature_f) >= 2 && (
                  <span className={cn('font-mono text-[11px] font-bold', heatColor(hi))}>
                    HI {hi}°F
                  </span>
                )}

                {/* Wind */}
                <span className="font-mono text-[10px] text-muted">
                  {r.wind_mph}
                  {r.wind_gust_mph > r.wind_mph + 2 ? `–${r.wind_gust_mph}` : ''} mph
                </span>

                {/* Conditions */}
                <span className="text-[10px] text-[#7a8fa8] capitalize">{r.conditions}</span>

                {/* Lightning dot */}
                {r.lightning_detected && <span className="text-yellow-400 text-[11px]">⚡</span>}
              </div>
            )
          })}

          {/* Spacer + "last updated" hint */}
          <div className="flex-1" />
          {hasReadings && (
            <span className="font-cond text-[8px] text-muted/50 px-3 flex-shrink-0 tracking-wider">
              NWS · AUTO
            </span>
          )}
        </div>
      )}

      {/* ── Alert ticker ──────────────────────────────────────── */}
      {hasAlerts && (
        <div
          className="flex items-center overflow-hidden"
          style={{ height: 24, background: '#03091a', borderTop: '1px solid #1a2d50' }}
        >
          {/* Static label */}
          <div
            className="flex items-center gap-1.5 px-3 h-full flex-shrink-0 font-cond text-[9px] font-black tracking-widest"
            style={{
              background: alerts.some((a) => a.severity === 'critical') ? '#6b0000' : '#3a2200',
              borderRight: '1px solid #1a2d50',
              color: alerts.some((a) => a.severity === 'critical') ? '#ff6060' : '#fbbf24',
            }}
          >
            {alerts.some((a) => a.severity === 'critical') ? '⚡ ALERT' : '⚠ ADVISORY'}
          </div>

          {/* Scrolling ticker */}
          <div className="flex-1 overflow-hidden relative">
            <div
              ref={tickerRef}
              className="flex items-center gap-8 whitespace-nowrap ticker-scroll"
              style={{ animation: `ticker ${Math.max(20, alerts.length * 12)}s linear infinite` }}
            >
              {/* Duplicate for seamless loop */}
              {[...alerts, ...alerts].map((a, i) => (
                <span key={i} className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      'font-cond text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border',
                      SEV_BG[a.severity] ?? SEV_BG.info
                    )}
                  >
                    {a.nws_event_type ?? a.alert_type.replace('NWS: ', '')}
                  </span>
                  <span className={cn('text-[10px]', SEV_TICKER[a.severity] ?? SEV_TICKER.info)}>
                    {a.description.split('\n')[0].slice(0, 120)}
                  </span>
                  <span className="text-muted/40 text-[10px]">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
