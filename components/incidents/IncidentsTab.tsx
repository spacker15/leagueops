'use client'

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn, FormField } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { IncidentType, InjuryType, Incident } from '@/types'
import { createClient } from '@/supabase/client'
import { Pencil, Trash2, X, Check } from 'lucide-react'

const INCIDENT_TYPES: IncidentType[] = [
  'Player Injury',
  'Coach Incident',
  'Spectator Issue',
  'Field Issue',
  'Equipment Issue',
  'Weather Issue',
  'Warning',
  'Ejection',
]
const INJURY_TYPES: InjuryType[] = [
  'Knee / Leg',
  'Head / Concussion',
  'Ankle / Foot',
  'Arm / Shoulder',
  'General / Unknown',
]
const TRAINERS = ['Sarah Mitchell (AT)', 'Tom Guerrero (AT)', '911 / EMS']

export function IncidentsTab() {
  const {
    state,
    logIncident,
    updateIncident,
    deleteIncident,
    dispatchTrainer,
    updateMedicalStatus,
    eventId,
  } = useApp()

  // Incident form
  const [incType, setIncType] = useState<IncidentType>('Player Injury')
  const [incField, setIncField] = useState('')
  const [incGame, setIncGame] = useState('')
  const [incTeam, setIncTeam] = useState('')
  const [incPersonMode, setIncPersonMode] = useState<'roster' | 'freeform'>('roster')
  const [incPersonId, setIncPersonId] = useState('') // player ID from roster
  const [incPersonFree, setIncPersonFree] = useState('') // free-form name
  const [incDesc, setIncDesc] = useState('')
  const [rosterPlayers, setRosterPlayers] = useState<any[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)

  // Edit incident state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editType, setEditType] = useState<IncidentType>('Player Injury')
  const [editDesc, setEditDesc] = useState('')
  const [editPerson, setEditPerson] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  function startEdit(inc: Incident) {
    setEditingId(inc.id)
    setEditType(inc.type)
    setEditDesc(inc.description)
    setEditPerson(inc.person_involved ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setSavingEdit(true)
    await updateIncident(editingId, {
      type: editType,
      description: editDesc.trim(),
      person_involved: editPerson.trim() || null,
    })
    setEditingId(null)
    setSavingEdit(false)
    toast.success('Incident updated')
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this incident? This cannot be undone.')) return
    await deleteIncident(id)
    toast.success('Incident deleted')
  }

  // Trainer form
  const [trPlayer, setTrPlayer] = useState('')
  const [trPlayerMode, setTrPlayerMode] = useState<'roster' | 'freeform'>('roster')
  const [trPlayerId, setTrPlayerId] = useState('')
  const [trField, setTrField] = useState('')
  const [trInjury, setTrInjury] = useState<InjuryType>('Knee / Leg')
  const [trTrainer, setTrTrainer] = useState(TRAINERS[0])

  // When field selected, filter games on that field
  const fieldGames = useMemo(() => {
    if (!incField) return state.games
    return state.games.filter((g) => String(g.field_id) === incField)
  }, [state.games, incField])

  // When game selected, auto-set field and load team roster
  useEffect(() => {
    if (!incGame) return
    const game = state.games.find((g) => g.id === Number(incGame))
    if (!game) return
    if (!incField) setIncField(String(game.field_id))
  }, [incGame])

  // When team selected, load players from that team
  useEffect(() => {
    if (!incTeam) {
      setRosterPlayers([])
      return
    }
    setLoadingRoster(true)
    setIncPersonId('')
    const sb = createClient()
    sb.from('players')
      .select('id, name, number, position')
      .eq('team_id', Number(incTeam))
      .order('name')
      .then(({ data }) => {
        setRosterPlayers(data ?? [])
        setLoadingRoster(false)
      })
  }, [incTeam])

  // Teams on the selected game
  const gameTeams = useMemo(() => {
    if (!incGame) return state.teams
    const game = state.games.find((g) => g.id === Number(incGame))
    if (!game) return state.teams
    return state.teams.filter((t) => t.id === game.home_team_id || t.id === game.away_team_id)
  }, [incGame, state.games, state.teams])

  // Roster for trainer (team from field/game context)
  const trRosterPlayers = useMemo(() => {
    if (!incTeam) return rosterPlayers
    return rosterPlayers
  }, [rosterPlayers, incTeam])

  function getPersonName(): string {
    if (incPersonMode === 'freeform') return incPersonFree.trim()
    if (incPersonId) {
      const p = rosterPlayers.find((x) => String(x.id) === incPersonId)
      if (p) return p.name
    }
    return ''
  }

  function getTrPlayerName(): string {
    if (trPlayerMode === 'freeform') return trPlayer.trim()
    if (trPlayerId) {
      const p = rosterPlayers.find((x) => String(x.id) === trPlayerId)
      if (p) return p.name
    }
    return trPlayer.trim()
  }

  async function handleLogIncident() {
    const personName = getPersonName()
    if (!incDesc.trim()) {
      toast.error('Description required')
      return
    }
    await logIncident({
      event_id: eventId,
      game_id: incGame ? Number(incGame) : null,
      field_id: incField ? Number(incField) : null,
      team_id: incTeam ? Number(incTeam) : null,
      type: incType,
      person_involved: personName || null,
      description: incDesc.trim(),
      occurred_at: new Date().toISOString(),
    })
    setIncDesc('')
    setIncPersonFree('')
    setIncPersonId('')
    toast.success('Incident logged')
  }

  async function handleDispatch() {
    const playerName = getTrPlayerName()
    if (!playerName) {
      toast.error('Player name required')
      return
    }
    await dispatchTrainer({
      event_id: eventId,
      game_id: incGame ? Number(incGame) : null,
      field_id: trField ? Number(trField) : null,
      player_name: playerName,
      team_name: incTeam ? (state.teams.find((t) => String(t.id) === incTeam)?.name ?? null) : null,
      injury_type: trInjury,
      trainer_name: trTrainer,
      status: 'Dispatched',
      notes: null,
      dispatched_at: new Date().toISOString(),
    })
    setTrPlayer('')
    setTrPlayerId('')
    toast.success(`Trainer dispatched: ${trTrainer}`)
  }

  const sel = cn(
    'bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 w-full'
  )

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* LEFT: Forms */}
      <div>
        {/* ── Incident Form ── */}
        <SectionHeader>LOG NEW INCIDENT</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
          {/* Row 1: Type + Field */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Incident Type">
              <select
                className={sel}
                value={incType}
                onChange={(e) => setIncType(e.target.value as IncidentType)}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Field">
              <select
                className={sel}
                value={incField}
                onChange={(e) => {
                  setIncField(e.target.value)
                  setIncGame('')
                }}
              >
                <option value="">All fields…</option>
                {state.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Row 2: Game (filtered by field) */}
          <FormField label="Game" className="mb-3">
            <select className={sel} value={incGame} onChange={(e) => setIncGame(e.target.value)}>
              <option value="">Select game (optional)…</option>
              {fieldGames.map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.id} · {g.scheduled_time} · {g.home_team?.name ?? '?'} vs{' '}
                  {g.away_team?.name ?? '?'} ({g.field?.name ?? `F${g.field_id}`})
                </option>
              ))}
            </select>
          </FormField>

          {/* Row 3: Team (filtered by game if selected) */}
          <FormField label="Team" className="mb-3">
            <select className={sel} value={incTeam} onChange={(e) => setIncTeam(e.target.value)}>
              <option value="">Select team…</option>
              {gameTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.division})
                </option>
              ))}
            </select>
          </FormField>

          {/* Row 4: Person Involved */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">
                Person Involved
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setIncPersonMode('roster')}
                  className={cn(
                    'font-cond text-[9px] font-bold tracking-wide px-2 py-0.5 rounded transition-colors',
                    incPersonMode === 'roster'
                      ? 'bg-navy text-white'
                      : 'bg-surface-card border border-border text-muted hover:text-white'
                  )}
                >
                  FROM ROSTER
                </button>
                <button
                  onClick={() => setIncPersonMode('freeform')}
                  className={cn(
                    'font-cond text-[9px] font-bold tracking-wide px-2 py-0.5 rounded transition-colors',
                    incPersonMode === 'freeform'
                      ? 'bg-navy text-white'
                      : 'bg-surface-card border border-border text-muted hover:text-white'
                  )}
                >
                  FREE FORM
                </button>
              </div>
            </div>

            {incPersonMode === 'roster' ? (
              <select
                className={cn(sel, !incTeam && 'opacity-60')}
                value={incPersonId}
                onChange={(e) => setIncPersonId(e.target.value)}
                disabled={!incTeam}
              >
                <option value="">
                  {!incTeam
                    ? 'Select a team first…'
                    : loadingRoster
                      ? 'Loading roster…'
                      : 'Select player/coach…'}
                </option>
                {rosterPlayers.length > 0 && (
                  <optgroup label="PLAYERS">
                    {rosterPlayers
                      .filter((p) => p.position !== 'Coach')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.number ? ` (#${p.number})` : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
                {rosterPlayers.filter((p) => p.position === 'Coach').length > 0 && (
                  <optgroup label="COACHES">
                    {rosterPlayers
                      .filter((p) => p.position === 'Coach')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {incTeam && !loadingRoster && rosterPlayers.length === 0 && (
                  <option value="" disabled>
                    No roster on file — use Free Form
                  </option>
                )}
              </select>
            ) : (
              <input
                className={sel}
                value={incPersonFree}
                onChange={(e) => setIncPersonFree(e.target.value)}
                placeholder="Enter name (not on roster)"
              />
            )}
          </div>

          {/* Description */}
          <FormField label="Description" className="mb-3">
            <textarea
              className={cn(sel, 'resize-y min-h-[80px]')}
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              placeholder="Describe the incident in detail…"
            />
          </FormField>

          <Btn variant="danger" className="w-full" onClick={handleLogIncident}>
            LOG INCIDENT
          </Btn>
        </div>

        {/* ── Trainer Dispatch ── */}
        <SectionHeader>DISPATCH TRAINER / MEDICAL</SectionHeader>
        <div className="bg-surface-card border border-border rounded-md p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Field">
              <select className={sel} value={trField} onChange={(e) => setTrField(e.target.value)}>
                <option value="">Select field…</option>
                {state.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Injury Type">
              <select
                className={sel}
                value={trInjury}
                onChange={(e) => setTrInjury(e.target.value as InjuryType)}
              >
                {INJURY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Player name — roster or freeform */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">
                Player
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setTrPlayerMode('roster')}
                  className={cn(
                    'font-cond text-[9px] font-bold tracking-wide px-2 py-0.5 rounded transition-colors',
                    trPlayerMode === 'roster'
                      ? 'bg-navy text-white'
                      : 'bg-surface-card border border-border text-muted hover:text-white'
                  )}
                >
                  FROM ROSTER
                </button>
                <button
                  onClick={() => setTrPlayerMode('freeform')}
                  className={cn(
                    'font-cond text-[9px] font-bold tracking-wide px-2 py-0.5 rounded transition-colors',
                    trPlayerMode === 'freeform'
                      ? 'bg-navy text-white'
                      : 'bg-surface-card border border-border text-muted hover:text-white'
                  )}
                >
                  FREE FORM
                </button>
              </div>
            </div>
            {trPlayerMode === 'roster' ? (
              <select
                className={cn(sel, !incTeam && 'opacity-60')}
                value={trPlayerId}
                onChange={(e) => setTrPlayerId(e.target.value)}
                disabled={!incTeam}
              >
                <option value="">
                  {!incTeam ? 'Select team in incident form first…' : 'Select player…'}
                </option>
                {rosterPlayers
                  .filter((p) => p.position !== 'Coach')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.number ? ` (#${p.number})` : ''}
                    </option>
                  ))}
                {incTeam && rosterPlayers.length === 0 && (
                  <option value="" disabled>
                    No roster — use Free Form
                  </option>
                )}
              </select>
            ) : (
              <input
                className={sel}
                value={trPlayer}
                onChange={(e) => setTrPlayer(e.target.value)}
                placeholder="Player name"
              />
            )}
          </div>

          <FormField label="Trainer" className="mb-3">
            <select
              className={sel}
              value={trTrainer}
              onChange={(e) => setTrTrainer(e.target.value)}
            >
              {TRAINERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <Btn variant="primary" className="w-full" onClick={handleDispatch}>
            DISPATCH TRAINER
          </Btn>
        </div>

        {/* Active medical */}
        {state.medicalIncidents.filter((m) => m.status !== 'Resolved').length > 0 && (
          <div className="mt-4">
            <SectionHeader>ACTIVE MEDICAL</SectionHeader>
            {state.medicalIncidents
              .filter((m) => m.status !== 'Resolved')
              .map((m) => (
                <div
                  key={m.id}
                  className="bg-surface-card border-l-4 border-blue-500 border border-border rounded p-3 mb-2 flex justify-between items-center"
                >
                  <div>
                    <div className="font-cond font-black text-[13px] text-blue-300">
                      {m.player_name}
                    </div>
                    <div className="text-[11px] text-muted">
                      {m.injury_type} · {m.trainer_name}
                    </div>
                    <div className="text-[10px] text-muted">
                      {m.field?.name ?? '—'} · {m.status}
                    </div>
                  </div>
                  <select
                    className="bg-surface text-white text-[11px] font-cond border border-border rounded px-2 py-1 outline-none"
                    value={m.status}
                    onChange={(e) => updateMedicalStatus(m.id, e.target.value)}
                  >
                    {['Dispatched', 'On Site', 'Transported', 'Released', 'Resolved'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* RIGHT: Incident log */}
      <div>
        <SectionHeader>INCIDENT LOG ({state.incidents.length})</SectionHeader>
        <div className="space-y-2">
          {state.incidents.length === 0 && (
            <div className="text-center py-12 text-muted font-cond font-bold tracking-widest text-sm">
              NO INCIDENTS LOGGED
            </div>
          )}
          {state.incidents.map((inc) => {
            const isAlert = ['Player Injury', 'Ejection'].includes(inc.type)
            const isEditing = editingId === inc.id
            return (
              <div
                key={inc.id}
                className={cn(
                  'rounded-md p-3 border-l-4',
                  isAlert
                    ? 'bg-red-900/10 border-red-500 border border-red-900/40'
                    : 'bg-yellow-900/10 border-yellow-500 border border-yellow-900/30'
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      'font-cond font-black text-[12px] tracking-wide',
                      isAlert ? 'text-red-400' : 'text-yellow-400'
                    )}
                  >
                    {inc.type.toUpperCase()} {isAlert ? '🚨' : '⚠️'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted">
                      {new Date(inc.occurred_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(inc)}
                          className="text-muted hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(inc.id)}
                          className="text-muted hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <select
                      className="w-full bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none focus:border-blue-400"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as IncidentType)}
                    >
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none focus:border-blue-400"
                      value={editPerson}
                      onChange={(e) => setEditPerson(e.target.value)}
                      placeholder="Person involved (optional)"
                    />
                    <textarea
                      className="w-full bg-surface border border-border text-white px-2 py-1 rounded text-[12px] outline-none focus:border-blue-400 resize-y min-h-[60px]"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={savingEdit}
                        className="flex items-center gap-1 font-cond text-[11px] font-bold px-3 py-1 rounded bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-900/60 transition-colors disabled:opacity-50"
                      >
                        <Check size={11} /> SAVE
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 font-cond text-[11px] font-bold px-3 py-1 rounded bg-surface border border-border text-muted hover:text-white transition-colors"
                      >
                        <X size={11} /> CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] text-muted font-cond font-bold mb-0.5">
                      {inc.field?.name ?? '—'} · {inc.team?.name ?? '—'}
                    </div>
                    {inc.person_involved && (
                      <div className="text-[12px] text-white font-bold">{inc.person_involved}</div>
                    )}
                    <div className="text-[11px] text-gray-300 mt-1 leading-snug">
                      {inc.description}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
