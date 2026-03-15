'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const MOCK_CONDITIONS = [
  { temp: '82°F', humid: '64%', wind: '8 mph',  cond: 'Partly Cloudy' },
  { temp: '84°F', humid: '67%', wind: '12 mph', cond: 'Mostly Sunny' },
  { temp: '86°F', humid: '71%', wind: '6 mph',  cond: 'Clear' },
  { temp: '88°F', humid: '73%', wind: '15 mph', cond: 'Overcast' },
]

export function WeatherTab() {
  const { state, triggerLightning, liftLightning } = useApp()
  const [condIdx, setCondIdx] = useState(1)

  const cond = MOCK_CONDITIONS[condIdx]
  const lightning = state.lightningActive
  const m = Math.floor(state.lightningSecondsLeft / 60)
  const s = state.lightningSecondsLeft % 60

  const delayedGames = state.games.filter(g => g.status === 'Delayed')
  const activeAlerts = state.weatherAlerts.filter(a => a.is_active)

  async function handleLightning() {
    if (lightning) {
      await liftLightning()
      toast.success('Lightning delay lifted — fields resuming')
    } else {
      await triggerLightning()
      toast('⚡ LIGHTNING DELAY INITIATED', { icon: '⚡', style: { background: '#6b0000' } })
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* LEFT */}
      <div>
        {/* Current conditions */}
        <SectionHeader>CURRENT CONDITIONS</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <WeatherStat label="TEMPERATURE" value={cond.temp} />
            <WeatherStat label="HUMIDITY"    value={cond.humid} />
            <WeatherStat label="WIND"        value={cond.wind} />
            <WeatherStat label="CONDITIONS"  value={cond.cond} />
          </div>
          <Btn variant="ghost" size="sm" className="w-full"
            onClick={() => setCondIdx((condIdx + 1) % MOCK_CONDITIONS.length)}>
            REFRESH CONDITIONS
          </Btn>
          <div className="text-[10px] text-muted font-cond text-center mt-2 tracking-wide">
            RIVERSIDE SPORTS COMPLEX · JACKSONVILLE FL
          </div>
        </div>

        {/* Lightning protocol */}
        <SectionHeader>LIGHTNING PROTOCOL</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4">
          {/* Status box */}
          <div className={cn(
            'rounded-md px-4 py-3 text-center mb-4 font-cond font-black text-[13px] tracking-widest border',
            lightning
              ? 'bg-red-900/20 text-red-400 border-red-500/40 lightning-flash'
              : 'bg-green-900/15 text-green-400 border-green-500/30'
          )}>
            {lightning ? '⚡ LIGHTNING DELAY ACTIVE' : 'FIELD STATUS: ALL CLEAR'}
          </div>

          {/* Timer */}
          {lightning && (
            <div className="mb-4 text-center">
              <div className="font-cond text-[10px] font-bold tracking-widest text-muted mb-1">30-MIN HOLD TIMER</div>
              <div className="font-mono text-4xl font-bold text-red-400">
                {m}:{s.toString().padStart(2, '0')}
              </div>
            </div>
          )}

          <button
            onClick={handleLightning}
            className={cn(
              'w-full font-cond font-black text-[14px] tracking-widest py-3 rounded-md uppercase border-none transition-colors',
              lightning
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red hover:bg-red-dark text-white'
            )}
          >
            {lightning ? '✓ LIFT LIGHTNING DELAY' : '⚡ TRIGGER LIGHTNING DELAY'}
          </button>
          <div className="text-[10px] text-muted text-center mt-2 font-cond">
            All active fields set to DELAYED · 30-minute hold protocol
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div>
        {/* Active alerts */}
        <SectionHeader>ACTIVE WEATHER ALERTS ({activeAlerts.length})</SectionHeader>
        {activeAlerts.length === 0
          ? <div className="text-[11px] text-muted font-cond mb-4 py-4 text-center">NO ACTIVE ALERTS</div>
          : activeAlerts.map(a => (
            <div key={a.id} className="bg-yellow-900/10 border border-yellow-900/40 border-l-4 border-l-yellow-500 rounded-md p-3 mb-2">
              <div className="font-cond font-black text-[12px] text-yellow-400 tracking-wide">{a.alert_type.toUpperCase()}</div>
              <div className="text-[11px] text-gray-300 mt-1">{a.description}</div>
              <div className="text-[10px] text-muted mt-1">
                {new Date(a.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
              </div>
            </div>
          ))
        }

        {/* Delayed fields */}
        <SectionHeader>DELAYED FIELDS ({delayedGames.length})</SectionHeader>
        {delayedGames.length === 0
          ? <div className="text-[11px] text-muted font-cond py-4 text-center">NO FIELDS CURRENTLY DELAYED</div>
          : delayedGames.map(g => (
            <div key={g.id} className="bg-red-900/10 border border-red-900/40 border-l-4 border-l-red-500 rounded-md p-3 mb-2">
              <div className="font-cond font-black text-[13px] text-red-400">
                {g.field?.name ?? `Field ${g.field_id}`} — DELAYED
              </div>
              <div className="text-[11px] text-white mt-0.5">
                {g.home_team?.name ?? '?'} vs {g.away_team?.name ?? '?'}
              </div>
              <div className="text-[10px] text-muted">{g.scheduled_time} · {g.division}</div>
            </div>
          ))
        }

        {/* All weather log */}
        <SectionHeader>WEATHER HISTORY</SectionHeader>
        {state.weatherAlerts.slice(0, 8).map(a => (
          <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-border/30 text-[11px]">
            <span className={cn('font-cond font-bold', a.is_active ? 'text-yellow-400' : 'text-muted')}>
              {a.alert_type}
            </span>
            <span className="font-mono text-muted text-[10px]">
              {new Date(a.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
            </span>
            {!a.is_active && <span className="text-[10px] text-green-400 font-cond font-bold">RESOLVED</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-medium text-white">{value}</div>
      <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mt-0.5">{label}</div>
    </div>
  )
}
