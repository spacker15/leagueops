'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/lib/store'
import { Btn, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { createClient } from '@/supabase/client'
import {
  conditionIcon,
  windDirection,
  evaluateAlerts,
  calcHeatIndex,
  THRESHOLDS,
  type WeatherReading,
  type WeatherAlert,
} from '@/lib/engines/weather'
import {
  Zap,
  Thermometer,
  Wind,
  Droplets,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

type SubTab = 'overview' | 'complexes' | 'history' | 'protocol'

interface LightningStatus {
  active: boolean
  event: any
  secondsLeft: number
}

interface Complex {
  id: number
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  lightning_radius_miles: number
  last_weather_fetch: string | null
}

export function WeatherTab() {
  const { state, triggerLightning, liftLightning } = useApp()
  const { isAdmin } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [complexes, setComplexes] = useState<Complex[]>([])
  const [readings, setReadings] = useState<Record<number, WeatherReading>>({})
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])
  const [lightningStatus, setLightningStatus] = useState<Record<number, LightningStatus>>({})
  const [history, setHistory] = useState<any[]>([])
  const [scanning, setScanning] = useState<number | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiInput, setShowApiInput] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Load complexes
  useEffect(() => {
    if (!state.event?.id) return
    const sb = createClient()
    sb.from('complexes')
      .select('*')
      .eq('event_id', state.event.id)
      .order('id')
      .then(({ data }) => setComplexes((data as Complex[]) ?? []))
  }, [state.event?.id])

  // Load active alerts
  const loadAlerts = useCallback(async () => {
    if (!state.event?.id) return
    const sb = createClient()
    const { data } = await sb
      .from('weather_alerts')
      .select('*')
      .eq('event_id', state.event.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setActiveAlerts(data ?? [])
  }, [state.event?.id])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // Load lightning status for all complexes
  const loadLightningStatus = useCallback(async () => {
    for (const complex of complexes) {
      try {
        const res = await fetch(`/api/lightning?complex_id=${complex.id}`)
        if (res.ok) {
          const status = await res.json()
          setLightningStatus((prev) => ({ ...prev, [complex.id]: status }))
        }
      } catch {}
    }
  }, [complexes])

  useEffect(() => {
    if (complexes.length > 0) loadLightningStatus()
  }, [complexes, loadLightningStatus])

  // Countdown timer for active lightning delays
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setLightningStatus((prev) => {
        const next = { ...prev }
        for (const id in next) {
          if (next[id].active && next[id].secondsLeft > 0) {
            next[id] = { ...next[id], secondsLeft: next[id].secondsLeft - 1 }
            if (next[id].secondsLeft === 0) {
              next[id] = { ...next[id], active: false }
            }
          }
        }
        return next
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Realtime subscription for weather alerts
  useEffect(() => {
    const sb = createClient()
    const sub = sb
      .channel('weather-tab')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weather_alerts' }, () =>
        loadAlerts()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'weather_alerts' }, () =>
        loadAlerts()
      )
      .subscribe()
    return () => {
      sb.removeChannel(sub)
    }
  }, [loadAlerts])

  async function runWeatherScan(complexId: number) {
    setScanning(complexId)
    try {
      const res = await fetch('/api/weather-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complex_id: complexId, api_key: apiKey || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setReadings((prev) => ({ ...prev, [complexId]: data.reading }))
      await loadAlerts()
      await loadLightningStatus()

      if (data.lightning_active) {
        toast(`⚡ LIGHTNING DETECTED — ${data.games_affected} games suspended`, {
          style: { background: '#6b0000', color: 'white' },
          duration: 6000,
        })
      } else if (data.alerts.length > 0) {
        toast.error(
          `${data.alerts.length} weather alert${data.alerts.length > 1 ? 's' : ''} issued`
        )
      } else {
        toast.success(
          `${data.reading.complex_name} — ${data.reading.conditions}, ${data.reading.temperature_f}°F`
        )
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setScanning(null)
    }
  }

  async function scanAll() {
    for (const complex of complexes) {
      await runWeatherScan(complex.id)
    }
  }

  async function manualLightning(complexId: number, action: 'trigger' | 'lift') {
    const res = await fetch('/api/lightning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complex_id: complexId, action, event_id: state.event?.id ?? 1 }),
    })
    if (res.ok) {
      if (action === 'trigger') {
        toast('⚡ LIGHTNING DELAY INITIATED', {
          style: { background: '#6b0000', color: 'white' },
          duration: 5000,
        })
        setLightningStatus((prev) => ({
          ...prev,
          [complexId]: { active: true, event: null, secondsLeft: 1800 },
        }))
      } else {
        toast.success('Lightning delay lifted — fields resuming')
        setLightningStatus((prev) => ({
          ...prev,
          [complexId]: { active: false, event: null, secondsLeft: 0 },
        }))
      }
      await loadAlerts()
      // refresh games in parent state
      await triggerLightning() // just to sync store — won't double-trigger since we did it above
    }
  }

  async function resolveAlert(id: number) {
    const sb = createClient()
    await sb.from('weather_alerts').update({ is_active: false }).eq('id', id)
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id))
    toast.success('Alert resolved')
  }

  async function loadHistory(complexId: number) {
    const res = await fetch(`/api/weather-engine?complex_id=${complexId}&history=6`)
    if (res.ok) {
      const data = await res.json()
      setHistory(data)
    }
  }

  const delayedGames = state.games.filter((g) => g.status === 'Delayed')
  const anyLightning = Object.values(lightningStatus).some((s) => s.active)

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'complexes', label: 'Complexes' },
    { id: 'history', label: 'History' },
    { id: 'protocol', label: 'Protocol Guide' },
  ]

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'font-cond font-bold text-[12px] tracking-widest uppercase px-4 py-2 border-b-2 transition-colors',
              subTab === t.id
                ? 'border-red text-white'
                : 'border-transparent text-muted hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          <Btn variant="ghost" size="sm" onClick={() => setShowApiInput((s) => !s)}>
            API KEY
          </Btn>
          <Btn variant="primary" size="sm" onClick={scanAll} disabled={scanning !== null}>
            <RefreshCw
              size={11}
              className={cn('inline mr-1', scanning !== null && 'animate-spin')}
            />
            SCAN ALL
          </Btn>
        </div>
      </div>

      {/* API Key input (collapsible) */}
      {showApiInput && (
        <div className="bg-surface-card border border-border rounded-md p-3 mb-4 flex gap-3 items-end">
          <div className="flex-1">
            <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-1">
              OPENWEATHERMAP API KEY (optional)
            </div>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank to use mock weather data"
              className="w-full bg-surface border border-border text-white px-3 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 font-mono"
            />
          </div>
          <div className="text-[10px] text-muted font-cond pb-1.5">
            Get free key at
            <br />
            openweathermap.org
          </div>
        </div>
      )}

      {/* ═══ OVERVIEW ════════════════════════════════════════════ */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Left col — complexes weather */}
          <div className="col-span-2 space-y-3">
            {complexes.length === 0 && (
              <div className="text-center py-12 text-muted font-cond font-bold">
                No complexes found — run Phase 1 migration first
              </div>
            )}
            {complexes.map((complex) => {
              const reading = readings[complex.id]
              const ls = lightningStatus[complex.id]
              return (
                <ComplexWeatherCard
                  key={complex.id}
                  complex={complex}
                  reading={reading}
                  lightningStatus={ls}
                  scanning={scanning === complex.id}
                  onScan={() => runWeatherScan(complex.id)}
                  onLightning={(action) => manualLightning(complex.id, action)}
                  canControl={isAdmin}
                />
              )
            })}

            {/* Delayed games */}
            {delayedGames.length > 0 && (
              <div>
                <SectionHeader>DELAYED FIELDS ({delayedGames.length} GAMES)</SectionHeader>
                <div className="grid grid-cols-2 gap-2">
                  {delayedGames.map((game) => (
                    <div
                      key={game.id}
                      className="bg-red-900/15 border border-l-4 border-red-500 border-red-900/40 rounded-md p-3"
                    >
                      <div className="font-cond font-black text-[13px] text-red-400">
                        {game.field?.name ?? `Field ${game.field_id}`} — DELAYED
                      </div>
                      <div className="text-[12px] text-white mt-0.5">
                        {game.home_team?.name ?? '?'} vs {game.away_team?.name ?? '?'}
                      </div>
                      <div className="font-cond text-[10px] text-muted mt-0.5">
                        {game.scheduled_time} · {game.division}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right col — active alerts */}
          <div>
            <SectionHeader>ACTIVE ALERTS ({activeAlerts.length})</SectionHeader>
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <CheckCircle size={32} className="text-green-400" />
                <div className="font-cond font-bold text-[12px] text-green-400 tracking-wide">
                  ALL CLEAR
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onResolve={() => resolveAlert(alert.id)}
                  />
                ))}
              </div>
            )}

            {/* Heat index guide */}
            <div className="mt-4">
              <SectionHeader>HEAT INDEX GUIDE</SectionHeader>
              <div className="space-y-1">
                {[
                  {
                    range: '< 95°F',
                    label: 'Normal play',
                    color: 'text-green-400',
                    bg: 'bg-green-900/15',
                  },
                  {
                    range: '95–103°F',
                    label: 'Advisory — water breaks',
                    color: 'text-yellow-400',
                    bg: 'bg-yellow-900/15',
                  },
                  {
                    range: '103–113°F',
                    label: 'Warning — breaks req.',
                    color: 'text-orange-400',
                    bg: 'bg-orange-900/15',
                  },
                  {
                    range: '> 113°F',
                    label: 'Emergency — suspend',
                    color: 'text-red-400',
                    bg: 'bg-red-900/15',
                  },
                ].map((item) => (
                  <div
                    key={item.range}
                    className={cn(
                      'flex justify-between px-2.5 py-1.5 rounded text-[11px]',
                      item.bg
                    )}
                  >
                    <span className={cn('font-mono font-bold', item.color)}>{item.range}</span>
                    <span className="text-muted font-cond font-bold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wind guide */}
            <div className="mt-4">
              <SectionHeader>WIND GUIDE</SectionHeader>
              <div className="space-y-1">
                {[
                  {
                    range: '< 25 mph',
                    label: 'Normal play',
                    color: 'text-green-400',
                    bg: 'bg-green-900/15',
                  },
                  {
                    range: '25–40 mph',
                    label: 'Advisory — monitor',
                    color: 'text-yellow-400',
                    bg: 'bg-yellow-900/15',
                  },
                  {
                    range: '> 40 mph',
                    label: 'Suspend play',
                    color: 'text-red-400',
                    bg: 'bg-red-900/15',
                  },
                ].map((item) => (
                  <div
                    key={item.range}
                    className={cn(
                      'flex justify-between px-2.5 py-1.5 rounded text-[11px]',
                      item.bg
                    )}
                  >
                    <span className={cn('font-mono font-bold', item.color)}>{item.range}</span>
                    <span className="text-muted font-cond font-bold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ COMPLEXES ═══════════════════════════════════════════ */}
      {subTab === 'complexes' && (
        <div className="space-y-4">
          {complexes.map((complex) => {
            const reading = readings[complex.id]
            const ls = lightningStatus[complex.id]
            const complexFields = state.fields.filter((f) => (f as any).complex_id === complex.id)
            return (
              <div key={complex.id} className="bg-surface-card border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-cond font-black text-[16px] text-white">
                      {complex.name}
                    </div>
                    <div className="font-cond text-[11px] text-muted mt-0.5">
                      {complex.address ?? 'No address set'}
                    </div>
                    <div className="font-cond text-[10px] text-muted mt-0.5">
                      GPS: {complex.lat ?? '—'}, {complex.lng ?? '—'} · Lightning radius:{' '}
                      {complex.lightning_radius_miles} mi
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        loadHistory(complex.id)
                        setSubTab('history')
                      }}
                    >
                      HISTORY
                    </Btn>
                    <Btn
                      size="sm"
                      variant="primary"
                      onClick={() => runWeatherScan(complex.id)}
                      disabled={scanning === complex.id}
                    >
                      <RefreshCw
                        size={10}
                        className={cn('inline mr-1', scanning === complex.id && 'animate-spin')}
                      />
                      SCAN
                    </Btn>
                  </div>
                </div>

                {/* Fields at this complex */}
                <div className="mb-4">
                  <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-2">
                    FIELDS ({complexFields.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {complexFields.map((f) => {
                      const fieldGames = state.games.filter((g) => g.field_id === f.id)
                      const liveGame = fieldGames.find(
                        (g) => g.status === 'Live' || g.status === 'Halftime'
                      )
                      const delayed = fieldGames.some((g) => g.status === 'Delayed')
                      return (
                        <div
                          key={f.id}
                          className={cn(
                            'font-cond text-[11px] font-bold px-2.5 py-1 rounded border',
                            delayed
                              ? 'bg-red-900/20 border-red-700/50 text-red-300'
                              : liveGame
                                ? 'bg-green-900/20 border-green-700/50 text-green-300'
                                : 'bg-navy/40 border-border text-muted'
                          )}
                        >
                          {f.name}
                          {delayed && ' ⚡'}
                          {liveGame && !delayed && ' ●'}
                        </div>
                      )
                    })}
                    {complexFields.length === 0 && (
                      <span className="text-[10px] text-muted font-cond italic">
                        No fields assigned to this complex
                      </span>
                    )}
                  </div>
                </div>

                {/* Latest reading */}
                {reading ? (
                  <WeatherReadingGrid reading={reading} />
                ) : (
                  <div className="text-[11px] text-muted font-cond text-center py-4 border border-dashed border-border rounded-md">
                    No weather data — click SCAN to fetch
                    {!complex.lat && ' (no GPS coordinates set)'}
                  </div>
                )}

                {/* Lightning status (always visible) + controls (admin only) */}
                <LightningPanel
                  complex={complex}
                  lightningStatus={ls}
                  onTrigger={() => manualLightning(complex.id, 'trigger')}
                  onLift={() => manualLightning(complex.id, 'lift')}
                  canControl={isAdmin}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ HISTORY ═════════════════════════════════════════════ */}
      {subTab === 'history' && (
        <div>
          <div className="flex gap-2 mb-4">
            {complexes.map((c) => (
              <Btn key={c.id} size="sm" variant="ghost" onClick={() => loadHistory(c.id)}>
                {c.name.split(' ')[0]}
              </Btn>
            ))}
          </div>
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted font-cond">
              Select a complex to load history
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-navy">
                    {[
                      'TIME',
                      'TEMP',
                      'FEELS',
                      'HEAT IDX',
                      'HUMIDITY',
                      'WIND',
                      'GUSTS',
                      'CONDITIONS',
                      'LIGHTNING',
                    ].map((h) => (
                      <th
                        key={h}
                        className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice()
                    .reverse()
                    .map((r: any) => (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-b border-border/40 hover:bg-white/5',
                          r.lightning_detected && 'bg-red-900/10',
                          r.heat_index_f >= 103 && 'bg-orange-900/10'
                        )}
                      >
                        <td className="font-mono text-blue-300 px-3 py-2 whitespace-nowrap">
                          {new Date(r.fetched_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="font-mono px-3 py-2">{r.temperature_f}°F</td>
                        <td className="font-mono text-muted px-3 py-2">{r.feels_like_f}°F</td>
                        <td
                          className={cn(
                            'font-mono font-bold px-3 py-2',
                            r.heat_index_f >= 113
                              ? 'text-red-400'
                              : r.heat_index_f >= 103
                                ? 'text-orange-400'
                                : r.heat_index_f >= 95
                                  ? 'text-yellow-400'
                                  : 'text-green-400'
                          )}
                        >
                          {r.heat_index_f}°F
                        </td>
                        <td className="font-mono px-3 py-2 text-muted">{r.humidity_pct}%</td>
                        <td className="font-mono px-3 py-2">{r.wind_mph} mph</td>
                        <td className="font-mono px-3 py-2 text-muted">{r.wind_gust_mph} mph</td>
                        <td className="font-cond px-3 py-2 text-muted capitalize">
                          {r.conditions}
                        </td>
                        <td className="px-3 py-2">
                          {r.lightning_detected ? (
                            <span className="font-cond text-[10px] font-bold text-red-400">
                              ⚡ YES
                            </span>
                          ) : (
                            <span className="text-muted text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ PROTOCOL GUIDE ══════════════════════════════════════ */}
      {subTab === 'protocol' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <ProtocolSection
              title="⚡ LIGHTNING PROTOCOL"
              color="red"
              steps={[
                'When lightning is detected within 8 miles OR thunder is heard: ALL FIELDS SUSPENDED IMMEDIATELY',
                'Announce "Lightning Delay" over PA system and radio to all field marshals',
                'All players, coaches, and spectators move to designated shelter areas',
                'Click TRIGGER LIGHTNING DELAY in the Weather tab — system delays all games automatically',
                '30-minute hold timer begins from last observed lightning',
                'If new lightning observed during hold: RESET the 30-minute timer',
                'When 30 minutes clear with no lightning: issue ALL CLEAR, resume games',
                'Field marshals confirm all-clear before players return to fields',
              ]}
            />
            <ProtocolSection
              title="💨 HIGH WIND PROTOCOL"
              color="yellow"
              steps={[
                '25–40 mph: Issue wind advisory, monitor conditions, secure flags and goals',
                'Above 40 mph: SUSPEND PLAY — winds are dangerous for players and equipment',
                'Check for downed branches or debris on fields before resuming',
                'Goalie pads and equipment secured in shelter areas',
              ]}
            />
          </div>
          <div>
            <ProtocolSection
              title="🌡 HEAT PROTOCOL"
              color="orange"
              steps={[
                'Heat Index 95–103°F (Advisory): Mandatory water break every 30 minutes. Extra hydration stations active.',
                'Heat Index 103–113°F (Warning): Mandatory 5-minute water break every 20 minutes. Coaches monitor players for heat illness.',
                'Heat Index > 113°F (Emergency): SUSPEND PLAY. All players seek shade and hydration. Contact medical immediately.',
                'Signs of heat illness: heavy sweating, weakness, fast pulse, nausea, confusion → call trainer immediately',
                'ATC (athletic trainer) to be notified at Advisory level',
              ]}
            />
            <ProtocolSection
              title="🌧 HEAVY RAIN / SEVERE WEATHER"
              color="blue"
              steps={[
                'Heavy rain alone does not suspend play — field conditions are the determining factor',
                'Field marshal assesses field: standing water, mud depth, footing safety',
                'If field is unplayable: suspend that specific field, others may continue',
                'Tornado warning or severe thunderstorm warning: ALL FIELDS SUSPENDED, move to shelters',
                'Monitor National Weather Service alerts for the county',
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Complex weather card (overview) ─────────────────────────
function ComplexWeatherCard({
  complex,
  reading,
  lightningStatus: ls,
  scanning,
  onScan,
  onLightning,
  canControl = false,
}: {
  complex: Complex
  reading?: WeatherReading
  lightningStatus?: LightningStatus
  scanning: boolean
  onScan: () => void
  onLightning: (action: 'trigger' | 'lift') => void
  canControl?: boolean
}) {
  return (
    <div
      className={cn(
        'bg-surface-card border rounded-lg overflow-hidden',
        ls?.active ? 'border-red-500/60' : 'border-border'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-2.5 flex justify-between items-center border-b border-border',
          ls?.active ? 'bg-red-900/20' : 'bg-navy/60'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-cond font-black text-[14px] text-white">{complex.name}</span>
          {ls?.active && (
            <span className="font-cond text-[10px] font-black tracking-widest text-red-400 border border-red-500/40 rounded px-2 py-0.5 lightning-flash">
              ⚡ LIGHTNING DELAY
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {complex.last_weather_fetch && (
            <span className="font-cond text-[9px] text-muted">
              Updated{' '}
              {new Date(complex.last_weather_fetch).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          {canControl && (
            <Btn
              size="sm"
              variant={ls?.active ? 'danger' : 'ghost'}
              onClick={() => onLightning(ls?.active ? 'lift' : 'trigger')}
            >
              <Zap size={10} className="inline mr-1" />
              {ls?.active ? 'LIFT DELAY' : 'LIGHTNING'}
            </Btn>
          )}
          <Btn size="sm" variant="primary" onClick={onScan} disabled={scanning}>
            <RefreshCw size={10} className={cn('inline mr-1', scanning && 'animate-spin')} />
            {scanning ? 'SCANNING...' : 'SCAN'}
          </Btn>
        </div>
      </div>

      {/* Lightning timer */}
      {ls?.active && (
        <div className="bg-red-900/20 px-4 py-2 flex items-center justify-between border-b border-red-900/40">
          <div className="font-cond text-[11px] font-bold text-red-300">30-MINUTE HOLD TIMER</div>
          <div className="font-mono text-2xl font-bold text-red-400">
            {Math.floor((ls.secondsLeft ?? 0) / 60)}:
            {((ls.secondsLeft ?? 0) % 60).toString().padStart(2, '0')}
          </div>
          <div className="font-cond text-[10px] text-muted">
            All fields suspended until all clear
          </div>
        </div>
      )}

      {/* Weather data */}
      {reading ? (
        <div className="p-4">
          <WeatherReadingGrid reading={reading} compact />
        </div>
      ) : (
        <div className="p-4 text-[11px] text-muted font-cond text-center">
          Click SCAN to fetch weather data
          {!complex.lat ? ' (add GPS coordinates for live data)' : ''}
        </div>
      )}
    </div>
  )
}

// ─── Weather reading grid ─────────────────────────────────────
function WeatherReadingGrid({
  reading,
  compact = false,
}: {
  reading: WeatherReading
  compact?: boolean
}) {
  const heatColor =
    reading.heat_index_f >= 113
      ? 'text-red-400'
      : reading.heat_index_f >= 103
        ? 'text-orange-400'
        : reading.heat_index_f >= 95
          ? 'text-yellow-400'
          : 'text-green-400'

  const windColor =
    reading.wind_mph >= 40
      ? 'text-red-400'
      : reading.wind_mph >= 25
        ? 'text-yellow-400'
        : 'text-green-400'

  const stats = [
    {
      icon: <Thermometer size={14} />,
      label: 'TEMP',
      value: `${reading.temperature_f}°F`,
      color: 'text-white',
    },
    {
      icon: <Thermometer size={14} />,
      label: 'HEAT IDX',
      value: `${reading.heat_index_f}°F`,
      color: heatColor,
    },
    {
      icon: <Droplets size={14} />,
      label: 'HUMIDITY',
      value: `${reading.humidity_pct}%`,
      color: 'text-blue-300',
    },
    {
      icon: <Wind size={14} />,
      label: 'WIND',
      value: `${reading.wind_mph} mph ${windDirection(reading.wind_dir_deg)}`,
      color: windColor,
    },
    {
      icon: <Wind size={14} />,
      label: 'GUSTS',
      value: `${reading.wind_gust_mph} mph`,
      color: windColor,
    },
    {
      icon: <Eye size={14} />,
      label: 'VISIBILITY',
      value: `${reading.visibility_mi} mi`,
      color: 'text-muted',
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{conditionIcon(reading.conditions_code)}</span>
        <div>
          <div className="font-cond font-black text-[15px] capitalize">{reading.conditions}</div>
          <div className="font-cond text-[10px] text-muted">
            {reading.source === 'live'
              ? '🟢 LIVE DATA'
              : reading.source === 'cache'
                ? '🟡 CACHED'
                : '🔵 SIMULATED'}
            {' · '}UV {reading.uv_index} · {reading.cloud_pct}% cloud cover
          </div>
        </div>
      </div>
      <div className={cn('grid gap-2', compact ? 'grid-cols-6' : 'grid-cols-3')}>
        {stats.map((s) => (
          <div key={s.label} className="bg-black/20 rounded p-2">
            <div className="flex items-center gap-1 mb-0.5 text-muted">
              {s.icon}
              <span className="font-cond text-[9px] font-bold tracking-wider">{s.label}</span>
            </div>
            <div className={cn('font-mono text-[13px] font-bold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Lightning panel ──────────────────────────────────────────
function LightningPanel({
  complex,
  lightningStatus: ls,
  onTrigger,
  onLift,
  canControl = false,
}: {
  complex: Complex
  lightningStatus?: LightningStatus
  onTrigger: () => void
  onLift: () => void
  canControl?: boolean
}) {
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
        LIGHTNING PROTOCOL — {complex.lightning_radius_miles}-MILE RADIUS
      </div>
      <div
        className={cn(
          'rounded-md px-4 py-2 text-center mb-3 font-cond font-black text-[12px] tracking-widest border transition-all',
          ls?.active
            ? 'bg-red-900/20 text-red-400 border-red-500/40 lightning-flash'
            : 'bg-green-900/15 text-green-400 border-green-500/30'
        )}
      >
        {ls?.active
          ? '⚡ LIGHTNING DELAY ACTIVE — ALL FIELDS SUSPENDED'
          : 'FIELD STATUS: ALL CLEAR'}
      </div>
      {canControl ? (
        <button
          onClick={ls?.active ? onLift : onTrigger}
          className={cn(
            'w-full font-cond font-black text-[13px] tracking-widest py-2.5 rounded-md uppercase transition-colors',
            ls?.active
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red hover:bg-red-dark text-white'
          )}
        >
          {ls?.active ? '✓ LIFT LIGHTNING DELAY' : '⚡ TRIGGER LIGHTNING DELAY'}
        </button>
      ) : (
        <div className="text-center font-cond text-[10px] text-muted tracking-widest">
          ADMIN ONLY — CONTACT YOUR EVENT ADMINISTRATOR TO TRIGGER/LIFT DELAYS
        </div>
      )}
    </div>
  )
}

// ─── Alert card ───────────────────────────────────────────────
function AlertCard({ alert, onResolve }: { alert: any; onResolve: () => void }) {
  const isLightning = alert.lightning_detected || alert.alert_type?.includes('Lightning')
  const isHeat = alert.alert_type?.includes('Heat')
  const isCritical = alert.severity === 'critical'

  return (
    <div
      className={cn(
        'border-l-4 border rounded-md p-3',
        isCritical
          ? 'border-l-red-500 bg-red-900/10 border-red-900/40'
          : alert.severity === 'warning'
            ? 'border-l-yellow-500 bg-yellow-900/10 border-yellow-900/30'
            : 'border-l-blue-400 bg-blue-900/10 border-blue-900/30'
      )}
    >
      <div className="flex justify-between items-start mb-1">
        <span
          className={cn(
            'font-cond font-black text-[11px] tracking-widest',
            isCritical
              ? 'text-red-400'
              : alert.severity === 'warning'
                ? 'text-yellow-400'
                : 'text-blue-300'
          )}
        >
          {isLightning ? '⚡ ' : isHeat ? '🌡 ' : '⚠ '}
          {alert.alert_type?.toUpperCase()}
        </span>
        <span className="font-mono text-[9px] text-muted">
          {new Date(alert.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="text-[11px] text-gray-200 mb-2 leading-snug">{alert.description}</div>
      {alert.temperature_f && (
        <div className="flex gap-3 text-[10px] text-muted font-cond mb-2">
          {alert.temperature_f && <span>🌡 {alert.temperature_f}°F</span>}
          {alert.humidity_pct && <span>💧 {alert.humidity_pct}%</span>}
          {alert.wind_mph && <span>💨 {alert.wind_mph} mph</span>}
        </div>
      )}
      <button
        onClick={onResolve}
        className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-800/60 transition-colors"
      >
        RESOLVE
      </button>
    </div>
  )
}

// ─── Protocol section ─────────────────────────────────────────
function ProtocolSection({
  title,
  color,
  steps,
}: {
  title: string
  color: string
  steps: string[]
}) {
  const [open, setOpen] = useState(true)
  const borderColor =
    {
      red: 'border-red-500',
      yellow: 'border-yellow-500',
      orange: 'border-orange-400',
      blue: 'border-blue-400',
    }[color] ?? 'border-border'
  return (
    <div
      className={cn(
        'border-l-4 bg-surface-card border border-border rounded-md mb-4 overflow-hidden',
        borderColor
      )}
    >
      <button
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-white/5 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-cond font-black text-[13px] tracking-wide text-white">{title}</span>
        {open ? (
          <ChevronUp size={14} className="text-muted" />
        ) : (
          <ChevronDown size={14} className="text-muted" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[12px]">
                <span className="font-cond font-black text-muted shrink-0 w-5 text-right">
                  {i + 1}.
                </span>
                <span className="text-gray-200 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
