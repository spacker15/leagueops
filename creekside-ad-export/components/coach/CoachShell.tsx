'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useApp, AppProvider } from '@/lib/store'
import { cn, fmtDate, fmtTime, initials, SPORT_STAT_KEYS } from '@/lib/utils'
import {
  Card,
  SectionHeader,
  Btn,
  Modal,
  FormField,
  Input,
  Select,
  Avatar,
  StatusBadge,
  EligBadge,
  Pill,
} from '@/components/ui'
import * as db from '@/lib/db'
import toast from 'react-hot-toast'
import { LogOut, Save } from 'lucide-react'
import type { Player, Game, GameStat, GameStatus } from '@/types'

// ── Coach Roster Tab ──────────────────────────────────────────────────────────

function CoachRosterTab({ teamId }: { teamId: number }) {
  const { teams } = useApp()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    jersey_number: '',
    position: '',
    grade_level: '',
  })
  const [saving, setSaving] = useState(false)

  const team = teams.find((t) => t.id === teamId)

  useEffect(() => {
    setLoading(true)
    db.getPlayers(teamId).then((p) => {
      setPlayers(p)
      setLoading(false)
    })
  }, [teamId])

  function openEdit(player: Player) {
    setEditPlayer(player)
    setEditForm({
      name: player.name,
      jersey_number: player.jersey_number != null ? String(player.jersey_number) : '',
      position: player.position ?? '',
      grade_level: player.grade_level ?? '',
    })
  }

  async function handleSave() {
    if (!editPlayer) return
    if (!editForm.name.trim()) {
      toast.error('Name required')
      return
    }
    setSaving(true)
    try {
      await db.updatePlayer(editPlayer.id, {
        name: editForm.name.trim(),
        jersey_number: editForm.jersey_number ? Number(editForm.jersey_number) : undefined,
        position: editForm.position.trim() || undefined,
        grade_level: editForm.grade_level.trim() || undefined,
      })
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === editPlayer.id
            ? {
                ...p,
                name: editForm.name.trim(),
                jersey_number: editForm.jersey_number ? Number(editForm.jersey_number) : undefined,
                position: editForm.position.trim() || undefined,
                grade_level: editForm.grade_level.trim() || undefined,
              }
            : p
        )
      )
      toast.success('Player updated')
      setEditPlayer(null)
    } catch {
      toast.error('Failed to update player')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tab-content flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="tab-content">
      <SectionHeader>
        {team?.name ?? 'My Team'} — {players.length} Players
      </SectionHeader>

      {players.length === 0 ? (
        <p className="text-muted text-[12px] font-cond py-4">No players on roster.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {players.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-navy/30 border border-navy/50 flex items-center justify-center shrink-0">
                <span className="font-mono text-[11px] text-blue-300 font-bold">
                  {p.jersey_number != null ? `#${p.jersey_number}` : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-cond font-black text-[13px] text-white truncate">{p.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.position && (
                    <span className="font-cond text-[11px] text-muted">{p.position}</span>
                  )}
                  {p.grade_level && (
                    <span className="font-cond text-[11px] text-muted">{p.grade_level}</span>
                  )}
                  <EligBadge status={p.eligibility_status} />
                </div>
              </div>
              <button
                onClick={() => openEdit(p)}
                className="font-cond text-[11px] text-muted hover:text-white transition-colors shrink-0"
              >
                Edit
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editPlayer}
        onClose={() => setEditPlayer(null)}
        title="Edit Player"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditPlayer(null)}>
              Cancel
            </Btn>
            <Btn onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Name">
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Jersey #">
            <Input
              type="number"
              min={0}
              max={99}
              value={editForm.jersey_number}
              onChange={(e) => setEditForm((f) => ({ ...f, jersey_number: e.target.value }))}
            />
          </FormField>
          <FormField label="Position">
            <Input
              value={editForm.position}
              onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="e.g. Attacker, Goalkeeper"
            />
          </FormField>
          <FormField label="Grade Level">
            <Input
              value={editForm.grade_level}
              onChange={(e) => setEditForm((f) => ({ ...f, grade_level: e.target.value }))}
              placeholder="e.g. 10th, Junior"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

// ── Coach Schedule Tab ────────────────────────────────────────────────────────

const STATUSES: GameStatus[] = [
  'Scheduled',
  'Live',
  'Halftime',
  'Final',
  'Cancelled',
  'Postponed',
  'Forfeit',
]

function CoachScheduleTab({ teamId }: { teamId: number }) {
  const { updateGameScore, updateGameStatus } = useApp()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [editGame, setEditGame] = useState<Game | null>(null)
  const [scoreForm, setScoreForm] = useState({
    home: '',
    away: '',
    status: 'Scheduled' as GameStatus,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    db.getGamesByTeam(teamId).then((g) => {
      setGames(g)
      setLoading(false)
    })
  }, [teamId])

  function openEdit(game: Game) {
    setEditGame(game)
    setScoreForm({
      home: String(game.home_score),
      away: String(game.away_score),
      status: game.status,
    })
  }

  async function handleSave() {
    if (!editGame) return
    setSaving(true)
    try {
      const home = Number(scoreForm.home) || 0
      const away = Number(scoreForm.away) || 0
      await updateGameScore(editGame.id, home, away)
      if (scoreForm.status !== editGame.status) {
        await updateGameStatus(editGame.id, scoreForm.status)
      }
      setGames((prev) =>
        prev.map((g) =>
          g.id === editGame.id
            ? { ...g, home_score: home, away_score: away, status: scoreForm.status }
            : g
        )
      )
      toast.success('Game updated')
      setEditGame(null)
    } catch {
      toast.error('Failed to update game')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tab-content flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = games.filter(
    (g) => g.scheduled_date >= today && g.status !== 'Final' && g.status !== 'Cancelled'
  )
  const past = games.filter(
    (g) => g.scheduled_date < today || g.status === 'Final' || g.status === 'Cancelled'
  )

  return (
    <div className="tab-content flex flex-col gap-5">
      <section>
        <SectionHeader>Upcoming Games</SectionHeader>
        {upcoming.length === 0 ? (
          <p className="text-muted text-[12px] font-cond py-4">No upcoming games.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((g) => (
              <Card key={g.id} className="p-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-cond font-bold text-[13px] text-white truncate">
                    {g.home_team_name}
                    <span className="text-muted mx-1.5 font-normal">vs</span>
                    {g.away_team_name}
                  </div>
                  <div className="font-cond text-[11px] text-muted mt-0.5">
                    {fmtDate(g.scheduled_date)}
                    {g.scheduled_time ? ` · ${fmtTime(g.scheduled_time)}` : ''}
                    {g.location ? ` · ${g.location}` : ''}
                  </div>
                </div>
                <StatusBadge status={g.status} />
                <Btn size="sm" variant="outline" onClick={() => openEdit(g)}>
                  Update
                </Btn>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader>Results</SectionHeader>
        {past.length === 0 ? (
          <p className="text-muted text-[12px] font-cond py-4">No completed games yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {past.map((g) => (
              <Card key={g.id} className="p-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-cond font-bold text-[13px] text-white truncate">
                    {g.home_team_name}
                    <span className="text-muted mx-1.5 font-normal">vs</span>
                    {g.away_team_name}
                  </div>
                  <div className="font-cond text-[11px] text-muted mt-0.5">
                    {fmtDate(g.scheduled_date)}
                  </div>
                </div>
                {(g.status === 'Final' || g.status === 'Live' || g.status === 'Halftime') && (
                  <span className="font-mono text-[14px] text-white font-bold shrink-0">
                    {g.home_score} – {g.away_score}
                  </span>
                )}
                <StatusBadge status={g.status} />
                <Btn size="sm" variant="outline" onClick={() => openEdit(g)}>
                  Edit
                </Btn>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={!!editGame}
        onClose={() => setEditGame(null)}
        title="Update Game"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditGame(null)}>
              Cancel
            </Btn>
            <Btn onClick={handleSave} disabled={saving}>
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </Btn>
          </>
        }
      >
        {editGame && (
          <div className="flex flex-col gap-3">
            <div className="font-cond text-[12px] text-muted">
              {editGame.home_team_name} vs {editGame.away_team_name}
              {' · '}
              {fmtDate(editGame.scheduled_date)}
            </div>
            <FormField label="Status">
              <Select
                value={scoreForm.status}
                onChange={(e) =>
                  setScoreForm((f) => ({ ...f, status: e.target.value as GameStatus }))
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={`${editGame.home_team_name} (Home)`}>
                <Input
                  type="number"
                  min={0}
                  value={scoreForm.home}
                  onChange={(e) => setScoreForm((f) => ({ ...f, home: e.target.value }))}
                />
              </FormField>
              <FormField label={`${editGame.away_team_name} (Away)`}>
                <Input
                  type="number"
                  min={0}
                  value={scoreForm.away}
                  onChange={(e) => setScoreForm((f) => ({ ...f, away: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Coach Stats Tab ───────────────────────────────────────────────────────────

function CoachStatsTab({ teamId }: { teamId: number }) {
  const { teams } = useApp()
  const team = teams.find((t) => t.id === teamId)
  const sportName = team?.sport?.name ?? ''
  const statKeys = SPORT_STAT_KEYS[sportName] ?? []

  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedGame, setSelectedGame] = useState<number | null>(null)
  const [existingStats, setExistingStats] = useState<GameStat[]>([])
  const [statRows, setStatRows] = useState<Record<number, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([db.getGamesByTeam(teamId), db.getPlayers(teamId)]).then(([g, p]) => {
      setGames(g.filter((x) => x.status === 'Final' || x.status === 'Live'))
      setPlayers(p)
      setLoading(false)
    })
  }, [teamId])

  useEffect(() => {
    if (!selectedGame) {
      setExistingStats([])
      setStatRows({})
      return
    }
    db.getGameStats(selectedGame).then((stats) => {
      setExistingStats(stats)
      const rows: Record<number, Record<string, string>> = {}
      for (const s of stats) {
        rows[s.player_id] = {}
        for (const key of statKeys) {
          rows[s.player_id][key.key] = String(s.stats[key.key] ?? '')
        }
      }
      setStatRows(rows)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame])

  function getRow(playerId: number): Record<string, string> {
    return statRows[playerId] ?? {}
  }

  function setCell(playerId: number, key: string, val: string) {
    setStatRows((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [key]: val },
    }))
  }

  async function handleSave() {
    if (!selectedGame) return
    setSaving(true)
    try {
      await Promise.all(
        players.map((p) => {
          const row = getRow(p.id)
          const stats: Record<string, number> = {}
          for (const key of statKeys) {
            stats[key.key] = Number(row[key.key]) || 0
          }
          return db.upsertGameStat({
            game_id: selectedGame,
            player_id: p.id,
            team_id: teamId,
            stats,
          })
        })
      )
      toast.success('Stats saved')
    } catch {
      toast.error('Failed to save stats')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tab-content flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="flex items-end gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1 max-w-sm">
          <label className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            Select Game
          </label>
          <Select
            value={selectedGame ?? ''}
            onChange={(e) => setSelectedGame(Number(e.target.value) || null)}
          >
            <option value="">— Choose a game —</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.home_team_name} vs {g.away_team_name} · {fmtDate(g.scheduled_date)}
              </option>
            ))}
          </Select>
        </div>
        {selectedGame && (
          <Btn onClick={handleSave} disabled={saving}>
            <Save size={13} /> {saving ? 'Saving…' : 'Save Stats'}
          </Btn>
        )}
      </div>

      {!selectedGame ? (
        <p className="text-muted text-[12px] font-cond py-4">
          Select a game above to enter player stats.
        </p>
      ) : statKeys.length === 0 ? (
        <p className="text-muted text-[12px] font-cond py-4">
          No stat categories configured for {sportName || 'this sport'}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="font-cond font-black tracking-widest uppercase text-[10px] text-muted py-2 pr-4 whitespace-nowrap">
                  Player
                </th>
                {statKeys.map((k) => (
                  <th
                    key={k.key}
                    className="font-cond font-black tracking-widest uppercase text-[10px] text-muted py-2 px-2 text-center whitespace-nowrap"
                  >
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {p.jersey_number != null && (
                        <span className="font-mono text-[11px] text-muted w-6 shrink-0">
                          #{p.jersey_number}
                        </span>
                      )}
                      <span className="font-cond text-[12px] text-white whitespace-nowrap">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  {statKeys.map((k) => (
                    <td key={k.key} className="py-1.5 px-2">
                      <Input
                        type="number"
                        min={0}
                        value={getRow(p.id)[k.key] ?? ''}
                        onChange={(e) => setCell(p.id, k.key, e.target.value)}
                        className="w-14 text-center px-1.5 py-1"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── CoachShell ────────────────────────────────────────────────────────────────

type CoachTab = 'roster' | 'schedule' | 'stats'

interface CoachShellInnerProps {
  teamId: number
}

function CoachShellInner({ teamId }: CoachShellInnerProps) {
  const { teams, loading } = useApp()
  const { user, userRole, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<CoachTab>('roster')

  const team = teams.find((t) => t.id === teamId)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
          <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
            Loading
          </span>
        </div>
      </div>
    )
  }

  const TABS: { id: CoachTab; label: string }[] = [
    { id: 'roster', label: 'My Roster' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Header */}
      <header className="bg-navy-dark border-b-2 border-red shrink-0 flex items-center px-4 h-12 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 bg-red rounded flex items-center justify-center">
            <span className="font-cond font-black text-white text-[10px]">CA</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-cond font-black tracking-widest uppercase text-[11px] text-white">
              Creekside AD
            </span>
            <span className="font-cond text-[10px] text-muted tracking-wide">Coach Portal</span>
          </div>
        </div>

        {team && (
          <span className="font-cond font-black tracking-widest uppercase text-[12px] text-white/70 hidden sm:block">
            {team.name}
          </span>
        )}

        <div className="w-px h-5 bg-border hidden md:block" />

        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'font-cond font-black tracking-widest uppercase text-[11px] px-3 py-1.5 rounded transition-colors',
                activeTab === tab.id
                  ? 'bg-red text-white'
                  : 'text-muted hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          {user?.email && (
            <span className="font-cond text-[11px] text-muted hidden sm:block truncate max-w-[160px]">
              {user.email}
            </span>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="text-muted hover:text-white transition-colors p-1 rounded"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="md:hidden border-b border-border bg-navy-dark shrink-0">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 font-cond font-black tracking-widest uppercase text-[11px] py-2.5 transition-colors',
                activeTab === tab.id
                  ? 'bg-red/20 text-white border-b-2 border-red'
                  : 'text-muted hover:text-white border-b-2 border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'roster' && <CoachRosterTab teamId={teamId} />}
        {activeTab === 'schedule' && <CoachScheduleTab teamId={teamId} />}
        {activeTab === 'stats' && <CoachStatsTab teamId={teamId} />}
      </main>
    </div>
  )
}

export function CoachShell() {
  const { userRole } = useAuth()
  const schoolId = userRole?.school_id ?? 1
  const teamId = userRole?.team_id

  if (!teamId) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <p className="font-cond font-black tracking-widest uppercase text-[13px] text-white mb-2">
            No Team Assigned
          </p>
          <p className="font-cond text-[12px] text-muted">
            Contact your athletic director to be assigned to a team.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AppProvider schoolId={schoolId}>
      <CoachShellInner teamId={teamId} />
    </AppProvider>
  )
}
