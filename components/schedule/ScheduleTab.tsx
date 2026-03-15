'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/store'
import { StatusBadge, Modal, Btn, FormField, Input, Select } from '@/components/ui'
import { cn, nextStatusLabel, nextGameStatus } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { GameStatus } from '@/types'

export function ScheduleTab() {
  const { state, updateGameStatus, addGame, currentDate } = useApp()
  const [fieldFilter, setFieldFilter]   = useState('')
  const [divFilter, setDivFilter]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen]           = useState(false)

  // Add game form state
  const [agField, setAgField]  = useState('')
  const [agHome, setAgHome]    = useState('')
  const [agAway, setAgAway]    = useState('')
  const [agDiv, setAgDiv]      = useState('U14')
  const [agTime, setAgTime]    = useState('08:00')

  const filtered = useMemo(() => {
    let g = [...state.games].sort((a, b) => {
      const ta = a.scheduled_time, tb = b.scheduled_time
      return ta.localeCompare(tb) || a.field_id - b.field_id
    })
    if (fieldFilter) g = g.filter(x => String(x.field_id) === fieldFilter)
    if (divFilter)   g = g.filter(x => x.division.startsWith(divFilter))
    if (statusFilter)g = g.filter(x => x.status === statusFilter)
    return g
  }, [state.games, fieldFilter, divFilter, statusFilter])

  async function cycleStatus(gameId: number, current: GameStatus) {
    const next = nextGameStatus(current)
    if (!next) return
    await updateGameStatus(gameId, next)
    toast.success(`Game #${gameId} → ${next}`)
  }

  async function handleAddGame() {
    if (!agField || !agHome || !agAway || agHome === agAway) {
      toast.error('Fill all fields. Home ≠ Away.')
      return
    }
    if (!currentDate) { toast.error('No event date selected.'); return }
    const [h, m] = agTime.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
    const timeStr = `${dh}:${m.toString().padStart(2,'0')} ${ampm}`

    await addGame({
      event_id: 1,
      event_date_id: currentDate.id,
      field_id: Number(agField),
      home_team_id: Number(agHome),
      away_team_id: Number(agAway),
      division: agDiv,
      scheduled_time: timeStr,
      status: 'Scheduled',
      home_score: 0,
      away_score: 0,
      notes: null,
    })
    toast.success('Game added!')
    setAddOpen(false)
  }

  const divisions = [...new Set(state.teams.map(t => t.division))].sort()

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select
          className="bg-surface-card border border-border text-white px-2 py-1 rounded font-cond text-[12px] font-bold tracking-wide"
          value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}
        >
          <option value="">All Fields</option>
          {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <select
          className="bg-surface-card border border-border text-white px-2 py-1 rounded font-cond text-[12px] font-bold tracking-wide"
          value={divFilter} onChange={e => setDivFilter(e.target.value)}
        >
          <option value="">All Divisions</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          className="bg-surface-card border border-border text-white px-2 py-1 rounded font-cond text-[12px] font-bold tracking-wide"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          {(['Scheduled','Starting','Live','Halftime','Final','Delayed'] as GameStatus[]).map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>

        <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>+ ADD GAME</Btn>

        <span className="font-cond text-[11px] text-muted ml-auto">{filtered.length} games</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-navy">
              {['TIME','FIELD','HOME','AWAY','DIVISION','STATUS','REFS','ACTIONS'].map(h => (
                <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-2 text-left border-b-2 border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(game => (
              <tr key={game.id}
                className={cn(
                  'border-b border-border/50 hover:bg-white/5 transition-colors',
                  game.status === 'Live'    ? 'bg-green-900/10' :
                  game.status === 'Delayed' ? 'bg-red-900/10' : ''
                )}>
                <td className="font-mono text-blue-300 text-[11px] px-3 py-2 whitespace-nowrap">{game.scheduled_time}</td>
                <td className="font-cond font-bold px-3 py-2">{game.field?.name ?? `F${game.field_id}`}</td>
                <td className="font-cond font-bold text-white px-3 py-2">{game.home_team?.name ?? '?'}</td>
                <td className="font-cond font-bold text-white px-3 py-2">{game.away_team?.name ?? '?'}</td>
                <td className="px-3 py-2">
                  <span className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">
                    {game.division}
                  </span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={game.status} /></td>
                <td className="px-3 py-2 text-muted text-[11px]">
                  {/* Refs shown inline */}
                  {game.status === 'Live' ? '●●' : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {game.status !== 'Final' && (
                      <button
                        onClick={() => cycleStatus(game.id, game.status)}
                        className="font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-navy hover:bg-navy-light text-white transition-colors"
                      >
                        {nextStatusLabel(game.status)}
                      </button>
                    )}
                    {['Live','Halftime'].includes(game.status) && (
                      <span className="font-mono text-green-400 font-bold text-[12px] px-1">
                        {game.home_score}–{game.away_score}
                      </span>
                    )}
                    {game.status === 'Final' && (
                      <span className="font-mono text-muted text-[12px] px-1">
                        {game.home_score}–{game.away_score}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Game Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="ADD GAME"
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setAddOpen(false)}>CANCEL</Btn>
            <Btn variant="primary" size="sm" onClick={handleAddGame}>ADD GAME</Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Field">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agField} onChange={e => setAgField(e.target.value)}>
              <option value="">Select field...</option>
              {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FormField>
          <FormField label="Time">
            <input type="time" value={agTime} onChange={e => setAgTime(e.target.value)}
              className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400" />
          </FormField>
          <FormField label="Division">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agDiv} onChange={e => setAgDiv(e.target.value)}>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <div />
          <FormField label="Home Team">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agHome} onChange={e => setAgHome(e.target.value)}>
              <option value="">Select team...</option>
              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.division})</option>)}
            </select>
          </FormField>
          <FormField label="Away Team">
            <select className="bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
              value={agAway} onChange={e => setAgAway(e.target.value)}>
              <option value="">Select team...</option>
              {state.teams.filter(t => String(t.id) !== agHome).map(t =>
                <option key={t.id} value={t.id}>{t.name} ({t.division})</option>)}
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
