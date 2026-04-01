'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  Card,
  SectionHeader,
  Modal,
  Btn,
  FormField,
  Input,
  Select,
  EligBadge,
  Pill,
  Avatar,
} from '@/components/ui'
import * as db from '@/lib/db'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, Pencil, Upload, ChevronDown } from 'lucide-react'
import type { Player, EligibilityStatus } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADE_LEVELS = ['9th', '10th', '11th', '12th']
const DIVISIONS = ['Varsity', 'JV', 'Freshman']
const CURRENT_YEAR = new Date().getFullYear()
const GRAD_YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3]
const ELIGIBILITY_OPTIONS: EligibilityStatus[] = ['eligible', 'ineligible', 'probation']

// Derive positions per sport from SPORT_STAT_KEYS or fall back to generic
const SPORT_POSITIONS: Record<string, string[]> = {
  'Girls Lacrosse': ['Attack', 'Midfield', 'Defense', 'Goalie'],
  'Boys Lacrosse': ['Attack', 'Midfield', 'Defense', 'Goalie', 'FOGO'],
  Soccer: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
  Basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  Volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero', 'Opposite Hitter'],
  Baseball: [
    'Pitcher',
    'Catcher',
    'First Base',
    'Second Base',
    'Shortstop',
    'Third Base',
    'Left Field',
    'Center Field',
    'Right Field',
    'DH',
  ],
  Softball: [
    'Pitcher',
    'Catcher',
    'First Base',
    'Second Base',
    'Shortstop',
    'Third Base',
    'Left Field',
    'Center Field',
    'Right Field',
    'DP',
  ],
  Football: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'],
}

const GENERIC_POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper', 'Other']

function getPositions(sportName: string): string[] {
  return SPORT_POSITIONS[sportName] ?? GENERIC_POSITIONS
}

// ── Player form ───────────────────────────────────────────────────────────────

interface PlayerForm {
  name: string
  jersey_number: string
  position: string
  grade_level: string
  graduation_year: string
  eligibility_status: EligibilityStatus
}

