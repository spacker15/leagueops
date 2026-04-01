'use client'

import { useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, fmtDate, fmtTime, STATUS_CLASS } from '@/lib/utils'
import type { Game, GameStatus, Sport, Team } from '@/types'
import * as db from '@/lib/db'
import { useApp } from '@/lib/store'
import { StatusBadge, Btn, FormField, Input, Select, Textarea, Modal } from '@/components/ui'

const GAME_STATUSES: GameStatus[] = [
  'Scheduled',
  'Live',
  'Halftime',
  'Final',
  'Cancelled',
  'Postponed',
  'Forfeit',
]

function groupByDate(games: Game[]): [string, Game[]][] {
  const map = new Map<string, Game[]>()
  for (const g of games) {
    const key = g.scheduled_date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(g)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function fmtDateHeader(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

interface AddGameForm {
  team_id: string
  opponent: string
  is_home: boolean
  scheduled_date: string
  scheduled_time: string
  location: string
  notes: string
}

const EMPTY_FORM: AddGameForm = {
  team_id: '',
  opponent: '',
  is_home: true,
  scheduled_date: '',
  scheduled_time: '',
  location: '',
  notes: '',
}

interface InlineEdit {
  gameId: number
  home_score: string
  away_score: string
  status: GameStatus
}

export function ScheduleTab() {
  const { games, teams, sports, schoolId, refreshGames, updateGameScore, updateGameStatus } =
    useApp()

  const [filterSport, setFilterSport] = useState<string>('')
  const [filterTeam, setFilterTeam] = useState<string>('')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AddGameForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [expanded, setExpanded] = useState<number | null>(null)
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Derive sport list from teams present in games
  const activeSports: Sport[] = useMemo(() => {
    const ids = new Set(games.map((g) => g.sport_id))
    return sports.filter((s) => ids.has(s.id))
  }, [games, sports])

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (filterSport && String(g.sport_id) !== filterSport) return false
      if (filterTeam && String(g.team_id) !== filterTeam) return false
      if (filterFrom && g.scheduled_date < filterFrom) return false
      if (filterTo && g.scheduled_date > filterTo) return false
      return true
    })
  }, [games, filterSport, filterTeam, filterFrom, filterTo])

  const grouped = useMemo(() => groupByDate(filteredGames), [filteredGames])

  const teamsForFilter = useMemo(() => {
    if (!filterSport) return teams
    return teams.filter((t) => String(t.sport_id) === filterSport)
  }, [teams, filterSport])

  function handleFormChange(field: keyof AddGameForm, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleAddGame() {
    if (!form.team_id) {
      toast.error('Select a team')
      return
    }
    if (!form.opponent.trim()) {
      toast.error('Enter opponent name')
      return
    }
    if (!form.scheduled_date) {
      toast.error('Select a date')
      return
    }

    const team = teams.find((t) => t.id === Number(form.team_id))
    if (!team) {
      toast.error('Team not found')
      return
    }

    setSaving(true)
    try {
      await db.insertGame({
        team_id: team.id,
        sport_id: team.sport_id,
        school_id: schoolId,
        home_team_name: form.is_home ? team.name : form.opponent.trim(),
        away_team_name: form.is_home ? form.opponent.trim() : team.name,
        is_home: form.is_home,
        location: form.location.trim() || undefined,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time || undefined,
        status: 'Scheduled',
        home_score: 0,
        away_score: 0,
        notes: form.notes.trim() || undefined,
      })
      toast.success('Game added')
      await refreshGames()
      setAddOpen(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.error('Failed to add game')
    } finally {
      setSaving(false)
    }
  }

  function openExpand(game: Game) {
    if (expanded === game.id) {
      setExpanded(null)
      setInlineEdit(null)
      return
    }
    setExpanded(game.id)
    setInlineEdit({
      gameId: game.id,
      home_score: String(game.home_score),
      away_score: String(game.away_score),
      status: game.status,
    })
  }

  async function handleInlineSave() {
    if (!inlineEdit) return
    setInlineSaving(true)
    try {
      const home = parseInt(inlineEdit.home_score) || 0
      const away = parseInt(inlineEdit.away_score) || 0
      await updateGameScore(inlineEdit.gameId, home, away)
      await updateGameStatus(inlineEdit.gameId, inlineEdit.status)
      toast.success('Game updated')
      setExpanded(null)
      setInlineEdit(null)
    } catch {
      toast.error('Failed to save')
    } finally {
      setInlineSaving(false)
    }
  }

  async function handleDelete(gameId: number) {
    try {
      await db.deleteGame(gameId)
      toast.success('Game deleted')
      await refreshGames()
      setConfirmDelete(null)
      if (expanded === gameId) {
        setExpanded(null)
        setInlineEdit(null)
      }
    } catch {
      toast.error('Failed to delete game')
    }
  }

  const showScore = (g: Game) =>
    g.status === 'Final' || g.status === 'Live' || g.status === 'Halftime'

  return (
    <div className="tab-content">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5 items-end">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            Sport
          </span>
          <select
            value={filterSport}
            onChange={(e) => {
              setFilterSport(e.target.value)
              setFilterTeam('')
            }}
            className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
          >
            <option value="">All Sports</option>
            {activeSports.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[160px]">
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            Team
          </span>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
          >
            <option value="">All Teams</option>
            {teamsForFilter.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            From
          </span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            To
          </span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
          />
        </div>

        <div className="ml-auto">
          <Btn variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> Add Game
          </Btn>
        </div>
      </div>

      {/* Game list grouped by date */}
      {grouped.length === 0 ? (
        <div className="text-center text-muted text-[13px] py-16">
          No games match the current filters.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([date, dayGames]) => (
            <div key={date}>
              <div className="border-b border-border pb-1.5 mb-3">
                <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                  {fmtDateHeader(date)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {dayGames.map((game) => {
                  const isOpen = expanded === game.id
                  const teamName = game.team?.name ?? ''
                  const sportName = game.team?.sport?.name ?? ''
                  return (
                    <div
                      key={game.id}
                      className="bg-surface-card border border-border rounded-xl overflow-hidden"
                    >
                      {/* Game row */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                        onClick={() => openExpand(game)}
                      >
                        {/* Time */}
                        <span className="font-mono text-[12px] text-muted w-16 shrink-0">
                          {game.scheduled_time ? fmtTime(game.scheduled_time) : '--:--'}
                        </span>

                        {/* Matchup */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-cond font-bold text-[13px] text-white">
                              {game.home_team_name}
                            </span>
                            <span className="text-muted text-[11px]">vs</span>
                            <span className="font-cond font-bold text-[13px] text-white">
                              {game.away_team_name}
                            </span>
                            {showScore(game) && (
                              <span className="font-mono text-[12px] text-white ml-1">
                                {game.home_score} – {game.away_score}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {teamName && (
                              <span className="font-cond text-[10px] text-muted uppercase tracking-wide">
                                {teamName}
                              </span>
                            )}
                            {sportName && (
                              <span className="font-cond text-[10px] text-muted/60 uppercase tracking-wide">
                                · {sportName}
                              </span>
                            )}
                            {game.location && (
                              <span className="font-cond text-[10px] text-muted/60 uppercase tracking-wide">
                                · {game.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <StatusBadge status={game.status} />

                        {/* Expand chevron */}
                        <span className="text-muted ml-1">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>

                      {/* Inline edit panel */}
                      {isOpen && inlineEdit && inlineEdit.gameId === game.id && (
                        <div className="border-t border-border px-4 py-3 bg-[#040e24]">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex flex-col gap-1">
                              <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                                {game.home_team_name} Score
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={inlineEdit.home_score}
                                onChange={(e) =>
                                  setInlineEdit({ ...inlineEdit, home_score: e.target.value })
                                }
                                className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors w-20 font-mono"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                                {game.away_team_name} Score
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={inlineEdit.away_score}
                                onChange={(e) =>
                                  setInlineEdit({ ...inlineEdit, away_score: e.target.value })
                                }
                                className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors w-20 font-mono"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                                Status
                              </span>
                              <select
                                value={inlineEdit.status}
                                onChange={(e) =>
                                  setInlineEdit({
                                    ...inlineEdit,
                                    status: e.target.value as GameStatus,
                                  })
                                }
                                className="bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors"
                              >
                                {GAME_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex gap-2 ml-auto">
                              <Btn
                                variant="danger"
                                size="sm"
                                onClick={() => setConfirmDelete(game.id)}
                              >
                                <Trash2 size={12} /> Delete
                              </Btn>
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setExpanded(null)
                                  setInlineEdit(null)
                                }}
                              >
                                Cancel
                              </Btn>
                              <Btn
                                variant="success"
                                size="sm"
                                onClick={handleInlineSave}
                                disabled={inlineSaving}
                              >
                                {inlineSaving ? 'Saving…' : 'Save'}
                              </Btn>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Game Modal */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setForm(EMPTY_FORM)
        }}
        title="Add Game"
        footer={
          <>
            <Btn
              variant="ghost"
              size="md"
              onClick={() => {
                setAddOpen(false)
                setForm(EMPTY_FORM)
              }}
            >
              Cancel
            </Btn>
            <Btn variant="primary" size="md" onClick={handleAddGame} disabled={saving}>
              {saving ? 'Saving…' : 'Add Game'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Team">
            <Select
              value={form.team_id}
              onChange={(e) => handleFormChange('team_id', e.target.value)}
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Opponent">
            <Input
              placeholder="Opponent name"
              value={form.opponent}
              onChange={(e) => handleFormChange('opponent', e.target.value)}
            />
          </FormField>

          <FormField label="Home / Away">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFormChange('is_home', true)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[12px] font-cond font-bold border transition-colors',
                  form.is_home
                    ? 'bg-navy border-navy text-white'
                    : 'bg-transparent border-border text-muted hover:text-white'
                )}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleFormChange('is_home', false)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[12px] font-cond font-bold border transition-colors',
                  !form.is_home
                    ? 'bg-navy border-navy text-white'
                    : 'bg-transparent border-border text-muted hover:text-white'
                )}
              >
                Away
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date">
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => handleFormChange('scheduled_date', e.target.value)}
              />
            </FormField>
            <FormField label="Time">
              <Input
                type="time"
                value={form.scheduled_time}
                onChange={(e) => handleFormChange('scheduled_time', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Location">
            <Input
              placeholder="e.g. Home Field, Gym A"
              value={form.location}
              onChange={(e) => handleFormChange('location', e.target.value)}
            />
          </FormField>

          <FormField label="Notes">
            <Textarea
              rows={3}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete Game"
        footer={
          <>
            <Btn variant="ghost" size="md" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              size="md"
              onClick={() => confirmDelete !== null && handleDelete(confirmDelete)}
            >
              Delete
            </Btn>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          Are you sure you want to delete this game? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
