'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn, FormField } from '@/components/ui'
import { generateSchedule } from '@/lib/utils'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { GeneratedGame } from '@/types'

export function EngineTab() {
  const { state, addGame, currentDate, eventId } = useApp()
  if (!eventId) return null

  const [engDivision, setEngDivision] = useState('U14')
  const [teamInput, setTeamInput] = useState('')
  const [teams, setTeams] = useState<Array<{ name: string; division: string }>>([])
  const [gamesPerTeam, setGamesPerTeam] = useState(3)
  const [duration, setDuration] = useState(60)
  const [startTime, setStartTime] = useState('08:00')
  const [minRest, setMinRest] = useState(90)
  const [selectedFields, setSelectedFields] = useState<number[]>(
    state.fields.slice(0, 6).map((f) => f.id)
  )
  const [generated, setGenerated] = useState<GeneratedGame[] | null>(null)
  const [importing, setImporting] = useState(false)

  function addTeam() {
    const name = teamInput.trim()
    if (!name) return
    if (teams.find((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Team already added')
      return
    }
    setTeams((prev) => [...prev, { name, division: engDivision }])
    setTeamInput('')
  }

  function removeTeam(name: string) {
    setTeams((prev) => prev.filter((t) => t.name !== name))
  }

  function toggleField(id: number) {
    setSelectedFields((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function runEngine() {
    if (teams.length < 2) {
      toast.error('Add at least 2 teams')
      return
    }
    if (selectedFields.length === 0) {
      toast.error('Select at least one field')
      return
    }
    const fieldNames = selectedFields.map(
      (id) => state.fields.find((f) => f.id === id)?.name ?? `Field ${id}`
    )
    const result = generateSchedule({
      teams,
      fields: fieldNames,
      gamesPerTeam,
      gameDurationMinutes: duration,
      startTime,
      minRestMinutes: minRest,
    })
    setGenerated(result)
    toast.success(`${result.length} games generated`)
  }

  async function importSchedule() {
    if (!generated || !currentDate) {
      toast.error('No schedule or no event date selected')
      return
    }
    setImporting(true)
    let added = 0
    for (const g of generated) {
      const homeTeam = state.teams.find((t) => t.name === g.home)
      const awayTeam = state.teams.find((t) => t.name === g.away)
      const field = state.fields.find((f) => f.name === g.field)
      if (!homeTeam || !awayTeam || !field) continue
      await addGame({
        event_id: eventId,
        event_date_id: currentDate.id,
        field_id: field.id,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        division: g.division,
        scheduled_time: g.time,
        status: 'Scheduled',
        home_score: 0,
        away_score: 0,
        notes: null,
      })
      added++
    }
    toast.success(`✓ ${added} games imported to schedule!`)
    setImporting(false)
    setGenerated(null)
  }

  const divisions = [...new Set(state.teams.map((t) => t.division))].sort()

  return (
    <div>
      <SectionHeader>SCHEDULING ENGINE</SectionHeader>
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT: inputs */}
        <div>
          <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
            <div className="font-cond font-black text-[13px] tracking-wide mb-3">
              TEAMS & DIVISIONS
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormField label="Division">
                <select
                  className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={engDivision}
                  onChange={(e) => setEngDivision(e.target.value)}
                >
                  {divisions.length > 0
                    ? divisions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))
                    : ['U10', 'U12', 'U14', 'U16', 'U18'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                </select>
              </FormField>
              <FormField label="Add Team">
                <div className="flex gap-1">
                  <input
                    className="flex-1 bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTeam()}
                    placeholder="Team name"
                  />
                  <Btn size="sm" variant="primary" onClick={addTeam}>
                    +
                  </Btn>
                </div>
              </FormField>
            </div>

            {/* Team tags */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] mb-3">
              {teams.length === 0 ? (
                <span className="text-[11px] text-muted font-cond">No teams added yet…</span>
              ) : (
                teams.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1 bg-blue-900/30 border border-blue-800/50 text-blue-300 font-cond font-bold text-[11px] px-2 py-0.5 rounded"
                  >
                    {t.name}
                    <span className="text-[9px] text-blue-500">{t.division}</span>
                    <button
                      onClick={() => removeTeam(t.name)}
                      className="text-muted hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
            <div className="font-cond font-black text-[13px] tracking-wide mb-3">
              SCHEDULE PARAMETERS
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Games per Team">
                <select
                  className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={gamesPerTeam}
                  onChange={(e) => setGamesPerTeam(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} game{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Game Duration">
                <select
                  className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {[40, 50, 60, 70, 80].map((n) => (
                    <option key={n} value={n}>
                      {n} min
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                />
              </FormField>
              <FormField label="Min Rest (min)">
                <input
                  type="number"
                  min={30}
                  value={minRest}
                  onChange={(e) => setMinRest(Number(e.target.value))}
                  className="bg-surface border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400"
                />
              </FormField>
            </div>
          </div>

          <div className="bg-surface-card border border-border rounded-md p-4 mb-4">
            <div className="font-cond font-black text-[13px] tracking-wide mb-2">
              AVAILABLE FIELDS
            </div>
            <div className="flex flex-wrap gap-2">
              {state.fields.map((f) => (
                <label key={f.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.id)}
                    onChange={() => toggleField(f.id)}
                    className="cursor-pointer"
                  />
                  <span className="font-cond font-bold text-[12px] text-blue-300">{f.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Btn variant="primary" className="w-full" onClick={runEngine}>
            GENERATE SCHEDULE
          </Btn>
        </div>

        {/* RIGHT: output */}
        <div>
          <div className="bg-surface-card border border-border rounded-md p-4 h-full flex flex-col">
            <div className="font-cond font-black text-[13px] tracking-wide mb-3 flex justify-between items-center">
              <span>GENERATED SCHEDULE</span>
              {generated && (
                <span className="font-cond text-[11px] text-green-400 font-bold">
                  {generated.length} GAMES
                </span>
              )}
            </div>

            {!generated ? (
              <div className="flex-1 flex items-center justify-center text-muted font-cond font-bold text-sm tracking-widest">
                RUN ENGINE TO GENERATE
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto font-mono text-[11px] bg-black/30 rounded p-3 mb-3 space-y-0.5">
                  {generated.map((g, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted w-5 text-right shrink-0">{i + 1}.</span>
                      <span className="text-blue-300 w-20 shrink-0">{g.time}</span>
                      <span className="text-white w-20 shrink-0">{g.field}</span>
                      <span className="text-green-400 flex-1 truncate">{g.home}</span>
                      <span className="text-muted">vs</span>
                      <span className="text-red-400 flex-1 truncate">{g.away}</span>
                      <span className="text-muted text-[9px] w-12 text-right shrink-0">
                        {g.division}
                      </span>
                    </div>
                  ))}
                </div>
                <Btn
                  variant="success"
                  className="w-full"
                  onClick={importSchedule}
                  disabled={importing}
                >
                  {importing ? 'IMPORTING…' : `IMPORT ${generated.length} GAMES TO SCHEDULE`}
                </Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
