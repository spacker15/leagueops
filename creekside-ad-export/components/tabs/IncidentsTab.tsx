'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { cn, fmtDate, fmtTime } from '@/lib/utils'
import {
  Card,
  SectionHeader,
  Btn,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  Pill,
} from '@/components/ui'
import * as db from '@/lib/db'
import toast from 'react-hot-toast'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { IncidentType, Player } from '@/types'

type FilterType = 'All' | IncidentType
type Severity = 'minor' | 'moderate' | 'serious'

const INCIDENT_TYPES: IncidentType[] = [
  'Injury',
  'Ejection',
  'Unsportsmanlike',
  'Equipment',
  'Weather',
  'Other',
]

const TYPE_VARIANT: Record<IncidentType, 'red' | 'yellow' | 'blue' | 'gray'> = {
  Injury: 'red',
  Ejection: 'red',
  Unsportsmanlike: 'yellow',
  Equipment: 'blue',
  Weather: 'yellow',
  Other: 'gray',
}

const SEVERITY_VARIANT: Record<Severity, 'red' | 'yellow' | 'gray'> = {
  serious: 'red',
  moderate: 'yellow',
  minor: 'gray',
}

const EMPTY_FORM = {
  type: 'Injury' as IncidentType,
  severity: 'minor' as Severity,
  description: '',
  team_id: '' as string | number,
  player_id: '' as string | number,
  game_id: '' as string | number,
  reported_by: '',
  occurred_at: '',
}

export function IncidentsTab() {
  const { incidents, teams, games, schoolId, refreshIncidents } = useApp()

  const [filterType, setFilterType] = useState<FilterType>('All')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([])

  // Load players when team changes
  useEffect(() => {
    const tid = Number(form.team_id)
    if (!tid) {
      setTeamPlayers([])
      return
    }
    db.getPlayers(tid).then(setTeamPlayers)
  }, [form.team_id])

  // Recent 30 games for "game" select
  const recentGames = useMemo(
    () => [...games].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)).slice(0, 30),
    [games]
  )

  const filtered = useMemo(() => {
    let list = incidents
    if (filterType !== 'All') {
      list = list.filter((i) => i.type === filterType)
    }
    if (filterFrom) {
      list = list.filter((i) => i.occurred_at.split('T')[0] >= filterFrom)
    }
    if (filterTo) {
      list = list.filter((i) => i.occurred_at.split('T')[0] <= filterTo)
    }
    return list
  }, [incidents, filterType, filterFrom, filterTo])

  function resetForm() {
    setForm(EMPTY_FORM)
    setTeamPlayers([])
  }

  async function handleSave() {
    if (!form.description.trim()) {
      toast.error('Description is required')
      return
    }
    if (!form.occurred_at) {
      toast.error('Date/time is required')
      return
    }
    setSaving(true)
    try {
      await db.insertIncident({
        school_id: schoolId,
        type: form.type,
        severity: form.severity,
        description: form.description.trim(),
        team_id: form.team_id ? Number(form.team_id) : undefined,
        player_id: form.player_id ? Number(form.player_id) : undefined,
        game_id: form.game_id ? Number(form.game_id) : undefined,
        reported_by: form.reported_by.trim() || undefined,
        occurred_at: form.occurred_at,
      })
      toast.success('Incident logged')
      await refreshIncidents()
      setAddOpen(false)
      resetForm()
    } catch {
      toast.error('Failed to log incident')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tab-content">
      {/* Filters + Add */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            Type
          </label>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="w-44"
          >
            <option value="All">All Types</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            From
          </label>
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            To
          </label>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-36"
          />
        </div>
        <div className="ml-auto">
          <Btn onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Log Incident
          </Btn>
        </div>
      </div>

      <SectionHeader>
        {filtered.length} {filtered.length === 1 ? 'Incident' : 'Incidents'}
      </SectionHeader>

      {filtered.length === 0 ? (
        <p className="text-muted text-[12px] font-cond font-bold tracking-wide py-4">
          No incidents found.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((inc) => {
            const isExpanded = expanded === inc.id
            const dateStr = inc.occurred_at.split('T')[0]
            const timeStr = inc.occurred_at.includes('T')
              ? inc.occurred_at.split('T')[1]?.slice(0, 5)
              : undefined

            return (
              <Card
                key={inc.id}
                className={cn(
                  'p-3 cursor-pointer transition-colors hover:border-[#2a4070]',
                  isExpanded && 'border-[#2a4070]'
                )}
                onClick={() => setExpanded(isExpanded ? null : inc.id)}
              >
                {/* Row */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill variant={TYPE_VARIANT[inc.type] ?? 'gray'}>{inc.type}</Pill>
                      {inc.severity && (
                        <Pill variant={SEVERITY_VARIANT[inc.severity as Severity] ?? 'gray'}>
                          {inc.severity}
                        </Pill>
                      )}
                    </div>
                    {/* Description */}
                    <p
                      className={cn(
                        'text-white text-[12px] font-cond leading-snug',
                        !isExpanded && 'truncate'
                      )}
                    >
                      {inc.description}
                    </p>
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-muted text-[10px] font-cond font-black tracking-widest uppercase flex-wrap">
                      {inc.team && <span>{inc.team.name}</span>}
                      {inc.player && <span>{inc.player.name}</span>}
                      <span>{fmtDate(dateStr)}</span>
                      {timeStr && <span>{fmtTime(timeStr)}</span>}
                      {inc.reported_by && <span>Rep: {inc.reported_by}</span>}
                    </div>
                  </div>
                  <div className="text-muted shrink-0 mt-0.5">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                    {inc.game && (
                      <div>
                        <span className="font-cond font-black tracking-widest uppercase text-[10px] text-muted block mb-0.5">
                          Game
                        </span>
                        <span className="text-white text-[12px] font-cond">
                          {inc.game.home_team_name} vs {inc.game.away_team_name}
                          {' · '}
                          {fmtDate(inc.game.scheduled_date)}
                        </span>
                      </div>
                    )}
                    {inc.action_taken && (
                      <div>
                        <span className="font-cond font-black tracking-widest uppercase text-[10px] text-muted block mb-0.5">
                          Action Taken
                        </span>
                        <p className="text-white text-[12px] font-cond leading-snug">
                          {inc.action_taken}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Log Incident Modal */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          resetForm()
        }}
        title="Log Incident"
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                setAddOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Btn>
            <Btn onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Log Incident'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <Select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IncidentType }))}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Severity">
              <Select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))}
              >
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Description">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the incident…"
            />
          </FormField>

          <FormField label="Team">
            <Select
              value={form.team_id}
              onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value, player_id: '' }))}
            >
              <option value="">— Select team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>

          {teamPlayers.length > 0 && (
            <FormField label="Player (optional)">
              <Select
                value={form.player_id}
                onChange={(e) => setForm((f) => ({ ...f, player_id: e.target.value }))}
              >
                <option value="">— Select player —</option>
                {teamPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jersey_number != null ? `#${p.jersey_number} ` : ''}
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Game (optional)">
            <Select
              value={form.game_id}
              onChange={(e) => setForm((f) => ({ ...f, game_id: e.target.value }))}
            >
              <option value="">— Select game —</option>
              {recentGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.home_team_name} vs {g.away_team_name} · {fmtDate(g.scheduled_date)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Reported By">
            <Input
              value={form.reported_by}
              onChange={(e) => setForm((f) => ({ ...f, reported_by: e.target.value }))}
              placeholder="Name or role"
            />
          </FormField>

          <FormField label="Date & Time">
            <Input
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