const PLAYER_FORM_DEFAULT: PlayerForm = {
  name: '',
  jersey_number: '',
  position: '',
  grade_level: '9th',
  graduation_year: String(CURRENT_YEAR + 4),
  eligibility_status: 'eligible',
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RostersTab() {
  const { sports, teams, schoolId } = useApp()
  const { canManage } = useAuth()

  // Sport selection
  const [selectedSportId, setSelectedSportId] = useState<number | null>(
    sports.length > 0 ? sports[0].id : null
  )
  // Division filter
  const [selectedDivision, setSelectedDivision] = useState<string>('Varsity')

  // Players for selected team
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  // Add/edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [playerForm, setPlayerForm] = useState<PlayerForm>(PLAYER_FORM_DEFAULT)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Derive selected team
  const selectedSport = sports.find((s) => s.id === selectedSportId) ?? null
  const teamsForSport = teams.filter((t) => t.sport_id === selectedSportId)
  const selectedTeam =
    teamsForSport.find((t) => t.division === selectedDivision) ?? teamsForSport[0] ?? null

  // ── Load players when team changes ──
  const loadPlayers = useCallback(async () => {
    if (!selectedTeam) {
      setPlayers([])
      return
    }
    setLoadingPlayers(true)
    try {
      const data = await db.getPlayers(selectedTeam.id)
      setPlayers(data)
    } catch {
      toast.error('Failed to load players')
    } finally {
      setLoadingPlayers(false)
    }
  }, [selectedTeam])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  // When sport list loads and nothing selected yet
  useEffect(() => {
    if (selectedSportId === null && sports.length > 0) {
      setSelectedSportId(sports[0].id)
    }
  }, [sports, selectedSportId])

  // ── Open add modal ──
  function openAdd() {
    const positions = getPositions(selectedSport?.name ?? '')
    setEditingPlayer(null)
    setPlayerForm({
      ...PLAYER_FORM_DEFAULT,
      position: positions[0] ?? '',
    })
    setModalOpen(true)
  }

  // ── Open edit modal ──
  function openEdit(player: Player) {
    setEditingPlayer(player)
    setPlayerForm({
      name: player.name,
      jersey_number: player.jersey_number != null ? String(player.jersey_number) : '',
      position: player.position ?? '',
      grade_level: player.grade_level ?? '9th',
      graduation_year: player.graduation_year != null ? String(player.graduation_year) : '',
      eligibility_status: player.eligibility_status,
    })
    setModalOpen(true)
  }

  // ── Save player ──
  async function handleSave() {
    if (!playerForm.name.trim()) {
      toast.error('Player name is required')
      return
    }
    if (!selectedTeam) return
    setSaving(true)
    try {
      const payload = {
        name: playerForm.name.trim(),
        jersey_number: playerForm.jersey_number ? Number(playerForm.jersey_number) : undefined,
        position: playerForm.position || undefined,
        grade_level: playerForm.grade_level || undefined,
        graduation_year: playerForm.graduation_year
          ? Number(playerForm.graduation_year)
          : undefined,
        eligibility_status: playerForm.eligibility_status,
      }
      if (editingPlayer) {
        await db.updatePlayer(editingPlayer.id, payload)
        toast.success('Player updated')
      } else {
        const created = await db.insertPlayer({
          ...payload,
          team_id: selectedTeam.id,
          school_id: schoolId,
          is_active: true,
          eligibility_status: playerForm.eligibility_status,
        })
        if (!created) throw new Error('Insert failed')
        toast.success(`${created.name} added`)
      }
      setModalOpen(false)
      setEditingPlayer(null)
      await loadPlayers()
    } catch {
      toast.error('Failed to save player')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete player (soft) ──
  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await db.deletePlayer(confirmDelete.id)
      toast.success(`${confirmDelete.name} removed from roster`)
      setConfirmDelete(null)
      await loadPlayers()
    } catch {
      toast.error('Failed to remove player')
    } finally {
      setDeleting(false)
    }
  }

  const positions = getPositions(selectedSport?.name ?? '')

  // Available divisions for selected sport
  const availableDivisions = DIVISIONS.filter((d) => teamsForSport.some((t) => t.division === d))

  return (
    <div className="tab-content flex flex-col gap-4">
      {/* ── Sport Selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {sports.map((sport) => (
            <button
              key={sport.id}
              onClick={() => {
                setSelectedSportId(sport.id)
                setSelectedDivision('Varsity')
              }}
              className={cn(
                'font-cond font-black tracking-widest uppercase text-[11px] px-3 py-1.5 rounded-lg border transition-colors',
                selectedSportId === sport.id
                  ? 'bg-navy border-navy/80 text-white'
                  : 'bg-surface-card border-border text-muted hover:text-white hover:border-[#2a4070]'
              )}
            >
              {sport.name}
            </button>
          ))}
        </div>
        {sports.length === 0 && (
          <p className="text-muted text-[12px] font-cond font-bold">
            No sports configured. Add sports first.
          </p>
        )}
      </div>

      {/* ── Division Chips ── */}
      {selectedSport && (
        <div className="flex items-center gap-2 flex-wrap">
          {availableDivisions.length > 0 ? (
            availableDivisions.map((div) => (
              <button
                key={div}
                onClick={() => setSelectedDivision(div)}
                className={cn(
                  'font-cond font-black tracking-widest uppercase text-[10px] px-2.5 py-1 rounded-full border transition-colors',
                  selectedDivision === div
                    ? 'bg-red/20 border-red/40 text-red-300'
                    : 'bg-surface-card border-border text-muted hover:text-white'
                )}
              >
                {div}
              </button>
            ))
          ) : (
            <span className="text-muted text-[11px] font-cond">
              No teams for this sport. Add teams in the Sports tab.
            </span>
          )}
        </div>
      )}

      {/* ── Team Header + Actions ── */}
      {selectedTeam ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionHeader>{selectedTeam.name} — Roster</SectionHeader>
            <p className="text-muted text-[11px] font-cond mt-0.5">
              {players.length} player{players.length !== 1 ? 's' : ''}
              {' · '}
              {players.filter((p) => p.eligibility_status === 'eligible').length} eligible
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Btn
              size="sm"
              variant="outline"
              onClick={() => toast('CSV import coming soon', { icon: '📋' })}
            >
              <Upload size={12} />
              Import CSV
            </Btn>
            {canManage && (
              <Btn size="sm" variant="primary" onClick={openAdd}>
                <Plus size={12} />
                Add Player
              </Btn>
            )}
          </div>
        </div>
      ) : (
        selectedSport && (
          <div className="flex items-center justify-between gap-3">
            <SectionHeader>Roster</SectionHeader>
          </div>
        )
      )}

      {/* ── Player Table ── */}
      {!selectedSport ? (
        <Card className="p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-muted text-[12px] font-cond font-bold tracking-wide">
            Select a sport to manage rosters.
          </p>
        </Card>
      ) : !selectedTeam ? (
        <Card className="p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-muted text-[12px] font-cond font-bold tracking-wide">
            No {selectedDivision} team found for {selectedSport.name}.
          </p>
        </Card>
      ) : loadingPlayers ? (
        <Card className="p-8 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
          <span className="font-cond text-[11px] text-muted tracking-widest uppercase">
            Loading roster…
          </span>
        </Card>
      ) : players.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-muted text-[12px] font-cond font-bold tracking-wide">
            No players on this roster yet.
          </p>
          {canManage && (
            <Btn size="sm" variant="primary" onClick={openAdd}>
              <Plus size={12} />
              Add First Player
            </Btn>
          )}
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted w-12">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted hidden sm:table-cell">
                    Position
                  </th>
                  <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted hidden md:table-cell">
                    Grade
                  </th>
                  <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                    Eligibility
                  </th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    canManage={canManage}
                    onEdit={() => openEdit(player)}
                    onDelete={() => setConfirmDelete(player)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Add / Edit Player Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingPlayer(null)
        }}
        title={editingPlayer ? `Edit — ${editingPlayer.name}` : 'Add Player'}
        footer={
          <>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => {
                setModalOpen(false)
                setEditingPlayer(null)
              }}
            >
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingPlayer ? 'Save Changes' : 'Add Player'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Full Name">
            <Input
              value={playerForm.name}
              onChange={(e) => setPlayerForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="First Last"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Jersey #">
              <Input
                type="number"
                min={0}
                max={99}
                value={playerForm.jersey_number}
                onChange={(e) => setPlayerForm((f) => ({ ...f, jersey_number: e.target.value }))}
                placeholder="00"
              />
            </FormField>
            <FormField label="Grade">
              <Select
                value={playerForm.grade_level}
                onChange={(e) => setPlayerForm((f) => ({ ...f, grade_level: e.target.value }))}
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Position">
              <Select
                value={playerForm.position}
                onChange={(e) => setPlayerForm((f) => ({ ...f, position: e.target.value }))}
              >
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Grad Year">
              <Select
                value={playerForm.graduation_year}
                onChange={(e) => setPlayerForm((f) => ({ ...f, graduation_year: e.target.value }))}
              >
                {GRAD_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Eligibility Status">
            <Select
              value={playerForm.eligibility_status}
              onChange={(e) =>
                setPlayerForm((f) => ({
                  ...f,
                  eligibility_status: e.target.value as EligibilityStatus,
                }))
              }
            >
              {ELIGIBILITY_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove Player"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove Player'}
            </Btn>
          </>
        }
      >
        <p className="text-white text-[13px] font-cond">
          Remove{' '}
          <span className="font-black">
            {confirmDelete?.jersey_number != null ? `#${confirmDelete.jersey_number} ` : ''}
            {confirmDelete?.name}
          </span>{' '}
          from the roster? The player will be marked inactive and can be re-added later.
        </p>
      </Modal>
    </div>
  )
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: Player
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

function PlayerRow({ player, canManage, onEdit, onDelete }: PlayerRowProps) {
  return (
    <tr className="group hover:bg-white/[0.02] transition-colors">
      {/* Jersey # */}
      <td className="px-4 py-3">
        <span className="font-mono text-[13px] text-muted w-8 inline-block text-center">
          {player.jersey_number != null ? player.jersey_number : '—'}
        </span>
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={player.name} variant="blue" />
          <span className="font-cond font-black text-[13px] text-white">{player.name}</span>
        </div>
      </td>

      {/* Position */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="font-cond text-[12px] text-muted">{player.position ?? '—'}</span>
      </td>

      {/* Grade */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="font-cond text-[12px] text-muted">{player.grade_level ?? '—'}</span>
      </td>

      {/* Eligibility */}
      <td className="px-4 py-3">
        <EligBadge status={player.eligibility_status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canManage && (
            <>
              <button
                onClick={onEdit}
                className="text-muted hover:text-blue-300 p-1 rounded transition-colors"
                title="Edit player"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={onDelete}
                className="text-muted hover:text-red transition-colors p-1 rounded"
                title="Remove player"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
