'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'
import toast from 'react-hot-toast'
import { Link, X, QrCode, Copy, CalendarX } from 'lucide-react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Btn, Modal, Pill } from '@/components/ui'
import { ScheduleChangeRequestModal } from '@/components/schedule/ScheduleChangeRequestModal'
import type { Game } from '@/types'

// ─── Types ────────────────────────────────────────────────────

interface CoachTeamRow {
  id: number
  role: string | null
  coaches: {
    name: string
    email: string
    certifications: string | null
  } | null
}

interface TeamReg {
  id: number
  team_name: string
  division: string
  status: string
  available_date_ids: number[] | null
}

interface EventDate {
  id: number
  label: string | null
  date: string
}

interface InviteState {
  token: string | null
  is_active: boolean
  url: string | null
}

// ─── Component ────────────────────────────────────────────────

export function ProgramLeaderDashboard() {
  const { userRole } = useAuth()
  const portalEventId = userRole?.event_id
  const programId = userRole?.program_id

  const [teamRegs, setTeamRegs] = useState<TeamReg[]>([])
  const [coachesByTeam, setCoachesByTeam] = useState<Map<number, CoachTeamRow[]>>(new Map())
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [invite, setInvite] = useState<InviteState>({ token: null, is_active: false, url: null })
  const [loading, setLoading] = useState(true)

  // Games and schedule change requests for Request Change button
  const [programTeams, setProgramTeams] = useState<{ id: number; name: string }[]>([])
  const [programGames, setProgramGames] = useState<Game[]>([])
  const [pendingGameIds, setPendingGameIds] = useState<Set<number>>(new Set())
  const [scrModalOpen, setScrModalOpen] = useState(false)
  const [scrPreSelectedGameId, setScrPreSelectedGameId] = useState<number | undefined>()
  const [scrTeamId, setScrTeamId] = useState<number | undefined>()

  // Invite UI state
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [revokingInvite, setRevokingInvite] = useState(false)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (portalEventId && programId) {
      loadData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalEventId, programId])

  if (!portalEventId || !programId) return null

  async function loadData() {
    const sb = createClient()
    setLoading(true)

    // Load team registrations for this program
    const { data: regs } = await sb
      .from('team_registrations')
      .select('id, team_name, division, status, available_date_ids')
      .eq('program_id', programId!)
      .eq('event_id', portalEventId!)
      .order('created_at')

    const regList = (regs as TeamReg[]) ?? []
    setTeamRegs(regList)

    // Load coaches for each team registration
    const coachMap = new Map<number, CoachTeamRow[]>()
    if (regList.length > 0) {
      const { data: coachRows } = await sb
        .from('coach_teams')
        .select('id, role, team_registration_id, coaches(name, email, certifications)')
        .in('team_registration_id', regList.map(t => t.id))
        .eq('event_id', portalEventId!)

      for (const row of (coachRows ?? []) as any[]) {
        const teamId = row.team_registration_id
        if (!coachMap.has(teamId)) coachMap.set(teamId, [])
        coachMap.get(teamId)!.push({
          id: row.id,
          role: row.role,
          coaches: row.coaches,
        })
      }
    }
    setCoachesByTeam(coachMap)

    // Load event dates for availability display
    const { data: dates } = await sb
      .from('event_dates')
      .select('id, label, date')
      .eq('event_id', portalEventId!)
      .order('date')

    setEventDates((dates as EventDate[]) ?? [])

    // Load invite status
    const { data: inviteData } = await sb
      .from('coach_invites')
      .select('token, is_active')
      .eq('program_id', programId!)
      .eq('event_id', portalEventId!)
      .maybeSingle()

    if (inviteData && inviteData.is_active) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/coach/${inviteData.token}`
      setInvite({ token: inviteData.token, is_active: true, url })
    } else {
      setInvite({ token: null, is_active: false, url: null })
    }

    // Load actual teams (from teams table) for this program to support Request Change
    const { data: teamsData } = await sb
      .from('teams')
      .select('id, name')
      .eq('program_id', programId!)
      .eq('event_id', portalEventId!)

    const teamsList = (teamsData ?? []) as { id: number; name: string }[]
    setProgramTeams(teamsList)

    if (teamsList.length > 0) {
      const teamIds = teamsList.map((t) => t.id)

      // Load games for program's teams
      const { data: gamesData } = await sb
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name), field:fields(id, name)')
        .eq('event_id', portalEventId!)
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .order('scheduled_time')

      setProgramGames((gamesData as Game[]) ?? [])

      // Load pending schedule change request game IDs
      const { data: scrData } = await sb
        .from('schedule_change_requests')
        .select('id, status, schedule_change_request_games(game_id, status)')
        .eq('event_id', portalEventId!)
        .in('team_id', teamIds)
        .in('status', ['pending', 'under_review'])

      const pendingIds = new Set<number>(
        ((scrData ?? []) as any[])
          .flatMap((r: any) => r.schedule_change_request_games ?? [])
          .map((g: any) => g.game_id as number)
      )
      setPendingGameIds(pendingIds)
    }

    setLoading(false)
  }

  async function handleGenerateInvite() {
    setGeneratingInvite(true)
    try {
      const res = await fetch('/api/coach-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, eventId: portalEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate invite link')
        return
      }
      setInvite({ token: data.token, is_active: true, url: data.inviteUrl })
      toast.success('Invite link generated')
    } catch {
      toast.error('Failed to generate invite link')
    } finally {
      setGeneratingInvite(false)
    }
  }

  async function handleRevokeInvite() {
    setRevokingInvite(true)
    try {
      const res = await fetch('/api/coach-invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, eventId: portalEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to revoke invite link')
        return
      }
      setInvite({ token: null, is_active: false, url: null })
      setShowRevokeModal(false)
      toast.success('Invite link revoked')
    } catch {
      toast.error('Failed to revoke invite link')
    } finally {
      setRevokingInvite(false)
    }
  }

  function handleCopyLink() {
    if (!invite.url) return
    navigator.clipboard.writeText(invite.url)
    toast.success('Link copied')
  }

  function handleDownloadSVG() {
    if (!svgRef.current) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgRef.current)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coach-invite-${programId}.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleDownloadPNG() {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `coach-invite-${programId}.png`
    link.click()
  }

  function getAvailabilityLabel(team: TeamReg): string {
    if (!team.available_date_ids || team.available_date_ids.length === 0) {
      return 'Available all dates'
    }
    const labels = team.available_date_ids
      .map(id => {
        const d = eventDates.find(ed => ed.id === id)
        return d?.label ?? d?.date ?? String(id)
      })
      .join(', ')
    return labels || 'Available all dates'
  }

  const inp =
    'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none'

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-cond text-muted tracking-widest">LOADING...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface p-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Coach Invite Section */}
        <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-5">
          <div className="font-cond text-[12px] font-black tracking-[.12em] text-white uppercase mb-4">
            COACH INVITE LINK
          </div>

          {invite.is_active && invite.url ? (
            <div className="space-y-3">
              {/* Link + QR thumbnail row */}
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 bg-white rounded p-1 flex-shrink-0">
                  <QRCodeSVG
                    value={invite.url}
                    size={72}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    readOnly
                    value={invite.url}
                    className={inp + ' cursor-default select-all'}
                    onFocus={e => e.target.select()}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Btn variant="ghost" size="sm" onClick={handleCopyLink}>
                  <Copy size={12} className="inline mr-1" />
                  COPY LINK
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setShowQRModal(true)}>
                  <QrCode size={12} className="inline mr-1" />
                  VIEW QR
                </Btn>
                <Btn variant="danger" size="sm" onClick={() => setShowRevokeModal(true)}>
                  <X size={12} className="inline mr-1" />
                  REVOKE LINK
                </Btn>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[12px] text-[#5a6e9a] mb-3">
                Generate a link coaches can use to self-register to your teams.
              </div>
              <Btn
                variant="ghost"
                size="sm"
                onClick={handleGenerateInvite}
                disabled={generatingInvite}
              >
                <Link size={12} className="inline mr-1" />
                GENERATE INVITE LINK
              </Btn>
            </div>
          )}
        </div>

        {/* Teams with Coaches Section */}
        {teamRegs.map(team => {
          const coaches = coachesByTeam.get(team.id) ?? []
          return (
            <div
              key={team.id}
              className="bg-[#081428] border border-[#1a2d50] rounded-xl p-5"
            >
              {/* Team header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-cond text-[15px] font-black text-white">{team.team_name}</div>
                  <div className="font-cond text-[11px] text-[#5a6e9a] uppercase">{team.division}</div>
                </div>
                <Pill variant={team.status === 'approved' ? 'green' : 'yellow'}>
                  {team.status.toUpperCase()}
                </Pill>
              </div>

              {/* Coaches section */}
              <div className="mb-3">
                <div className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase mb-2 flex items-center gap-2">
                  COACHES
                  <span className="font-cond text-[11px] text-[#5a6e9a]">{coaches.length} Coach{coaches.length !== 1 ? 'es' : ''}</span>
                </div>
                {coaches.length === 0 ? (
                  <div className="text-[12px] text-[#5a6e9a] italic">No coaches assigned yet.</div>
                ) : (
                  <div className="space-y-2">
                    {coaches.map(ct => (
                      <div key={ct.id} className="flex items-center gap-2 flex-wrap">
                        <div className="w-7 h-7 rounded-full bg-[#1a2d50] flex items-center justify-center flex-shrink-0">
                          <span className="font-cond text-[10px] font-black text-white">
                            {ct.coaches?.name?.charAt(0) ?? '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-cond text-[13px] font-bold text-white">{ct.coaches?.name ?? '—'}</div>
                          <div className="text-[11px] text-[#5a6e9a]">{ct.coaches?.email ?? ''}</div>
                        </div>
                        {ct.coaches?.certifications && (
                          <Pill variant="blue">{ct.coaches.certifications}</Pill>
                        )}
                        {ct.role && (
                          <Pill variant="gray">{ct.role}</Pill>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Dates section */}
              <div>
                <div className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase mb-1">
                  AVAILABLE DATES
                </div>
                <div className="text-[12px] text-white">
                  {getAvailabilityLabel(team)}
                </div>
              </div>

              {/* Games section with Request Change buttons */}
              {(() => {
                const matchedTeam = programTeams.find(
                  (t) => t.name.toLowerCase() === team.team_name.toLowerCase()
                )
                if (!matchedTeam) return null
                const teamGames = programGames.filter(
                  (g) => g.home_team_id === matchedTeam.id || g.away_team_id === matchedTeam.id
                )
                if (teamGames.length === 0) return null
                return (
                  <div className="mt-3">
                    <div className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase mb-2">
                      UPCOMING GAMES
                    </div>
                    <div className="space-y-1.5">
                      {teamGames.map((game) => {
                        const isPending = pendingGameIds.has(game.id)
                        const isCancelled = game.status === 'Cancelled'
                        const opponent =
                          game.home_team_id === matchedTeam.id
                            ? (game.away_team as any)?.name ?? `Team #${game.away_team_id}`
                            : (game.home_team as any)?.name ?? `Team #${game.home_team_id}`
                        return (
                          <div
                            key={game.id}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 bg-[#040e24] border border-[#1e3060] ${isCancelled ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`font-mono text-[11px] text-[#5a6e9a] whitespace-nowrap ${isCancelled ? 'line-through' : ''}`}>
                                {game.scheduled_time}
                              </span>
                              <span className="font-cond text-[12px] text-white font-black truncate">
                                vs {opponent}
                              </span>
                            </div>
                            {!isCancelled && (
                              <Btn
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                title={isPending ? 'Request pending' : undefined}
                                aria-label="Request a schedule change for this game"
                                onClick={() => {
                                  setScrTeamId(matchedTeam.id)
                                  setScrPreSelectedGameId(game.id)
                                  setScrModalOpen(true)
                                }}
                              >
                                <CalendarX size={11} className="inline mr-1" />
                                Request Change
                              </Btn>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}

        {teamRegs.length === 0 && (
          <div className="text-center text-[#5a6e9a] text-[13px] py-8">
            No teams registered yet.
          </div>
        )}
      </div>

      {/* QR Modal */}
      <Modal
        open={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Coach Invite QR Code"
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={handleDownloadSVG}>Download SVG</Btn>
            <Btn variant="ghost" size="sm" onClick={handleDownloadPNG}>Download PNG</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowQRModal(false)}>Close</Btn>
          </>
        }
      >
        {invite.url && (
          <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg mx-auto" style={{ maxWidth: 300 }}>
            <QRCodeSVG
              ref={svgRef}
              value={invite.url}
              size={256}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
            />
          </div>
        )}
        {/* Hidden canvas for PNG export */}
        <div style={{ display: 'none' }}>
          {invite.url && (
            <QRCodeCanvas
              ref={canvasRef}
              value={invite.url}
              size={512}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
            />
          )}
        </div>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="Revoke Coach Invite Link?"
        footer={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setShowRevokeModal(false)}>
              CANCEL
            </Btn>
            <Btn
              variant="danger"
              size="sm"
              onClick={handleRevokeInvite}
              disabled={revokingInvite}
            >
              REVOKE LINK
            </Btn>
          </>
        }
      >
        <div className="text-[13px] text-[#5a6e9a]">
          This will invalidate the current link. You can generate a new one after revoking.
        </div>
      </Modal>

      {/* Schedule Change Request modal */}
      {scrTeamId && (
        <ScheduleChangeRequestModal
          open={scrModalOpen}
          onClose={() => {
            setScrModalOpen(false)
            setScrPreSelectedGameId(undefined)
            setScrTeamId(undefined)
          }}
          preSelectedGameId={scrPreSelectedGameId}
          teamId={scrTeamId}
          teamGames={programGames.filter(
            (g) => g.home_team_id === scrTeamId || g.away_team_id === scrTeamId
          )}
        />
      )}
    </div>
  )
}
