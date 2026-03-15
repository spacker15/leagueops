'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn, FormField } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { IncidentType, InjuryType } from '@/types'

const INCIDENT_TYPES: IncidentType[] = [
  'Player Injury','Coach Incident','Spectator Issue','Field Issue',
  'Equipment Issue','Weather Issue','Warning','Ejection',
]
const INJURY_TYPES: InjuryType[] = [
  'Knee / Leg','Head / Concussion','Ankle / Foot','Arm / Shoulder','General / Unknown',
]
const TRAINERS = ['Sarah Mitchell (AT)', 'Tom Guerrero (AT)', '911 / EMS']

export function IncidentsTab() {
  const { state, logIncident, dispatchTrainer, updateMedicalStatus } = useApp()

  // Incident form
  const [incType, setIncType]     = useState<IncidentType>('Player Injury')
  const [incField, setIncField]   = useState('')
  const [incGame, setIncGame]     = useState('')
  const [incTeam, setIncTeam]     = useState('')
  const [incPerson, setIncPerson] = useState('')
  const [incDesc, setIncDesc]     = useState('')

  // Trainer form
  const [trPlayer, setTrPlayer]   = useState('')
  const [trField, setTrField]     = useState('')
  const [trInjury, setTrInjury]   = useState<InjuryType>('Knee / Leg')
  const [trTrainer, setTrTrainer] = useState(TRAINERS[0])

  async function handleLogIncident() {
    if (!incDesc.trim()) { toast.error('Description required'); return }
    await logIncident({
      event_id: 1,
      game_id: incGame ? Number(incGame) : null,
      field_id: incField ? Number(incField) : null,
      team_id: incTeam ? Number(incTeam) : null,
      type: incType,
      person_involved: incPerson.trim() || null,
      description: incDesc.trim(),
      occurred_at: new Date().toISOString(),
    })
    setIncDesc(''); setIncPerson('')
    toast.success('Incident logged')
  }

  async function handleDispatch() {
    if (!trPlayer.trim()) { toast.error('Player name required'); return }
    await dispatchTrainer({
      event_id: 1,
      game_id: null,
      field_id: trField ? Number(trField) : null,
      player_name: trPlayer.trim(),
      team_name: null,
      injury_type: trInjury,
      trainer_name: trTrainer,
      status: 'Dispatched',
      notes: null,
      dispatched_at: new Date().toISOString(),
    })
    setTrPlayer('')
    toast.success(`Trainer dispatched: ${trTrainer}`)
  }

  const select = (cls?: string) => cn(
    'bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 w-full',
    cls
  )

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* LEFT: forms */}
      <div>
        {/* Incident form */}
        <SectionHeader>LOG NEW INCIDENT</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Type">
              <select className={select()} value={incType} onChange={e => setIncType(e.target.value as IncidentType)}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Field">
              <select className={select()} value={incField} onChange={e => setIncField(e.target.value)}>
                <option value="">Select field…</option>
                {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </FormField>
            <FormField label="Team">
              <select className={select()} value={incTeam} onChange={e => setIncTeam(e.target.value)}>
                <option value="">Select team…</option>
                {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Game">
              <select className={select()} value={incGame} onChange={e => setIncGame(e.target.value)}>
                <option value="">Select game…</option>
                {state.games.map(g => (
                  <option key={g.id} value={g.id}>
                    #{g.id}: {g.home_team?.name ?? '?'} vs {g.away_team?.name ?? '?'}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Person Involved" className="mb-3">
            <input className={select()} value={incPerson} onChange={e => setIncPerson(e.target.value)}
              placeholder="Name (optional)" />
          </FormField>
          <FormField label="Description" className="mb-3">
            <textarea className={cn(select(), 'resize-y min-h-[80px]')} value={incDesc}
              onChange={e => setIncDesc(e.target.value)} placeholder="Describe the incident…" />
          </FormField>
          <Btn variant="danger" className="w-full" onClick={handleLogIncident}>LOG INCIDENT</Btn>
        </div>

        {/* Trainer dispatch */}
        <SectionHeader>DISPATCH TRAINER / MEDICAL</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Player Name">
              <input className={select()} value={trPlayer} onChange={e => setTrPlayer(e.target.value)}
                placeholder="Player name" />
            </FormField>
            <FormField label="Field">
              <select className={select()} value={trField} onChange={e => setTrField(e.target.value)}>
                <option value="">Select field…</option>
                {state.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </FormField>
            <FormField label="Injury Type">
              <select className={select()} value={trInjury} onChange={e => setTrInjury(e.target.value as InjuryType)}>
                {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Trainer">
              <select className={select()} value={trTrainer} onChange={e => setTrTrainer(e.target.value)}>
                {TRAINERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <Btn variant="primary" className="w-full" onClick={handleDispatch}>DISPATCH TRAINER</Btn>
        </div>

        {/* Active medical */}
        {state.medicalIncidents.filter(m => m.status !== 'Resolved').length > 0 && (
          <div className="mt-4">
            <SectionHeader>ACTIVE MEDICAL</SectionHeader>
            {state.medicalIncidents.filter(m => m.status !== 'Resolved').map(m => (
              <div key={m.id} className="bg-surface-card border-l-4 border-blue-500 border border-border rounded p-3 mb-2 flex justify-between items-center">
                <div>
                  <div className="font-cond font-black text-[13px] text-blue-300">{m.player_name}</div>
                  <div className="text-[11px] text-muted">{m.injury_type} · {m.trainer_name}</div>
                  <div className="text-[10px] text-muted">{m.field?.name ?? '—'} · {m.status}</div>
                </div>
                <select
                  className="bg-surface text-white text-[11px] font-cond border border-border rounded px-2 py-1"
                  value={m.status}
                  onChange={e => updateMedicalStatus(m.id, e.target.value)}
                >
                  {['Dispatched','On Site','Transported','Released','Resolved'].map(s =>
                    <option key={s} value={s}>{s}</option>
                  )}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: incident log */}
      <div>
        <SectionHeader>INCIDENT LOG ({state.incidents.length})</SectionHeader>
        <div className="space-y-2">
          {state.incidents.length === 0 && (
            <div className="text-center py-12 text-muted font-cond font-bold tracking-widest text-sm">
              NO INCIDENTS LOGGED
            </div>
          )}
          {state.incidents.map(inc => {
            const isAlert = ['Player Injury','Ejection'].includes(inc.type)
            return (
              <div key={inc.id} className={cn(
                'rounded-md p-3 border-l-4',
                isAlert
                  ? 'bg-red-900/10 border-red-500 border border-red-900/40'
                  : 'bg-yellow-900/10 border-yellow-500 border border-yellow-900/30'
              )}>
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    'font-cond font-black text-[12px] tracking-wide',
                    isAlert ? 'text-red-400' : 'text-yellow-400'
                  )}>
                    {inc.type.toUpperCase()} {isAlert ? '🚨' : '⚠️'}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {new Date(inc.occurred_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                  </span>
                </div>
                <div className="text-[11px] text-muted font-cond font-bold">
                  {inc.field?.name ?? '—'} · {inc.team?.name ?? '—'}
                </div>
                {inc.person_involved && (
                  <div className="text-[12px] text-white mt-0.5">{inc.person_involved}</div>
                )}
                <div className="text-[11px] text-gray-300 mt-1">{inc.description}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
