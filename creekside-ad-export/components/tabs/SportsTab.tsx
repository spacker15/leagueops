'use client'

import { useState } from 'react'
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
  Pill,
  Avatar,
} from '@/components/ui'
import * as db from '@/lib/db'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, ChevronRight, Users } from 'lucide-react'
import type { Sport, Team, Season, Coach } from '@/types'

// ── Season config ────────────────────────────────────────────────────────────

const SEASONS: Season[] = ['fall', 'winter', 'spring']

const SEASON_PILL: Record<Season, 'blue' | 'yellow' | 'green'> = {
  fall: 'yellow',
  winter: 'blue',
  spring: 'green',
}

const DIVISIONS = ['Varsity', 'JV', 'Freshman']

const CURRENT_YEAR = new Date().getFullYear()
const SEASON_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

// ── Add Sport Form ────────────────────────────────────────────────────────────

interface SportForm {
  name: string
  abbreviation: string
  season: Season
  gender: string
}

const SPORT_FORM_DEFAULT: SportForm = {
  name: '',
  abbreviation: '',
  season: 'fall',
  gender: 'Boys',
}

// ── Add Team Form ─────────────────────────────────────────────────────────────

interface TeamForm {
  name: string
  division: string
  season_year: number
  head_coach_id: string
}

const TEAM_FORM_DEFAULT: TeamForm = {
  name: '',
  division: 'Varsity',
  season_year: CURRENT_YEAR,
  head_coach_id: '',
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SportsTab() {
  const { school, schoolId, sports, teams, coaches } = useApp()
  const { canManage } = useAuth()

  // Selected sport for detail panel
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null)

  // Sport modal
  const [sportModalOpen, setSportModalOpen] = useState(false)
  const [sportForm, setSportForm] = useState<SportForm>(SPORT_FORM_DEFAULT)
  const [savingSport, setSavingSport] = useState(false)

  // Team modal
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [teamForm, setTeamForm] = useState<TeamForm>(TEAM_FORM_DEFAULT)
  const [savingTeam, setSavingTeam] = useState(false)

  // Delete confirm
  const [confirmDeleteSport, setConfirmDeleteSport] = useState<Sport | null>(null)
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selectedSport = sports.find((s) => s.id === selectedSportId) ?? null
  const selectedTeams = teams.filter((t) => t.sport_id === selectedSportId)

  // Group sports by season
  const sportsBySeason = SEASONS.map((season) => ({
    season,
    items: sports.filter((s) => s.season === season),
  })).filter((g) => g.items.length > 0)

  // ── Handlers ──

  async function handleAddSport() {
    if (!sportForm.name.trim()) {
      toast.error('Sport name is required')
      return
    }
    if (!school) return
    setSavingSport(true)
    try {
      const created = await db.insertSport({
        school_id: schoolId,
        name: sportForm.name.trim(),
        abbreviation: sportForm.abbreviation.trim() || sportForm.name.slice(0, 4).toUpperCase(),
        season: sportForm.season,
        gender: sportForm.gender,
        is_active: true,
        sort_order: sports.length,
      })
      if (created) {
        toast.success(`${created.name} added`)
        setSportModalOpen(false)
        setSportForm(SPORT_FORM_DEFAULT)
        // Reload page to sync store (simple approach per spec)
        window.location.reload()
      }
    } catch {
      toast.error('Failed to add sport')
    } finally {
      setSavingSport(false)
    }
  }

  async function handleDeleteSport() {
    if (!confirmDeleteSport) return
    setDeleting(true)
    try {
      await db.deleteSport(confirmDeleteSport.id)
      toast.success(`${confirmDeleteSport.name} deleted`)
      setConfirmDeleteSport(null)
      if (selectedSportId === confirmDeleteSport.id) setSelectedSportId(null)
      window.location.reload()
    } catch {
      toast.error('Failed to delete sport')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddTeam() {
    if (!teamForm.name.trim()) {
      toast.error('Team name is required')
      return
    }
    if (!selectedSport || !school) return
    setSavingTeam(true)
    try {
      const created = await db.insertTeam({
        sport_id: selectedSport.id,
        school_id: schoolId,
        name: teamForm.name.trim(),
        division: teamForm.division,
        season_year: teamForm.season_year,
        win_count: 0,
        loss_count: 0,
        tie_count: 0,
        head_coach_id: teamForm.head_coach_id ? Number(teamForm.head_coach_id) : undefined,
      })
      if (created) {
        toast.success(`${created.name} added`)
        setTeamModalOpen(false)
        setTeamForm(TEAM_FORM_DEFAULT)
        window.location.reload()
      }
    } catch {
      toast.error('Failed to add team')
    } finally {
      setSavingTeam(false)
    }
  }

  async function handleDeleteTeam() {
    if (!confirmDeleteTeam) return
    setDeleting(true)
    try {
      await db.deleteTeam(confirmDeleteTeam.id)
      toast.success(`${confirmDeleteTeam.name} deleted`)
      setConfirmDeleteTeam(null)
      window.location.reload()
    } catch {
      toast.error('Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="tab-content">
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* ── Left Panel: Sports List ── */}
        <div className="lg:w-72 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionHeader>Sports</SectionHeader>
            {canManage && (
              <Btn
                size="sm"
                variant="primary"
                onClick={() => setSportModalOpen(true)}
                className="mb-3"
              >
                <Plus size={12} />
                Add Sport
              </Btn>
            )}
          </div>

          {sports.length === 0 ? (
            <Card className="p-4">
              <p className="text-muted text-[12px] font-cond font-bold tracking-wide text-center py-2">
                No sports configured yet.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {sportsBySeason.map(({ season, items }) => (
                <div key={season}>
                  <div className="mb-2">
                    <Pill variant={SEASON_PILL[season]}>{season}</Pill>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((sport) => {
                      const teamCount = teams.filter((t) => t.sport_id === sport.id).length
                      const isSelected = selectedSportId === sport.id
                      return (
                        <div
                          key={sport.id}
                          className={cn(
                            'flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors group',
                            isSelected
                              ? 'bg-navy/30 border-navy/60 text-white'
                              : 'bg-surface-card border-border hover:border-[#2a4070] hover:bg-[#0a1830]'
                          )}
                          onClick={() => setSelectedSportId(isSelected ? null : sport.id)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={sport.abbreviation || sport.name} variant="blue" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-cond font-black text-[13px] text-white leading-tight truncate">
                                {sport.name}
                              </span>
                              <span className="font-cond text-[10px] text-muted">
                                {sport.gender} &middot; {teamCount} team{teamCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canManage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmDeleteSport(sport)
                                }}
                                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red transition-all p-0.5 rounded"
                                title="Delete sport"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <ChevronRight
                              size={14}
                              className={cn(
                                'text-muted transition-transform',
                                isSelected && 'rotate-90 text-white'
                              )}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Panel: Teams ── */}
        <div className="flex-1 min-w-0">
          {!selectedSport ? (
            <Card className="p-8 flex flex-col items-center justify-center gap-3 h-48">
              <Users size={28} className="text-muted/40" />
              <p className="text-muted text-[12px] font-cond font-bold tracking-wide text-center">
                Select a sport to view its teams.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <div>
                  <SectionHeader>{selectedSport.name} — Teams</SectionHeader>
                </div>
                {canManage && (
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setTeamForm(TEAM_FORM_DEFAULT)
                      setTeamModalOpen(true)
                    }}
                    className="mb-3"
                  >
                    <Plus size={12} />
                    Add Team
                  </Btn>
                )}
              </div>

              {selectedTeams.length === 0 ? (
                <Card className="p-6 flex flex-col items-center gap-2">
                  <p className="text-muted text-[12px] font-cond font-bold tracking-wide">
                    No teams for this sport yet.
                  </p>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                            Team
                          </th>
                          <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                            Division
                          </th>
                          <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                            Year
                          </th>
                          <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                            Record
                          </th>
                          <th className="px-4 py-2.5 text-left font-cond font-black tracking-widest uppercase text-[11px] text-muted">
                            Coach
                          </th>
                          {canManage && <th className="px-4 py-2.5 w-10" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedTeams.map((team) => {
                          const coach = coaches.find((c) => c.id === team.head_coach_id)
                          return (
                            <tr
                              key={team.id}
                              className="group hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span className="font-cond font-black text-[13px] text-white">
                                  {team.name}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <DivisionBadge division={team.division} />
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-[12px] text-muted">
                                  {team.season_year}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-[13px] text-white">
                                  {team.win_count}–{team.loss_count}
                                  {team.tie_count > 0 ? `–${team.tie_count}` : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {coach ? (
                                  <span className="font-cond text-[12px] text-muted">
                                    {coach.name}
                                  </span>
                                ) : (
                                  <span className="text-muted/40 text-[11px] font-cond">—</span>
                                )}
                              </td>
                              {canManage && (
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setConfirmDeleteTeam(team)}
                                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red transition-all p-1 rounded"
                                    title="Delete team"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Sport Modal ── */}
      <Modal
        open={sportModalOpen}
        onClose={() => {
          setSportModalOpen(false)
          setSportForm(SPORT_FORM_DEFAULT)
        }}
        title="Add Sport"
        footer={
          <>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => {
                setSportModalOpen(false)
                setSportForm(SPORT_FORM_DEFAULT)
              }}
            >
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleAddSport} disabled={savingSport}>
              {savingSport ? 'Saving…' : 'Add Sport'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name">
            <Input
              value={sportForm.name}
              onChange={(e) => setSportForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Girls Lacrosse"
              autoFocus
            />
          </FormField>
          <FormField label="Abbreviation">
            <Input
              value={sportForm.abbreviation}
              onChange={(e) =>
                setSportForm((f) => ({
                  ...f,
                  abbreviation: e.target.value.toUpperCase().slice(0, 6),
                }))
              }
              placeholder="e.g. GLAX"
              maxLength={6}
            />
          </FormField>
          <FormField label="Season">
            <Select
              value={sportForm.season}
              onChange={(e) => setSportForm((f) => ({ ...f, season: e.target.value as Season }))}
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Gender">
            <Select
              value={sportForm.gender}
              onChange={(e) => setSportForm((f) => ({ ...f, gender: e.target.value }))}
            >
              {['Boys', 'Girls', 'Co-ed'].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* ── Add Team Modal ── */}
      <Modal
        open={teamModalOpen}
        onClose={() => {
          setTeamModalOpen(false)
          setTeamForm(TEAM_FORM_DEFAULT)
        }}
        title={`Add Team — ${selectedSport?.name ?? ''}`}
        footer={
          <>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => {
                setTeamModalOpen(false)
                setTeamForm(TEAM_FORM_DEFAULT)
              }}
            >
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleAddTeam} disabled={savingTeam}>
              {savingTeam ? 'Saving…' : 'Add Team'}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Team Name">
            <Input
              value={teamForm.name}
              onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Creekside Girls Lacrosse Varsity"
              autoFocus
            />
          </FormField>
          <FormField label="Division">
            <Select
              value={teamForm.division}
              onChange={(e) => setTeamForm((f) => ({ ...f, division: e.target.value }))}
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Season Year">
            <Select
              value={teamForm.season_year}
              onChange={(e) => setTeamForm((f) => ({ ...f, season_year: Number(e.target.value) }))}
            >
              {SEASON_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Head Coach (optional)">
            <Select
              value={teamForm.head_coach_id}
              onChange={(e) => setTeamForm((f) => ({ ...f, head_coach_id: e.target.value }))}
            >
              <option value="">— Unassigned —</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.title})
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* ── Confirm Delete Sport ── */}
      <Modal
        open={!!confirmDeleteSport}
        onClose={() => setConfirmDeleteSport(null)}
        title="Delete Sport"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setConfirmDeleteSport(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" size="sm" onClick={handleDeleteSport} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Sport'}
            </Btn>
          </>
        }
      >
        <p className="text-white text-[13px] font-cond">
          Are you sure you want to delete{' '}
          <span className="font-black">{confirmDeleteSport?.name}</span>? This will also delete all
          associated teams. This action cannot be undone.
        </p>
      </Modal>

      {/* ── Confirm Delete Team ── */}
      <Modal
        open={!!confirmDeleteTeam}
        onClose={() => setConfirmDeleteTeam(null)}
        title="Delete Team"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setConfirmDeleteTeam(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" size="sm" onClick={handleDeleteTeam} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Team'}
            </Btn>
          </>
        }
      >
        <p className="text-white text-[13px] font-cond">
          Are you sure you want to delete{' '}
          <span className="font-black">{confirmDeleteTeam?.name}</span>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  )
}

// ── DivisionBadge helper ──────────────────────────────────────────────────────

function DivisionBadge({ division }: { division: string }) {
  const variant = division === 'Varsity' ? 'blue' : division === 'JV' ? 'green' : 'gray'
  return <Pill variant={variant as 'blue' | 'green' | 'gray'}>{division}</Pill>
}
